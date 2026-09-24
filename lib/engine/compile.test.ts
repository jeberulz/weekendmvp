/**
 * Compiler tests (Mode A2 phase 6).
 * Compiles a fixture ResearchRecord into a temp dir and runs the MDX auditor.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { compileResearchRecord, escapeMdxProse } from "./compile.ts";
import { writeCompiledIdea } from "./compile-write.ts";
import { createProviders } from "./providers.ts";
import { runResearch } from "./pipeline.ts";
import {
  parseResearchRecord,
  type ResearchRecord,
} from "./research-record.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function loadAuditor() {
  const mod = await import(
    pathToFileURL(path.join(root, "scripts/audit-idea-mdx.mjs")).href
  );
  return mod as {
    auditIdeaFile: (
      filePath: string,
      slugHint: string,
    ) => {
      ok: boolean;
      errors: string[];
      metrics?: { wordCount: number; howToStepCount: number };
    };
  };
}

describe("compileResearchRecord", () => {
  it("escapes MDX JSX traps", () => {
    expect(escapeMdxProse("use <div> and {foo}")).toBe(
      "use \\<div> and \\{foo}",
    );
  });

  it("emits engine: source and seven sections + Sources", async () => {
    const providers = createProviders({ mode: "fixture" });
    const record = await runResearch({
      brief: {
        title: "AI RFP Response Assistant",
        audience: "SMB SaaS sales",
        revenueModel: "Seat SaaS",
        seedKeywords: [
          "rfp response software",
          "security questionnaire automation",
          "proposal management software",
        ],
        slug: "ai-rfp-response-assistant",
      },
      providers,
      ranAt: "2026-09-24T00:00:00.000Z",
    });
    parseResearchRecord(record);

    const throwawaySlug = "engine-compile-test-draft";
    const compiled = compileResearchRecord({
      record,
      slug: throwawaySlug,
    });
    expect(compiled.manifestEntry.source).toBe(`engine:${throwawaySlug}`);
    expect(compiled.manifestEntry.source).not.toMatch(/ideabrowser/);
    expect(compiled.mdx).toContain("## The Problem");
    expect(compiled.mdx).toContain("## The Solution");
    expect(compiled.mdx).toContain("## Market Research");
    expect(compiled.mdx).toContain("## Competitive Landscape");
    expect(compiled.mdx).toContain("## Business Model");
    expect(compiled.mdx).toContain("## Recommended Tech Stack");
    expect(compiled.mdx).toContain("## AI Prompts to Build This");
    expect(compiled.mdx).toContain("## Sources");
    expect(compiled.mdx).toContain("**How it works:**");

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-compile-"));
    tempDirs.push(dir);
    const written = writeCompiledIdea({
      record,
      slug: throwawaySlug,
      ideasDir: dir,
      writeManifest: false,
      force: true,
    });

    const { auditIdeaFile } = await loadAuditor();
    const audit = auditIdeaFile(written.mdxPath, throwawaySlug);
    expect(audit.ok, audit.errors.join("; ")).toBe(true);
    expect(audit.metrics?.howToStepCount).toBeGreaterThanOrEqual(2);
    expect(audit.metrics?.wordCount).toBeGreaterThanOrEqual(800);
  });

  it("refuses overwrite without force", async () => {
    const providers = createProviders({ mode: "fixture" });
    const record = await runResearch({
      brief: {
        title: "AI RFP Response Assistant",
        audience: "SMB SaaS sales",
        revenueModel: "Seat SaaS",
        seedKeywords: [
          "rfp response software",
          "security questionnaire automation",
        ],
        slug: "ai-rfp-response-assistant",
      },
      providers,
    });

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-compile-"));
    tempDirs.push(dir);
    writeCompiledIdea({
      record,
      slug: "overwrite-me",
      ideasDir: dir,
      writeManifest: false,
    });
    expect(() =>
      writeCompiledIdea({
        record,
        slug: "overwrite-me",
        ideasDir: dir,
        writeManifest: false,
      }),
    ).toThrow(/refusing to overwrite/);
  });
});

async function fixtureRecord(): Promise<ResearchRecord> {
  return runResearch({
    brief: {
      title: "AI RFP Response Assistant",
      audience: "SMB SaaS sales",
      revenueModel: "Seat SaaS",
      seedKeywords: ["rfp response software"],
      slug: "ai-rfp-response-assistant",
    },
    providers: createProviders({ mode: "fixture" }),
    ranAt: "2026-09-24T00:00:00.000Z",
  });
}

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-compile-"));
  tempDirs.push(dir);
  return dir;
}

describe("compile safety", () => {
  it("leaves no MDX behind when the manifest check refuses", async () => {
    const record = await fixtureRecord();
    const dir = tempDir();
    const manifestPath = path.join(dir, "manifest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ ideas: [{ slug: "already-listed" }] }),
    );
    expect(() =>
      writeCompiledIdea({
        record,
        slug: "already-listed",
        ideasDir: path.join(dir, "ideas"),
        manifestPath,
      }),
    ).toThrow(/manifest entry/);
    expect(fs.existsSync(path.join(dir, "ideas", "already-listed.mdx"))).toBe(
      false,
    );
  });

  it("rejects slugs that would write outside the ideas dir", async () => {
    const record = await fixtureRecord();
    for (const slug of ["../escape", "a/b", "..", "UPPER case"]) {
      expect(() =>
        writeCompiledIdea({
          record,
          slug,
          ideasDir: tempDir(),
          writeManifest: false,
        }),
      ).toThrow(/must match/);
    }
  });

  it("escapes MDX traps in Sources, links, and frontmatter", async () => {
    const record = await fixtureRecord();
    record.brief.title = 'Tricky "quoted" <Title> {x}\nnext: line';
    record.market.stats[0]!.citation.title = "Report <2026> {draft] edition";
    record.market.stats[0]!.citation.url =
      "https://www.industryresearch.biz/report_(v2)?q={x}";

    const dir = tempDir();
    const slug = "engine-escape-test";
    const written = writeCompiledIdea({
      record,
      slug,
      ideasDir: dir,
      writeManifest: false,
    });

    const { auditIdeaFile } = await loadAuditor();
    const audit = auditIdeaFile(written.mdxPath, slug);
    expect(audit.ok, audit.errors.join("; ")).toBe(true);

    const frontTitle = written.mdx.split("\n")[2]!;
    expect(JSON.parse(frontTitle.replace(/^title: /, ""))).toBe(
      record.brief.title,
    );
    expect(written.mdx).toContain(
      "(https://www.industryresearch.biz/report_%28v2%29?q=%7Bx%7D)",
    );
  });

  it("refuses a record without howItWorks steps", async () => {
    const record = await fixtureRecord();
    delete record.howItWorks;
    expect(() => compileResearchRecord({ record })).toThrow(/howItWorks/);
  });

  it("uses the record's named steps and no RFP-specific copy", async () => {
    const record = await fixtureRecord();
    record.howItWorks = [
      "Capture — Snap a photo of the card",
      "Score — Get an authenticity score",
    ];
    const { mdx } = compileResearchRecord({ record, slug: "card-check" });
    expect(mdx).toContain("1. **Capture** — Snap a photo of the card");
    expect(mdx).not.toMatch(/\*\*Step 1\*\*/);
    for (const rfpOnly of [
      "proposal ops platforms",
      "legal will not sign off",
      "pgvector",
      "citation side panel",
      "Retrieve supporting evidence",
    ]) {
      expect(mdx).not.toContain(rfpOnly);
    }
  });

  it("never pads with stock filler phrases", async () => {
    const record = await fixtureRecord();
    const { mdx } = compileResearchRecord({ record, slug: "no-filler" });
    for (const phrase of [
      "Before you build, confirm the pain",
      "Add AI APIs, queues, or search only when a step",
      "This idea is for ",
      "Build a focused product for ",
    ]) {
      expect(mdx.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});

describe("compile review fixes (Codex)", () => {
  it("restores the previous MDX when a forced manifest write fails", async () => {
    const record = await fixtureRecord();
    const dir = tempDir();
    const ideasDir = path.join(dir, "ideas");
    fs.mkdirSync(ideasDir);
    const mdxPath = path.join(ideasDir, "keep-me.mdx");
    fs.writeFileSync(mdxPath, "ORIGINAL");
    // Parent of the manifest path is a file, so the manifest write throws.
    const blocker = path.join(dir, "not-a-dir");
    fs.writeFileSync(blocker, "");

    expect(() =>
      writeCompiledIdea({
        record,
        slug: "keep-me",
        ideasDir,
        manifestPath: path.join(blocker, "manifest.json"),
        force: true,
      }),
    ).toThrow();
    expect(fs.readFileSync(mdxPath, "utf8")).toBe("ORIGINAL");
  });

  it("refuses a record with fewer than two distinct sources", async () => {
    const record = await fixtureRecord();
    const only = "https://example.com/only-source";
    for (const s of record.market.stats) s.citation.url = only;
    for (const c of record.competitors) c.url = only;
    for (const s of record.community.signals) s.citation.url = only;
    expect(() => compileResearchRecord({ record })).toThrow(/distinct source/);
  });

  it("publishes timing from the timing score, never from execution", async () => {
    const record = await fixtureRecord();
    record.scores = {
      opportunity: 8,
      pain: 7,
      timing: 6,
      builderConfidence: 5,
      execution: 2,
    };
    const { manifestEntry } = compileResearchRecord({ record });
    expect(manifestEntry.scores).toEqual({
      opportunity: 8,
      pain: 7,
      timing: 6,
      builder_confidence: 5,
    });
  });

  it("omits scores entirely when the set is incomplete", async () => {
    const record = await fixtureRecord();
    record.scores = { opportunity: 8, pain: 7, execution: 6, builderConfidence: 5 };
    const { manifestEntry } = compileResearchRecord({ record });
    expect(manifestEntry.scores).toBeUndefined();
  });
});
