/**
 * The real CLIs end to end (WP54-S4; plan §8 "Run the reported mutations
 * against a complete compiler-generated page and assert the CLI exits
 * nonzero"). A v2 fixture record is written to a temp dir, compiled with
 * scripts/engine-compile.mjs, and the page (plus mutations) is audited with
 * scripts/audit-idea-mdx.mjs — both as child processes with the npm
 * scripts' `node --experimental-strip-types`, `--json` output and an empty
 * `--siblings` dir so no other repo page affects the result.
 */

import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AUDITOR,
  auditCli,
  cleanupTempDirs,
  COMPILER,
  lastJson,
  makeTempDir,
  REPO_ROOT,
  replaceOnce,
  runNodeScript,
  writePage,
} from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord, EV, FIXTURE_PAGE_SLUG, withEditorial } from "./__fixtures__/recordV2.ts";
import type { ResearchRecordV2 } from "./evidence/contract.ts";

const TIMEOUT = 120_000;
const RE_RESEARCH = "Re-run `npm run engine:research -- --brief <brief.json> --live` to produce a contract v2 record.";

let record: ResearchRecordV2;
let page = "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A contract v1 record in the legacy shape the committed engine/records/*.json use. */
const LEGACY_RECORD = {
  contractVersion: 1,
  brief: {
    title: "AI Code Reviewer",
    slug: "ai-code-reviewer",
    oneLiner: "A quiet reviewer.",
    targetCustomer: "Small GitHub teams",
  },
  market: { stats: [], summary: "Legacy summary." },
  competitors: [],
  community: {
    signals: [
      {
        quote: "We review 47 PRs a week on a team of 8.",
        citation: { url: "https://example.org/thread", title: "Thread" },
        verified: false,
      },
    ],
    summary: "Legacy summary.",
  },
  keywords: [],
  goToMarket: { positioning: "x", channels: [], pricingNotes: "x" },
  whyNow: "x",
  provenance: { providerCalls: [], costUsd: 0, ranAt: "2026-09-24T00:00:00.000Z" },
};

beforeAll(async () => {
  record = buildFixtureRecord();
  const dir = makeTempDir("engine-cli-");
  const recordPath = path.join(dir, "record.json");
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
  const out = path.join(dir, "out");
  const run = await runNodeScript(COMPILER, [
    "--record",
    recordPath,
    "--slug",
    FIXTURE_PAGE_SLUG,
    "--ideas-dir",
    out,
    "--no-manifest",
    "--json",
  ]);
  const result = lastJson(run.stdout);
  if (run.code !== 0 || !isRecord(result) || typeof result.mdxPath !== "string") {
    throw new Error(`engine-compile failed (${run.code}): ${run.stdout}\n${run.stderr}`);
  }
  page = fs.readFileSync(result.mdxPath, "utf8");
}, TIMEOUT);

afterAll(cleanupTempDirs);

