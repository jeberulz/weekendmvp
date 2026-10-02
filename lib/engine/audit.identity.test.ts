/**
 * What the page claims to be: research mode and manifest highlights (WP46
 * rulings R10 and R11; final review P2-8 and P2-9).
 *
 *   - R11: a fixture-mode record (synthetic research) backs only an
 *     engine-draft-* page. The reviewer's out-p8 run compiled the fixture to
 *     a public slug and the deep audit passed; the auditor now fails it.
 *   - P2-9: the compiler writes the manifest `highlights` block from the
 *     record's selected evidence; an engine page whose manifest row carries
 *     other highlights (the reviewer's invented block passed the shape
 *     validator) fails. The row's provenance.researchMode must be the
 *     record's mode.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  auditCli,
  auditPage,
  cleanupTempDirs,
  compiledPage,
  pageBody,
  REPO_ROOT,
  writeManifest,
  writePage,
} from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord, EV, FIXTURE_PAGE_SLUG } from "./__fixtures__/recordV2.ts";
import { auditEngineArtifact } from "./artifact-audit.ts";
import { compileResearchRecord, type ManifestEntry } from "./compile.ts";
import { formatAmount } from "./evidence/amount.ts";
import type { ResearchRecordV2 } from "./evidence/contract.ts";
import { ideaHighlights, marketSignalLabel } from "./page-format.ts";

afterEach(cleanupTempDirs);

const TIMEOUT = 120_000;
const PUBLIC_SLUG = "signalpass";

function errorsOf(result: { errors: string[] }): string {
  return result.errors.join("\n");
}

function compileTo(record: ResearchRecordV2, slug: string, allowFixture = false): { mdx: string; manifestEntry: ManifestEntry } {
  return compileResearchRecord({ record, slug, publishedAt: "2026-10-01", allowFixture });
}

/** The reviewer's p11 block: shape-valid, none of it from the record. */
const INVENTED_HIGHLIGHTS = {
  problemQuote: "We review 47 PRs a week on a team of 8 and it eats our evenings.",
  stats: [{ value: "60%", label: "of engineering time spent reviewing PRs", source: "HN thread" }],
  competitors: [
    { name: "CodeRabbit", price: "$19/user/mo" },
    { name: "Graphite", price: "free" },
    { name: "Qodo", price: "$9/mo" },
  ],
};

async function validateHighlights(value: unknown): Promise<unknown> {
  const mod: unknown = await import(pathToFileURL(path.join(REPO_ROOT, "scripts", "validate-idea-tags.mjs")).href);
  if (typeof mod !== "object" || mod === null || !("validateHighlights" in mod) || typeof mod.validateHighlights !== "function") {
    throw new Error("validateHighlights export missing");
  }
  return mod.validateHighlights(value);
}

describe("a fixture-mode record backs only an engine-draft-* page (R11, P2-8)", () => {
  it(
    "fails the reviewer's out-p8 case through the CLI: fixture record, public slug",
    async () => {
      const record = buildFixtureRecord();
      expect(record.mode).toBe("fixture");
      const { mdx } = compileTo(record, PUBLIC_SLUG, true);
      const { code, result } = await auditCli(writePage(mdx, record, PUBLIC_SLUG));
      expect(code).toBe(1);
      expect(errorsOf(result)).toContain(
        `research record mode is "fixture" (synthetic research) but the page slug '${PUBLIC_SLUG}' is not an engine-draft-* draft; fixture output never reaches a public page (ruling R11)`,
      );
    },
    TIMEOUT,
  );

  it("passes the same fixture record behind an engine-draft-* slug, and a live record behind a public slug", async () => {
    expect((await auditPage(compiledPage())).errors).toEqual([]);
    const live = buildFixtureRecord((r) => {
      r.mode = "live";
    });
    const { mdx } = compileTo(live, PUBLIC_SLUG);
    expect((await auditPage(mdx, live, { slug: PUBLIC_SLUG })).errors).toEqual([]);
  });
});

