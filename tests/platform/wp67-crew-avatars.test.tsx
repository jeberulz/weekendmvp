import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ROLE_CATALOGUE } from "@/convex/crew/roles";
import { createRecraftAdapter } from "@/convex/ai/providers/recraft";
import type { ImageResult } from "@/convex/ai/providers/types";
import { EmployeeAvatar } from "@/components/workspace/kit/EmployeeAvatar";
import { ROLE_KEYS } from "@/lib/workspace/contracts/roster";
import {
  CREW_AVATAR_SRC,
  CREW_AVATAR_STYLE,
  CREW_PERSONAS,
  crewAvatarPrompt,
  crewAvatarPublicPath,
  crewAvatarSlug,
} from "@/lib/workspace/crew-avatars";
import {
  contactSheetHtml,
  crewAvatarRequest,
  generateCrewAvatars,
  planCrewAvatars,
  type CrewAvatarAdapter,
} from "@/scripts/generate-crew-avatars-core";

const root = process.cwd();

describe("crew personas (WP67-S7)", () => {
  it("cover every role once, with the roster's default names", () => {
    expect(CREW_PERSONAS.map((p) => p.roleKey)).toEqual([...ROLE_KEYS]);
    const names = new Map(ROLE_CATALOGUE.map((entry) => [entry.key, entry.employeeName]));
    for (const persona of CREW_PERSONAS) expect(persona.employeeName).toBe(names.get(persona.roleKey));
    expect(new Set(CREW_PERSONAS.map(crewAvatarSlug)).size).toBe(CREW_PERSONAS.length);
  });

  it("share one style prompt and keep the image free of text", () => {
    for (const persona of CREW_PERSONAS) {
      const prompt = crewAvatarPrompt(persona);
      expect(prompt.startsWith(CREW_AVATAR_STYLE)).toBe(true);
      expect(prompt).toContain(persona.accent);
      expect(persona.accent).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(CREW_AVATAR_STYLE).toContain("No text");
    expect(crewAvatarPublicPath(CREW_PERSONAS[0])).toBe("/image/crew/lead-wren.png");
  });

  it("only lists shipped avatars that exist under public/", () => {
    for (const [role, src] of Object.entries(CREW_AVATAR_SRC)) {
      expect(ROLE_KEYS).toContain(role);
      expect(src.startsWith("/image/crew/")).toBe(true);
      expect(existsSync(path.join(root, "public", src))).toBe(true);
    }
  });
});

describe("planCrewAvatars", () => {
  it("prices the full set on V4.1 Flash: 13 × $0.007", () => {
    const plan = planCrewAvatars();
    expect(plan).toMatchObject({ model: "recraftv4_1_flash", size: "1024x1024", totalMicroUsd: 91_000 });
    expect(plan.items).toHaveLength(13);
    expect(plan.items[0]).toMatchObject({ roleKey: "lead", employeeName: "Wren", file: "lead-wren.png" });
  });

  it("limits to named roles and refuses unknown ones", () => {
    expect(planCrewAvatars(["brand", "seo"]).items.map((i) => i.employeeName)).toEqual(["Iris", "Sana"]);
    expect(planCrewAvatars(["brand"]).totalMicroUsd).toBe(7_000);
    expect(() => planCrewAvatars(["designer"])).toThrow(/unknown crew role/);
  });

  it("sends Flash, square, with no style id", () => {
    const request = crewAvatarRequest(planCrewAvatars(["lead"]).items[0]);
    expect(request).toMatchObject({ model: "recraftv4_1_flash", size: "1024x1024" });
    expect(request.styleId).toBeUndefined();
  });
});

describe("generateCrewAvatars", () => {
  it("renders every avatar through the Recraft fixture adapter and writes each PNG", async () => {
    const adapter = createRecraftAdapter({ env: {} });
    const spy = vi.spyOn(adapter, "generate");
    const written = new Map<string, Uint8Array>();
    const manifest = await generateCrewAvatars({
      plan: planCrewAvatars(),
      adapter,
      write: async (file, bytes) => void written.set(file, bytes),
      now: () => new Date("2026-11-07T00:00:00Z"),
    });
    expect(spy).toHaveBeenCalledTimes(13);
    for (const [request] of spy.mock.calls) {
      expect(request.model).toBe("recraftv4_1_flash");
      expect(request.styleId).toBeUndefined();
    }
    expect(written.size).toBe(13);
    expect(manifest).toMatchObject({ styleVersion: "crew-avatars-v1", generatedAt: "2026-11-07T00:00:00.000Z", totalMicroUsd: 91_000 });
    expect(manifest.entries[0].billedAs).toBe("recraftv4_1_flash 1024x1024 (fixture)");
    expect(contactSheetHtml(manifest)).toContain('alt="Wren"');
  });

  it("stops at the first failure and never tries another provider", async () => {
    let calls = 0;
    const adapter: CrewAvatarAdapter = {
      provider: "recraft",
      generate: async () => {
        calls += 1;
        throw new Error("Recraft returned 503");
      },
    };
    const write = vi.fn(async () => undefined);
    await expect(generateCrewAvatars({ plan: planCrewAvatars(), adapter, write })).rejects.toThrow("503");
    expect(calls).toBe(1);
    expect(write).not.toHaveBeenCalled();
  });

  it("refuses a result from any model but Flash, and a URL instead of bytes", async () => {
    const result = (overrides: Partial<ImageResult>): ImageResult => ({
      provider: "recraft",
      model: "recraftv4_1_flash",
      size: "1024x1024",
      image: { kind: "bytes", bytes: new Uint8Array([1]), mimeType: "image/png" },
      cost: { provider: "recraft", billedAs: "x", microUsd: 7_000, estimated: true, units: { images: 1 }, rateCard: "2026-11-07" },
      ...overrides,
    });
    const run = (r: ImageResult) =>
      generateCrewAvatars({
        plan: planCrewAvatars(["lead"]),
        adapter: { provider: "recraft", generate: async () => r },
        write: async () => undefined,
      });
    await expect(run(result({ model: "gpt-image-2" }))).rejects.toThrow(/expected recraftv4_1_flash/);
    await expect(run(result({ image: { kind: "url", url: "https://example.com/a.png" } }))).rejects.toThrow(/PNG bytes/);
  });

  it("has no OpenAI image path in the generator", () => {
    for (const file of ["scripts/generate-crew-avatars-core.ts", "scripts/generate-crew-avatars.mjs"]) {
      expect(readFileSync(path.join(root, file), "utf8")).not.toMatch(/openaiImages|gpt-image|createOpenAi/i);
    }
  });
});

describe("EmployeeAvatar", () => {
  it("keeps the initial and the accessible name while no asset exists", () => {
    const html = renderToStaticMarkup(<EmployeeAvatar name="Iris" role="brand" avatarSrc={null} />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Iris, Brand (AI employee)"');
    expect(html).toContain(">I</span>");
    expect(html).not.toContain("<img");
  });

  it("shows the avatar as a decorative image under the same name", () => {
    const html = renderToStaticMarkup(<EmployeeAvatar name="Iris" role="brand" size="lg" avatarSrc="/image/crew/brand-iris.png" />);
    expect(html).toContain('aria-label="Iris, Brand (AI employee)"');
    expect(html).toMatch(/<img[^>]*alt=""/);
    expect(html).toMatch(/<img[^>]*width="40"/);
    expect(html).not.toContain(">I</span>");
  });
});