describe("scripts/audit-idea-mdx.mjs on a compiler-generated page", () => {
  it(
    "exits 0 on the clean page: the whole deep bar passes, including the 2,200-word floor",
    async () => {
      const { code, result } = await auditCli(writePage(page, record));
      expect(result.errors).toEqual([]);
      expect(code).toBe(0);
      expect(result.ok).toBe(true);
      expect(result.metrics?.wordCount).toBeGreaterThanOrEqual(2200);
    },
    TIMEOUT,
  );

  it(
    "exits nonzero with the specific error for each reported mutation",
    async () => {
      const hnAttribution = "(https://news.ycombinator.com/item?id=27515468)\n\n> \"Our bot";
      const mutations: Array<{ name: string; mdx: string; expected: RegExp | string }> = [
        {
          name: "sentence appended inside a verified quote",
          mdx: replaceOnce(
            page,
            "every single one of them.\"\n>",
            "every single one of them. This product increased our engineering revenue by nine million dollars overnight.\"\n>",
          ),
          expected: /"We review 12 pull requests .*nine million dollars overnight\." is not a selected evidence quote/,
        },
        {
          name: "quote attribution moved to a fake URL",
          mdx: replaceOnce(page, hnAttribution, hnAttribution.replace("https://news.ycombinator.com/item?id=27515468", "https://example.org/fake-source")),
          expected:
            "attribution links to https://example.org/fake-source, but this quote's evidence source is https://news.ycombinator.com/item?id=27515468",
        },
        {
          name: "ARR inflated to $5,400,000",
          mdx: replaceOnce(page, "= $54,000 ARR**", "= $5,400,000 ARR**"),
          expected: "Year-One Math shows $5,400,000 ARR; the record computes 45 × $100/mo = $54,000 ARR",
        },
        {
          name: "downside accounts changed",
          mdx: replaceOnce(page, "**22 × $100/mo = $26,400 ARR**", "**23 × $100/mo = $26,400 ARR**"),
          expected: /Year-One Math downside shows 23 × \$100\/mo = \$26,400 ARR; the record computes 22 × \$100\/mo = \$26,400 ARR/,
        },
        {
          name: '"47 PRs on a team of 8" inserted into The Problem',
          mdx: replaceOnce(
            page,
            "the onboarding of new contributors.",
            "the onboarding of new contributors. One engineer reports reviewing 47 PRs in a week on a team of 8.",
          ),
          expected: /The Problem: unbound figure "47"/,
        },
        {
          name: "a fabricated quote as a plain paragraph (R10)",
          mdx: replaceOnce(
            page,
            "the onboarding of new contributors.",
            "the onboarding of new contributors.\n\n“Legal rejects every single draft that the chat tool writes for us.”",
          ),
          expected: /quoted text "Legal rejects every single draft .*" near line \d+ is not an accepted community quote/,
        },
        {
          name: "figures in The Solution (R10)",
          mdx: replaceOnce(page, "Everything else stays out of the thread.", "Everything else stays out of the thread. It saves 9 hours a week."),
          expected: /The Solution: unbound figure "9"/,
        },
      ];
      const runs = await Promise.all(mutations.map(async (m) => ({ m, run: await auditCli(writePage(m.mdx, record)) })));
      for (const { m, run } of runs) {
        expect(run.code, m.name).toBe(1);
        expect(run.result.ok, m.name).toBe(false);
        const errors = run.result.errors.join("\n");
        if (typeof m.expected === "string") expect(errors, m.name).toContain(m.expected);
        else expect(errors, m.name).toMatch(m.expected);
      }
    },
    TIMEOUT,
  );

  it(
    "exits nonzero on spelled-out numbers and Unicode digits in The Problem, The Solution and Business Model (R6 figures, R10)",
    async () => {
      const mutations: Array<{ name: string; mdx: string; figures: string[]; section: string }> = [
        {
          name: "number words in The Problem",
          section: "The Problem",
          mdx: replaceOnce(
            page,
            "the onboarding of new contributors.",
            "the onboarding of new contributors. On a team of eight, one engineer reviews forty seven pull requests a week.",
          ),
          figures: ["eight", "forty seven"],
        },
        {
          name: "fullwidth digits in The Solution",
          section: "The Solution",
          mdx: replaceOnce(page, "Everything else stays out of the thread.", "Everything else stays out of the thread. It cuts ６０％ of the review time across ４７ repositories."),
          figures: ["６０％", "４７"],
        },
        {
          name: "mathematical bold digits in Business Model",
          section: "Business Model",
          mdx: replaceOnce(page, "trials convert after a short evaluation", "trials convert for 𝟏𝟐 teams after a short evaluation"),
          figures: ["𝟏𝟐"],
        },
      ];
      const runs = await Promise.all(mutations.map(async (m) => ({ m, run: await auditCli(writePage(m.mdx, record)) })));
      for (const { m, run } of runs) {
        expect(run.code, m.name).toBe(1);
        const errors = run.result.errors.join("\n");
        for (const figure of m.figures) expect(errors, m.name).toContain(`${m.section}: unbound figure "${figure}"`);
      }
    },
    TIMEOUT,
  );

  it(
    "fails an engine page whose record is contract v1 with the re-research message",
    async () => {
      const files = writePage(page, record);
      fs.writeFileSync(files.recordPath, JSON.stringify(LEGACY_RECORD));
      const { code, result } = await auditCli(files);
      expect(code).toBe(1);
      expect(result.errors.join("\n")).toContain(
        `Research record "ai-code-reviewer" is a contract v1 (legacy) record: its evidence was not accepted before writing.`,
      );
      expect(result.errors.join("\n")).toContain(RE_RESEARCH);
    },
    TIMEOUT,
  );

  it(
    "fails a record that does not parse as contract v2, listing its issues",
    async () => {
      const files = writePage(page, record);
      const tampered: unknown = JSON.parse(JSON.stringify(record));
      if (!isRecord(tampered)) throw new Error("fixture: record is not an object");
      const evidence = tampered.evidence;
      if (!isRecord(evidence) || !Array.isArray(evidence.accepted)) throw new Error("fixture: evidence missing");
      const first: unknown = evidence.accepted.find((item: unknown) => isRecord(item) && item.id === EV.quoteHn.id);
      if (!isRecord(first)) throw new Error("fixture: HN quote missing");
      first.excerpt = "We review 15 pull requests a day and the bot comments on every single one of them.";
      fs.writeFileSync(files.recordPath, JSON.stringify(tampered));
      const { code, result } = await auditCli(files);
      expect(code).toBe(1);
      expect(result.errors.join("\n")).toMatch(/is not a valid contract v2 record: .*excerptSha256: does not match the excerpt/);
    },
    TIMEOUT,
  );

  it(
    "exits 2 on a usage error",
    async () => {
      const none = await runNodeScript(AUDITOR, []);
      expect(none.code).toBe(2);
      const bad = await runNodeScript(AUDITOR, ["--file"]);
      expect(bad.code).toBe(2);
    },
    TIMEOUT,
  );
});