describe("manifest highlights are generated from the record (P2-9)", () => {
  it("compiles highlights in the homepage shape from selected evidence, and the shape validator accepts them", async () => {
    const record = buildFixtureRecord();
    const { manifestEntry } = compileTo(record, FIXTURE_PAGE_SLUG);
    const highlights = manifestEntry.highlights;
    expect(highlights).toEqual(ideaHighlights(record));
    expect(highlights?.problemQuote).toBe(EV.quoteHn.excerpt.replace(/\s+/g, " ").trim());
    expect(highlights?.stats[0]).toEqual({
      value: formatAmount(EV.statMeasured.amount),
      label: `${marketSignalLabel(EV.statMeasured)} in 2025`,
      source: EV.statMeasured.sourceTitle,
    });
    expect(highlights?.stats.every((s) => s.value.length <= 12)).toBe(true);
    expect(await validateHighlights(highlights)).toEqual([]);
    expect(manifestEntry.provenance.researchMode).toBe("fixture");
  });

  it("passes an engine page whose manifest row carries the generated highlights", async () => {
    const record = buildFixtureRecord();
    const { mdx, manifestEntry } = compileTo(record, FIXTURE_PAGE_SLUG);
    expect((await auditPage(mdx, record, { manifestRow: manifestEntry })).errors).toEqual([]);
  });

  it("fails the reviewer's invented highlights, which pass the shape validator (p11)", async () => {
    expect(await validateHighlights(INVENTED_HIGHLIGHTS)).toEqual([]);
    const record = buildFixtureRecord();
    const { mdx, manifestEntry } = compileTo(record, FIXTURE_PAGE_SLUG);
    const errors = errorsOf(await auditPage(mdx, record, { manifestRow: { ...manifestEntry, highlights: INVENTED_HIGHLIGHTS } }));
    expect(errors).toMatch(new RegExp(`manifest row for ${FIXTURE_PAGE_SLUG}: highlights\\.problemQuote is not what the record generates`));
    expect(errors).toMatch(/highlights come from engine:compile, never by hand/);
  });

  it("fails one changed stat value, and highlights on a record that generates none", async () => {
    const record = buildFixtureRecord();
    const { mdx, manifestEntry } = compileTo(record, FIXTURE_PAGE_SLUG);
    const generated = manifestEntry.highlights;
    if (!generated) throw new Error("fixture: no highlights generated");
    const changed = { ...generated, stats: generated.stats.map((s, i) => (i === 0 ? { ...s, value: "$2.1 billion" } : s)) };
    expect(errorsOf(await auditPage(mdx, record, { manifestRow: { ...manifestEntry, highlights: changed } }))).toMatch(
      /highlights\.stats is not what the record generates/,
    );

    // Every selected quote longer than the 190-character slot: no highlights can be generated.
    const tampered = structuredClone(record);
    for (const item of tampered.evidence.accepted) {
      if (item.kind === "community_quote") item.excerpt = `${item.excerpt} ${"and the queue keeps growing ".repeat(8)}`.trim();
    }
    expect(ideaHighlights(tampered)).toBeUndefined();
    const errors = auditEngineArtifact(pageBody(mdx), tampered, { slug: FIXTURE_PAGE_SLUG, manifestRow: { highlights: generated } }).errors;
    expect(errors.join("\n")).toContain(`manifest row for ${FIXTURE_PAGE_SLUG}: highlights are present but the record generates none; remove them`);
  });

  it("fails a manifest row whose provenance.researchMode is not the record's mode", async () => {
    const record = buildFixtureRecord();
    const { mdx, manifestEntry } = compileTo(record, FIXTURE_PAGE_SLUG);
    const row = { ...manifestEntry, provenance: { ...manifestEntry.provenance, researchMode: "live" } };
    expect(errorsOf(await auditPage(mdx, record, { manifestRow: row }))).toContain(
      `manifest row for ${FIXTURE_PAGE_SLUG}: provenance.researchMode "live" does not match the record's mode "fixture"`,
    );
  });

  it(
    "reads the row from --manifest in the CLI and exits 1 on invented highlights",
    async () => {
      const record = buildFixtureRecord();
      const { mdx, manifestEntry } = compileTo(record, FIXTURE_PAGE_SLUG);
      const files = writePage(mdx, record);
      const clean = await auditCli(files, ["--manifest", writeManifest(files, [manifestEntry])]);
      expect(clean.result.errors).toEqual([]);
      expect(clean.code).toBe(0);
      const invented = await auditCli(files, ["--manifest", writeManifest(files, [{ ...manifestEntry, highlights: INVENTED_HIGHLIGHTS }])]);
      expect(invented.code).toBe(1);
      expect(errorsOf(invented.result)).toMatch(/highlights\.problemQuote is not what the record generates/);
    },
    TIMEOUT,
  );
});
