/**
 * WP71-S3. The prompt registry (`02` §5.3): `id@version` → spec.
 *
 * Prompts live in code (`convex/ai/prompts/`), never in the database. The
 * registry is built once, at import, from `PROMPT_ENTRIES`. Each spec is first
 * copied to plain data (`snapshotSpec`: every field read once, `thinking` and
 * `cacheLayout` copied and frozen), and that copy is what is validated and
 * registered, so a getter cannot pass validation with one value and register
 * another. The registry refuses:
 * - an entry whose spec fails C-PROMPT validation (`PromptSpecError`);
 * - two entries with the same `id@version` (`DUPLICATE_REF`);
 * - two versions of one id with the same content (`DUPLICATE_CONTENT`): a
 *   version bump must change something.
 *
 * Content (`promptContent`) is what `scripts/check-prompt-versions.mjs` hashes
 * against `convex/ai/prompts/versions.lock.json`:
 * - `system`: the system block text;
 * - `task`: the `buildUser` source and its output for the entry's sample inputs;
 * - `outputSchema`: the zod schema as JSON Schema, as the gateway sends it;
 * - `run`: the router's full output (`routeSpec`: provider, resolved model,
 *   effort, thinking, maxTokens, input ceiling, mode) plus tier, purpose, cache
 *   layout and fallbacks, so an `id@version` on an `ai_usage` row names one exact
 *   call shape, and a change to `TIER_MODELS` or a ceiling fails a locked version.
 * The script adds a fifth part, `module`: the source of the spec's module and its
 * repo-local imports. It needs the file system, which this file must not touch.
 * `canonicalJson` sorts object keys at every depth, so the key order in a spec
 * file never changes the hash.
 *
 * Pure and deterministic: no env, no network, no Node built-ins (so it also
 * loads in the default Convex runtime). Imports carry `.ts` extensions so the
 * version check can load this file under `node --experimental-strip-types`.
 */

import { z } from "zod";

import { parsePromptRef, promptRef } from "../../lib/workspace/contracts/prompts.ts";
import { assertModulePath, validatedSpec, type PromptEntry, type RegisteredSpec } from "./prompts/entry.ts";
import { PROMPT_ENTRIES } from "./prompts/index.ts";
import { routeSpec } from "./router.ts";

export type { PromptEntry, RegisteredSpec } from "./prompts/entry.ts";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const PROMPT_REGISTRY_ERROR_CODES = [
  "MALFORMED_REF",
  "UNKNOWN_REF",
  "DUPLICATE_REF",
  "DUPLICATE_CONTENT",
  "UNCANONICAL_CONTENT",
] as const;

export type PromptRegistryErrorCode = (typeof PROMPT_REGISTRY_ERROR_CODES)[number];

export class PromptRegistryError extends Error {
  readonly code: PromptRegistryErrorCode;
  readonly ref: string;

  constructor(code: PromptRegistryErrorCode, ref: string, message: string) {
    super(message);
    this.name = "PromptRegistryError";
    this.code = code;
    this.ref = ref;
  }
}