describe("scripts/engine-compile.mjs", () => {
  it(
    "refuses a contract v1 record with the re-research message and writes nothing",
    async () => {
      const dir = makeTempDir("engine-cli-");
      const recordPath = path.join(dir, "legacy.json");
      fs.writeFileSync(recordPath, JSON.stringify(LEGACY_RECORD));
      const out = path.join(dir, "out");
      const run = await runNodeScript(COMPILER, ["--record", recordPath, "--ideas-dir", out, "--no-manifest", "--json"]);
      expect(run.code).toBe(1);
      const result = lastJson(run.stdout);
      expect(isRecord(result) && result.ok).toBe(false);
      expect(isRecord(result) ? String(result.error) : "").toContain(RE_RESEARCH);
      expect(fs.existsSync(out)).toBe(false);
    },
    TIMEOUT,
  );

  it(
    "refuses a record missing the editorial fields the deep audit needs, listing them",
    async () => {
      const dir = makeTempDir("engine-cli-");
      const recordPath = path.join(dir, "incomplete.json");
      fs.writeFileSync(recordPath, JSON.stringify(buildFixtureRecord(withEditorial({ yearOne: undefined }))));
      const out = path.join(dir, "out");
      // A draft slug: the fixture-mode record is refused for a public slug first (ruling R11).
      const run = await runNodeScript(COMPILER, [
        "--record",
        recordPath,
        "--slug",
        "engine-draft-incomplete",
        "--ideas-dir",
        out,
        "--no-manifest",
        "--json",
      ]);
      expect(run.code).toBe(1);
      const result = lastJson(run.stdout);
      expect(isRecord(result) ? result.error : null).toBe("record cannot compile into a publishable page");
      expect(isRecord(result) && Array.isArray(result.issues) ? result.issues.join("\n") : "").toContain("editorial.yearOne is missing");
      expect(fs.existsSync(out)).toBe(false);
    },
    TIMEOUT,
  );

  it(
    "exits 2 without --record",
    async () => {
      expect((await runNodeScript(COMPILER, [])).code).toBe(2);
    },
    TIMEOUT,
  );
});

