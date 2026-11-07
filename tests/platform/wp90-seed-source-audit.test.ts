// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bakerySeedDraft, hydrotrailSeedDraft } from "@/lib/workspace/contracts/fixtures/seeds";
import {
  bakeryManifestRow,
  bakeryPageMdx,
  hydrotrailManifestRow,
  hydrotrailPageMdx,
} from "@/lib/workspace/contracts/fixtures/seedSources";
import { auditSeedDraft, isCategoryName, normaliseForMatch } from "@/lib/workspace/crew/seedAudit";
import {
  SEED_SOURCE_LIMITS,
  SeedSourceError,
  seedSourceFromPage,
  seedSourceJson,
  sourceText,
  type SeedSourceManifestRow,
} from "@/lib/workspace/crew/seedSource";

const hydrotrail = seedSourceFromPage({ mdx: hydrotrailPageMdx, manifest: hydrotrailManifestRow });
const bakery = seedSourceFromPage({ mdx: bakeryPageMdx, manifest: bakeryManifestRow });

describe("WP90-S2 seed source", () => {
  it("splits the page into sections, steps and build prompts", () => {
    expect(Object.keys(hydrotrail.sections)).toEqual([
      "problem",
      "solution",
      "competitiveLandscape",
      "businessModel",
      "techStack",
    ]);
    expect(hydrotrail.howItWorks).toEqual([
      "Enter your route — distance, climb and the forecast",
      "Get your plan — litres to carry and when to drink",
      "Log what you drank — one tap",
    ]);
    expect(hydrotrail.prompts.map((p) => p.title)).toEqual(["Project Setup", "Core Feature"]);
    expect(hydrotrail.prompts[0]?.text).toContain("Do not build: billing");
    expect(hydrotrail.sections.problem).not.toContain("---");
  });

  it("keeps validation facts out of the prompt input", () => {
    expect(bakery.researchLevel).toBe("concept");
    expect(bakery.auditPassed).toBe(false);
    const json = JSON.parse(seedSourceJson(bakery)) as Record<string, unknown>;
    expect(json).not.toHaveProperty("researchLevel");
    expect(json).not.toHaveProperty("auditPassed");
  });

  it("refuses a page without Problem and Solution, or a slug mismatch", () => {
    expect(() =>
      seedSourceFromPage({ mdx: "## Sources\n- x", manifest: hydrotrailManifestRow }),
    ).toThrow(SeedSourceError);
    expect(() =>
      seedSourceFromPage({ mdx: hydrotrailPageMdx, manifest: { ...hydrotrailManifestRow, slug: "other" } }),
    ).toThrow(SeedSourceError);
  });

  it("builds a bounded source for every published idea", () => {
    const root = process.cwd();
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "ideas/manifest.json"), "utf8")) as
      | SeedSourceManifestRow[]
      | { ideas: SeedSourceManifestRow[] };
    const rows = Array.isArray(manifest) ? manifest : manifest.ideas;
    expect(rows.length).toBeGreaterThan(200);
    for (const row of rows) {
      const file = path.join(root, "content/ideas", `${row.slug}.mdx`);
      if (!fs.existsSync(file)) continue;
      const source = seedSourceFromPage({ mdx: fs.readFileSync(file, "utf8"), manifest: row });
      expect(seedSourceJson(source).length).toBeLessThanOrEqual(SEED_SOURCE_LIMITS.total);
      expect(source.sections.solution?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe("WP90-S2 seed audit", () => {
  it("passes the fixture drafts against their own pages", () => {
    const result = auditSeedDraft(hydrotrailSeedDraft, hydrotrail);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.seed.validated).toBe(true);
  });

  it("marks a concept idea unvalidated and drops its market", () => {
    const result = auditSeedDraft(bakerySeedDraft, bakery);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.seed.validated).toBe(false);
    expect(result.seed.blueprint.market).toBeUndefined();
    expect(result.seed.blueprint.ideaSlug).toBe(bakery.slug);
  });

  it("rejects a quote the page does not contain", () => {
    const draft = structuredClone(hydrotrailSeedDraft);
    draft.landingSeeds.buyerWords = [{ quote: "This app changed my life.", attribution: "A hiker" }];
    expect(auditSeedDraft(draft, hydrotrail)).toEqual({
      ok: false,
      issues: [{ code: "quote_not_in_source", path: "landingSeeds.buyerWords.0.quote" }],
    });
  });

  it("matches a quote across curly quotes and spacing", () => {
    const draft = structuredClone(hydrotrailSeedDraft);
    draft.landingSeeds.buyerWords = [{ quote: "“I always run  dry on the last climb”", attribution: "A hiker" }];
    expect(auditSeedDraft(draft, hydrotrail).ok).toBe(true);
  });

  it("rejects an invented brand but accepts a category", () => {
    const draft = structuredClone(hydrotrailSeedDraft);
    draft.blueprint.market = {
      summary: "Hikers guess.",
      competitors: [
        { name: "AquaPath Pro", note: "Invented." },
        { name: "Generic water reminder apps", note: "Fixed targets." },
      ],
    };
    expect(auditSeedDraft(draft, hydrotrail)).toEqual({
      ok: false,
      issues: [{ code: "competitor_not_in_source", path: "blueprint.market.competitors.0.name" }],
    });
    expect(isCategoryName("Route planners")).toBe(true);
    expect(isCategoryName("Strava")).toBe(false);
    expect(isCategoryName("Garmin Connect")).toBe(false);
  });

  it("reports schema failures by path, never echoing values", () => {
    const result = auditSeedDraft({ ...hydrotrailSeedDraft, blueprint: { pitch: 1 } }, hydrotrail);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.every((issue) => issue.code === "schema")).toBe(true);
      expect(JSON.stringify(result.issues)).not.toContain("1");
    }
  });

  it("normalises typography for matching only", () => {
    expect(normaliseForMatch("“Hi” — it’s  **fine**")).toBe('"hi" - it\'s fine');
    expect(sourceText(hydrotrail)).toContain("I always run dry on the last climb.");
  });
});
