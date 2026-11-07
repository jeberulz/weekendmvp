/**
 * WP67-S7 (issue #220). Core of `scripts/generate-crew-avatars.mjs`.
 *
 * Plans and renders the fixed crew avatar set with Recraft V4.1 Flash only.
 * There is no other image provider here: a refused or failed Flash call
 * stops the run, it never falls back to OpenAI images.
 */

import {
  CREW_AVATAR_STYLE_VERSION,
  CREW_PERSONAS,
  crewAvatarPrompt,
  crewAvatarSlug,
  type CrewPersona,
} from "../lib/workspace/crew-avatars";
import type { RoleKey } from "../lib/workspace/contracts/roster";
import { RECRAFT_FLASH_MODEL, recraftCostMicroUsd, type RecraftSize } from "../convex/ai/pricing";
import type { RecraftImageRequest } from "../convex/ai/providers/recraft";
import type { ImageResult } from "../convex/ai/providers/types";

export const CREW_AVATAR_SIZE: RecraftSize = "1024x1024";
const TIMEOUT_MS = 60_000;

export type CrewAvatarPlanItem = {
  readonly roleKey: RoleKey;
  readonly employeeName: string;
  readonly file: string;
  readonly prompt: string;
};

export type CrewAvatarPlan = {
  readonly styleVersion: string;
  readonly model: typeof RECRAFT_FLASH_MODEL;
  readonly size: RecraftSize;
  readonly items: readonly CrewAvatarPlanItem[];
  /** List price for the whole run. */
  readonly totalMicroUsd: number;
};

/** `only` limits the run to some roles; an unknown role is refused. */
export function planCrewAvatars(only?: readonly string[]): CrewAvatarPlan {
  let personas: readonly CrewPersona[] = CREW_PERSONAS;
  if (only !== undefined && only.length > 0) {
    const known = new Set<string>(CREW_PERSONAS.map((p) => p.roleKey));
    const unknown = only.filter((key) => !known.has(key));
    if (unknown.length > 0) throw new Error(`unknown crew role: ${unknown.join(", ")}`);
    const wanted = new Set(only);
    personas = CREW_PERSONAS.filter((p) => wanted.has(p.roleKey));
  }
  const items = personas.map((persona) => ({
    roleKey: persona.roleKey,
    employeeName: persona.employeeName,
    file: `${crewAvatarSlug(persona)}.png`,
    prompt: crewAvatarPrompt(persona),
  }));
  return {
    styleVersion: CREW_AVATAR_STYLE_VERSION,
    model: RECRAFT_FLASH_MODEL,
    size: CREW_AVATAR_SIZE,
    items,
    totalMicroUsd: items.length === 0 ? 0 : recraftCostMicroUsd({ size: CREW_AVATAR_SIZE, model: RECRAFT_FLASH_MODEL, count: items.length }),
  };
}

/** The one request shape the run sends: Flash, square, no style id. */
export function crewAvatarRequest(item: CrewAvatarPlanItem): RecraftImageRequest {
  return { prompt: item.prompt, size: CREW_AVATAR_SIZE, model: RECRAFT_FLASH_MODEL, timeoutMs: TIMEOUT_MS };
}

export type CrewAvatarAdapter = {
  readonly provider: "recraft";
  generate(request: RecraftImageRequest): Promise<ImageResult>;
};

export type CrewAvatarManifestEntry = CrewAvatarPlanItem & {
  readonly model: string;
  readonly billedAs: string;
  readonly microUsd: number;
};

export type CrewAvatarManifest = {
  readonly styleVersion: string;
  readonly generatedAt: string;
  readonly entries: readonly CrewAvatarManifestEntry[];
  readonly totalMicroUsd: number;
};

/**
 * Renders each planned avatar in order and writes its PNG through `write`.
 * Stops at the first failure (the error propagates; files already written stay).
 */
export async function generateCrewAvatars(args: {
  readonly plan: CrewAvatarPlan;
  readonly adapter: CrewAvatarAdapter;
  readonly write: (file: string, bytes: Uint8Array) => Promise<void>;
  readonly now?: () => Date;
  readonly onProgress?: (entry: CrewAvatarManifestEntry) => void;
}): Promise<CrewAvatarManifest> {
  if (args.adapter.provider !== "recraft") throw new Error("crew avatars render on Recraft only");
  const entries: CrewAvatarManifestEntry[] = [];
  for (const item of args.plan.items) {
    const result = await args.adapter.generate(crewAvatarRequest(item));
    if (result.model !== RECRAFT_FLASH_MODEL) {
      throw new Error(`expected ${RECRAFT_FLASH_MODEL}, the adapter reported ${result.model}`);
    }
    if (result.image.kind !== "bytes") {
      throw new Error(`${item.file}: expected PNG bytes (response_format b64_json), got a ${result.image.kind}`);
    }
    await args.write(item.file, result.image.bytes);
    const entry = { ...item, model: result.model, billedAs: result.cost.billedAs, microUsd: result.cost.microUsd };
    entries.push(entry);
    args.onProgress?.(entry);
  }
  return {
    styleVersion: args.plan.styleVersion,
    generatedAt: (args.now ?? (() => new Date()))().toISOString(),
    entries,
    totalMicroUsd: entries.reduce((sum, e) => sum + e.microUsd, 0),
  };
}

/** A contact sheet for review: every avatar at the sizes the product uses. */
export function contactSheetHtml(manifest: Pick<CrewAvatarManifest, "styleVersion" | "entries">): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rows = manifest.entries
    .map(
      (e) => `<figure>
  <img src="${escape(e.file)}" alt="${escape(e.employeeName)}" width="160" height="160">
  <div class="sizes">${[40, 28, 20].map((s) => `<img src="${escape(e.file)}" alt="" width="${s}" height="${s}">`).join("")}</div>
  <figcaption><strong>${escape(e.employeeName)}</strong> · ${escape(e.roleKey)}</figcaption>
</figure>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crew avatars ${escape(manifest.styleVersion)}</title>
<style>
body{margin:0;padding:24px;background:#f7f3ec;color:#1a1814;font:14px/1.5 system-ui,sans-serif}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:20px}
figure{margin:0;background:#fffdf9;border:1px solid #e4dccd;border-radius:12px;padding:12px;text-align:center}
img{border-radius:50%;display:inline-block}
.sizes{display:flex;gap:8px;justify-content:center;align-items:center;margin:8px 0}
</style></head>
<body><h1>Crew avatars <small>${escape(manifest.styleVersion)}</small></h1><main>
${rows}
</main></body></html>
`;
}