describe("scripts/engine-compile.mjs and fixture records (R11, P2-8)", () => {
  function writeRecord(): { dir: string; recordPath: string; out: string } {
    const dir = makeTempDir("engine-cli-");
    const recordPath = path.join(dir, "fixture.json");
    fs.writeFileSync(recordPath, JSON.stringify(buildFixtureRecord(), null, 2));
    return { dir, recordPath, out: path.join(dir, "out") };
  }

  it(
    "refuses a fixture-mode record for its public brief slug (the reviewer's out-p8 compile) and writes nothing",
    async () => {
      const { recordPath, out } = writeRecord();
      const run = await runNodeScript(COMPILER, ["--record", recordPath, "--ideas-dir", out, "--no-manifest", "--json"]);
      expect(run.code).toBe(1);
      const result = lastJson(run.stdout);
      expect(isRecord(result) ? result.error : null).toBe("record cannot compile into a publishable page");
      expect(isRecord(result) && Array.isArray(result.issues) ? result.issues.join("\n") : "").toContain(
        `record mode is "fixture" (synthetic research): compile it only to an engine-draft-* or _temp slug, not 'signalpass' (ruling R11; tests may pass --allow-fixture)`,
      );
      expect(fs.existsSync(out)).toBe(false);
    },
    TIMEOUT,
  );

  it(
    "compiles it to a _temp slug, or to any slug with the test-only --allow-fixture flag",
    async () => {
      const { recordPath, out } = writeRecord();
      const temp = await runNodeScript(COMPILER, ["--record", recordPath, "--slug", "_engine-fixture-temp", "--ideas-dir", out, "--no-manifest", "--json"]);
      expect(temp.code, temp.stderr).toBe(0);
      const allowed = await runNodeScript(COMPILER, ["--record", recordPath, "--allow-fixture", "--ideas-dir", out, "--no-manifest", "--json"]);
      expect(allowed.code, allowed.stderr).toBe(0);
      expect(fs.readdirSync(out).sort()).toEqual(["_engine-fixture-temp.mdx", "signalpass.mdx"]);
    },
    TIMEOUT,
  );

  it(
    "prints an unexpected error as one line, with no stack trace and no absolute path (security P3)",
    async () => {
      const { dir, recordPath } = writeRecord();
      const blocker = path.join(dir, "not-a-dir");
      fs.writeFileSync(blocker, "");
      const run = await runNodeScript(COMPILER, ["--record", recordPath, "--slug", FIXTURE_PAGE_SLUG, "--ideas-dir", path.join(blocker, "ideas"), "--no-manifest"]);
      expect(run.code).toBe(1);
      expect(run.stderr).toMatch(/^engine:compile: unexpected error: ENOTDIR/m);
      expect(run.stderr).not.toMatch(/\n\s+at /);
      expect(`${run.stdout}${run.stderr}`).not.toContain(dir);
    },
    TIMEOUT,
  );
});

describe("scripts/engine-compile.mjs writes drafts only to drafts, however a path is spelled (security)", () => {
  const REFUSED = "refusing to write draft engine-draft-guard into content/ideas/ or ideas/manifest.json (drafts live in engine/drafts/)";

  /** An incomplete record: should the guard ever let a run through, the compile still refuses before writing. */
  function incompleteRecord(dir: string): string {
    const recordPath = path.join(dir, "incomplete.json");
    fs.writeFileSync(recordPath, JSON.stringify(buildFixtureRecord(withEditorial({ yearOne: undefined }))));
    return recordPath;
  }

  it(
    "refuses a symlink to content/ideas or to ideas/manifest.json",
    async () => {
      const dir = makeTempDir("engine-cli-");
      const recordPath = incompleteRecord(dir);
      const ideasLink = path.join(dir, "ideas-link");
      fs.symlinkSync(path.join(REPO_ROOT, "content", "ideas"), ideasLink);
      const manifestLink = path.join(dir, "manifest-link.json");
      fs.symlinkSync(path.join(REPO_ROOT, "ideas", "manifest.json"), manifestLink);
      for (const flags of [
        ["--ideas-dir", ideasLink, "--no-manifest"],
        ["--ideas-dir", path.join(dir, "out"), "--manifest", manifestLink],
      ]) {
        const run = await runNodeScript(COMPILER, ["--record", recordPath, "--slug", "engine-draft-guard", ...flags, "--json"]);
        expect(run.code, flags.join(" ")).toBe(1);
        expect(isRecord(lastJson(run.stdout)) ? String((lastJson(run.stdout) as Record<string, unknown>).error) : "", flags.join(" ")).toBe(REFUSED);
      }
    },
    TIMEOUT,
  );

  it(
    "refuses a case variant of content/ideas on a case-insensitive volume",
    async () => {
      const caseInsensitive = fs.existsSync(path.join(REPO_ROOT, "CONTENT"));
      const dir = makeTempDir("engine-cli-");
      const variant = path.join(REPO_ROOT, "Content", "Ideas");
      const run = await runNodeScript(COMPILER, ["--record", incompleteRecord(dir), "--slug", "engine-draft-guard", "--ideas-dir", variant, "--no-manifest", "--json"]);
      expect(run.code).toBe(1);
      const error = isRecord(lastJson(run.stdout)) ? String((lastJson(run.stdout) as Record<string, unknown>).error) : "";
      // On a case-sensitive volume "Content/Ideas" is another (missing) directory; the incomplete record is refused instead.
      expect(error).toBe(caseInsensitive ? REFUSED : "record cannot compile into a publishable page");
    },
    TIMEOUT,
  );

  it(
    "prints repo-relative paths in --json for a destination inside the repository",
    async () => {
      const cache = path.join(REPO_ROOT, "node_modules", ".cache");
      fs.mkdirSync(cache, { recursive: true });
      const inside = fs.mkdtempSync(path.join(cache, "engine-compile-json-"));
      try {
        const dir = makeTempDir("engine-cli-");
        const recordPath = path.join(dir, "record.json");
        fs.writeFileSync(recordPath, JSON.stringify(buildFixtureRecord()));
        const run = await runNodeScript(COMPILER, ["--record", recordPath, "--slug", FIXTURE_PAGE_SLUG, "--ideas-dir", inside, "--no-manifest", "--json"]);
        expect(run.code, run.stderr).toBe(0);
        const result = lastJson(run.stdout);
        expect(isRecord(result) ? result.mdxPath : null).toBe(path.relative(REPO_ROOT, path.join(inside, `${FIXTURE_PAGE_SLUG}.mdx`)));
        expect(run.stdout).not.toContain(REPO_ROOT);
      } finally {
        fs.rmSync(inside, { recursive: true, force: true });
      }
    },
    TIMEOUT,
  );
});

