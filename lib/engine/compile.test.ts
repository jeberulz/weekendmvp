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
import { parseResearchRecord } from "./research-record.ts";

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
