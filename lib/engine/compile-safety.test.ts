/**
 * F1 and F2 regressions. The assertions parse @mdx-js/mdx output, so a
 * backslash in the source cannot hide an expression.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@mdx-js/mdx";
import * as acorn from "acorn";
import { afterEach, describe, expect, it } from "vitest";

import { compileResearchRecord } from "./compile.ts";
import { createProviders } from "./providers.ts";
import { runResearch } from "./pipeline.ts";
import type { ResearchRecord } from "./research-record.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-safety-"));
  tempDirs.push(dir);
  return dir;
}

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

type AstNode = acorn.Node & {
  [key: string]: unknown;
};

function childNodes(node: AstNode): AstNode[] {
  const children: AstNode[] = [];
  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "type") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && "type" in item) {
          children.push(item as AstNode);
        }
      }
    } else if (value && typeof value === "object" && "type" in value) {
      children.push(value as AstNode);
    }
  }
  return children;
}

function numberValue(node: AstNode | undefined): number | null {
  if (!node || node.type !== "Literal") return null;
  const value = node.value;
  return typeof value === "number" ? value : null;
}

async function executableFindings(source: string): Promise<string[]> {
  const js = String(await compile(source, { format: "mdx" }));
  const ast = acorn.parse(js, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as AstNode;
  const findings: string[] = [];
  const walk = (node: AstNode): void => {
    if (node.type === "ImportDeclaration") {
      const sourceNode = node.source as AstNode | undefined;
      const imported =
        sourceNode && typeof sourceNode.value === "string" ? sourceNode.value : "";
      if (imported !== "react/jsx-runtime") findings.push(`import ${imported}`);
    }
    if (
      node.type === "ExportNamedDeclaration" ||
      node.type === "ExportAllDeclaration"
    ) {
      findings.push(node.type);
    }
    if (node.type === "BinaryExpression" && node.operator === "+") {
      const left = numberValue(node.left as AstNode | undefined);
      const right = numberValue(node.right as AstNode | undefined);
      if (left === 12345 && right === 67890) {
        findings.push("expression 12345 + 67890");
      }
    }
    if (node.type === "Identifier" && node.name === "Danger") {
      findings.push("jsx Danger");
    }
    if (node.type === "Literal" && typeof node.value === "string") {
      const value = node.value;
      if (/^javascript:/i.test(value)) findings.push(`javascript url ${value}`);
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && value.includes("@")) {
        const authority = value.slice(value.indexOf("//") + 2).split("/")[0] ?? "";
        if (authority.includes("@")) findings.push(`credential url ${value}`);
      }
    }
    for (const child of childNodes(node)) walk(child);
  };
  walk(ast);
  return findings;
}

async function compiledWith(narrative: string): Promise<string> {
  const record = await fixtureRecord();
  record.editorial = { ...record.editorial, problemNarrative: narrative };
  return compileResearchRecord({
    record,
    slug: "engine-draft-safety-probe",
  }).mdx;
}

describe("executable MDX regression", () => {
  it("keeps both backslash parities before a brace as text", async () => {
    for (const prefix of ["\\", "\\\\\\"]) {
      const mdx = await compiledWith(
        `The price note is ${prefix}{12345 + 67890} in the source.`,
      );
      expect(await executableFindings(mdx)).toEqual([]);
    }
  });

  it("keeps a plain brace, JSX, and a line-start import or export as text", async () => {
    const mdx = await compiledWith(
      [
        "A plain brace {12345 + 67890} stays text.",
        "<Danger>not a component</Danger>",
        "import x from \"fs\"",
        "export const pwned = 1",
      ].join("\n\n"),
    );
    expect(await executableFindings(mdx)).toEqual([]);
  });

  it("permits the same tokens inside a fenced block", async () => {
    const mdx = await compiledWith(
      [
        "The build prompt is fenced.",
        "```text",
        "import x from \"fs\"",
        "{12345 + 67890}",
        "\\{12345 + 67890}",
        "<Danger />",
        "```",
      ].join("\n"),
    );
    expect(await executableFindings(mdx)).toEqual([]);
  });

  it("does not execute an expression placed after an injected fence", async () => {
    const mdx = await compiledWith(
      ["Intro.", "```", "literal", "```", "\\{12345 + 67890}"].join("\n"),
    );
    expect(await executableFindings(mdx)).toEqual([]);
  });

  it("rejects non-HTTP destinations and credential URLs", async () => {
    const record = await fixtureRecord();
    record.competitors[0]!.url = "javascript:alert(1)";
    record.competitors[1]!.url = "https://user:pass@example.com/pricing";
    record.market.stats[0]!.citation.title = "Report \\{12345 + 67890}";
    record.market.stats[0]!.citation.url = "http://example.com/report";
    const mdx = compileResearchRecord({
      record,
      slug: "engine-draft-link-probe",
    }).mdx;
    expect(await executableFindings(mdx)).toEqual([]);
  });

  it("rejects a prose field above 100000 characters", async () => {
    const record = await fixtureRecord();
    record.editorial = {
      ...record.editorial,
      problemNarrative: "A".repeat(100_001),
    };
    expect(() =>
      compileResearchRecord({ record, slug: "engine-draft-size-probe" }),
    ).toThrow(/100000/);
  });

  it("leaves Unicode lookalikes as text", async () => {
    const mdx = await compiledWith("Fullwidth ｛12345 + 67890｝ and ＜Danger＞.");
    expect(await executableFindings(mdx)).toEqual([]);
  });
});

describe("public compile regression", () => {
  it("writes a non-draft slug under engine/drafts inside an explicit root", async () => {
    const record = await fixtureRecord();
    const dir = tempDir();
    const recordPath = path.join(dir, "record.json");
    fs.writeFileSync(recordPath, JSON.stringify(record));
    const sandbox = path.join(dir, "site");
    const publicIdeas = path.join(sandbox, "content", "ideas");
    const publicManifest = path.join(sandbox, "ideas", "manifest.json");
    fs.mkdirSync(publicIdeas, { recursive: true });
    fs.mkdirSync(path.dirname(publicManifest), { recursive: true });
    const manifestBefore = '{"ideas":[{"slug":"sentinel"}]}\n';
    fs.writeFileSync(publicManifest, manifestBefore);
    fs.writeFileSync(path.join(publicIdeas, "sentinel.mdx"), "KEEP\n");

    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        path.join(root, "scripts/engine-compile.mjs"),
        "--root",
        sandbox,
        "--record",
        recordPath,
        "--slug",
        "fresh-public-slug",
        "--force",
      ],
      { encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(
      fs.existsSync(path.join(sandbox, "engine/drafts/fresh-public-slug.mdx")),
    ).toBe(true);
    expect(fs.readdirSync(publicIdeas)).toEqual(["sentinel.mdx"]);
    expect(fs.readFileSync(publicManifest, "utf8")).toBe(manifestBefore);
    expect(fs.readFileSync(path.join(publicIdeas, "sentinel.mdx"), "utf8")).toBe(
      "KEEP\n",
    );
  });

  it("refuses promotion of a v1 or fixture record", async () => {
    const destination = await import("./compile-destination.ts");
    const record = await fixtureRecord();
    expect(() => destination.assertPromotionAllowed(record)).toThrow(/promot/i);
  });
});