describe("scripts/engine-compile.mjs never replaces a handwritten idea by accident (overwrite hazard)", () => {
  it(
    "refuses --force on a handwritten page and manifest row, suggests an engine-draft- slug, and replaces only with --replace-handwritten",
    async () => {
      const dir = makeTempDir("engine-cli-");
      const recordPath = path.join(dir, "record.json");
      fs.writeFileSync(recordPath, JSON.stringify(buildFixtureRecord()));
      const ideasDir = path.join(dir, "ideas");
      fs.mkdirSync(ideasDir);
      const mdxPath = path.join(ideasDir, "ai-code-reviewer.mdx");
      const page = '---\nslug: "ai-code-reviewer"\ntitle: "AI Code Reviewer"\n---\n\nWritten by hand.\n';
      fs.writeFileSync(mdxPath, page);
      const manifestPath = path.join(dir, "manifest.json");
      const manifest = JSON.stringify({ ideas: [{ slug: "ai-code-reviewer", source: "mode-b:backfill", tools: ["cursor"], audiences: ["indie-hackers"] }] });
      fs.writeFileSync(manifestPath, manifest);
      const args = ["--record", recordPath, "--slug", "ai-code-reviewer", "--ideas-dir", ideasDir, "--manifest", manifestPath, "--allow-fixture", "--force"];

      const refused = await runNodeScript(COMPILER, [...args, "--json"]);
      expect(refused.code).toBe(1);
      const result = lastJson(refused.stdout);
      expect(isRecord(result) ? String(result.error) : "").toMatch(
        /^refusing to replace the handwritten idea ai-code-reviewer: .*--slug engine-draft-ai-code-reviewer.*--replace-handwritten/,
      );
      const human = await runNodeScript(COMPILER, args);
      expect(human.code).toBe(1);
      expect(human.stderr).toMatch(/refusing to replace the handwritten idea ai-code-reviewer/);
      expect(fs.readFileSync(mdxPath, "utf8")).toBe(page);
      expect(fs.readFileSync(manifestPath, "utf8")).toBe(manifest);

      const replaced = await runNodeScript(COMPILER, [...args, "--replace-handwritten", "--json"]);
      expect(replaced.code, replaced.stdout + replaced.stderr).toBe(0);
      expect(fs.readFileSync(mdxPath, "utf8")).toContain("\nengine: true\n");
    },
    TIMEOUT,
  );
});