export function isPromptRegistryError(value: unknown): value is PromptRegistryError {
  return value instanceof PromptRegistryError;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type PromptContent = {
  readonly system: string;
  readonly task: { readonly source: string; readonly sample: string };
  readonly outputSchema: Record<string, unknown>;
  readonly run: Record<string, unknown>;
};

export const PROMPT_CONTENT_PARTS = ["system", "task", "outputSchema", "run"] as const;
export type PromptContentPart = (typeof PROMPT_CONTENT_PARTS)[number];

/** The parts of a spec the version check fingerprints (see the file header). */
export function promptContent(entry: PromptEntry): PromptContent {
  const { spec } = entry;
  const outputSchema: Record<string, unknown> = { ...z.toJSONSchema(spec.outputSchema) };
  // Same drop as the gateway's `outputJsonSchema`: a document marker, not a constraint.
  delete outputSchema.$schema;
  return {
    system: spec.system,
    task: { source: String(spec.buildUser), sample: entry.renderSample() },
    outputSchema,
    run: {
      // Everything the router derives (provider, model, input ceiling) plus the
      // spec's own settings, so a change to `TIER_MODELS` or a lane ceiling
      // fails a locked version just like a text change does.
      ...routeSpec(spec),
      tier: spec.tier,
      purpose: spec.purpose ?? null,
      cacheLayout: spec.cacheLayout,
      fallbacks: spec.fallbacks,
    },
  };
}

/**
 * JSON with object keys sorted at every depth and `undefined` properties left
 * out. Arrays keep their order. Throws on a value JSON cannot carry exactly
 * (a function, a bigint, a non-finite number, a non-plain object).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: non-finite number ${value}`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError("canonicalJson: only plain objects are supported");
    }
    const record = value as Record<string, unknown>;
    const fields = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
    return `{${fields.join(",")}}`;
  }
  throw new TypeError(`canonicalJson: unsupported ${typeof value}`);
}

/** The canonical string of one content part, for per-part hashes. */
export function promptContentPartKey(content: PromptContent, part: PromptContentPart): string {
  return canonicalJson(content[part]);
}

/** The canonical string of all of a spec's content. Equal strings ⇔ equal content. */
export function promptContentKey(entry: PromptEntry): string {
  return canonicalJson(promptContent(entry));
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type PromptRegistry = {
  /** The spec for `"id@version"`. Throws `PromptRegistryError` on a malformed or unknown ref. */
  readonly getSpec: (ref: string) => RegisteredSpec;
  readonly getEntry: (ref: string) => PromptEntry;
  /** Every registered spec, ordered by id, then version. */
  readonly listSpecs: () => readonly RegisteredSpec[];
  readonly listEntries: () => readonly PromptEntry[];
};

export function createPromptRegistry(entries: readonly PromptEntry[]): PromptRegistry {
  const byRef = new Map<string, PromptEntry>();
  const contentByIdAndKey = new Map<string, string>();

  for (const entry of entries) {
    // Re-validate a plain-data snapshot: an entry built without `promptEntry`,
    // or a spec with accessors, must not slip in.
    const spec = validatedSpec(entry.spec);
    const ref = promptRef(spec);
    assertModulePath(entry.module);
    if (typeof entry.renderSample !== "function") {
      throw new TypeError(`prompt registry: ${ref} entry needs renderSample`);
    }
    const safe: PromptEntry = Object.freeze({
      spec,
      module: entry.module,
      internal: entry.internal === true,
      renderSample: entry.renderSample,
    });
    if (byRef.has(ref)) {
      throw new PromptRegistryError("DUPLICATE_REF", ref, `prompt registry: ${ref} is registered twice`);
    }
    let key: string;
    try {
      key = promptContentKey(safe);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new PromptRegistryError("UNCANONICAL_CONTENT", ref, `prompt registry: ${ref} content cannot be fingerprinted: ${reason}`);
    }
    const idKey = `${spec.id}\u0000${key}`;
    const twin = contentByIdAndKey.get(idKey);
    if (twin !== undefined) {
      throw new PromptRegistryError(
        "DUPLICATE_CONTENT",
        ref,
        `prompt registry: ${ref} has the same content as ${twin}; a new version must change the text, schema or run settings`,
      );
    }
    contentByIdAndKey.set(idKey, ref);
    byRef.set(ref, safe);
  }

  const ordered = [...byRef.values()].sort(
    (a, b) => (a.spec.id < b.spec.id ? -1 : a.spec.id > b.spec.id ? 1 : a.spec.version - b.spec.version),
  );
  const orderedEntries: readonly PromptEntry[] = Object.freeze(ordered);
  const orderedSpecs: readonly RegisteredSpec[] = Object.freeze(ordered.map((entry) => entry.spec));

  function getEntry(ref: string): PromptEntry {
    const text: unknown = ref;
    if (typeof text !== "string" || parsePromptRef(text) === null) {
      throw new PromptRegistryError("MALFORMED_REF", String(text), `prompt ref must be "id@version", got ${JSON.stringify(text)}`);
    }
    const entry = byRef.get(text);
    if (entry === undefined) {
      throw new PromptRegistryError("UNKNOWN_REF", text, `prompt registry has no ${text}`);
    }
    return entry;
  }

  return Object.freeze({
    getSpec: (ref: string) => getEntry(ref).spec,
    getEntry,
    listSpecs: () => orderedSpecs,
    listEntries: () => orderedEntries,
  });
}

const defaultRegistry = createPromptRegistry(PROMPT_ENTRIES);

/** The registered spec for `"id@version"`; throws `PromptRegistryError` (`MALFORMED_REF` / `UNKNOWN_REF`). */
export function getSpec(ref: string): RegisteredSpec {
  return defaultRegistry.getSpec(ref);
}

export function getEntry(ref: string): PromptEntry {
  return defaultRegistry.getEntry(ref);
}

/** Every registered spec, ordered by id, then version. */
export function listSpecs(): readonly RegisteredSpec[] {
  return defaultRegistry.listSpecs();
}

export function listEntries(): readonly PromptEntry[] {
  return defaultRegistry.listEntries();
}
