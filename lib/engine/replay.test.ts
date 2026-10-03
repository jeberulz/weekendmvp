/**
 * Deterministic replay gate (WP54-S6; remediation plan §11 "Deterministic
 * checks first"; evidence contract ruling R4).
 *
 * The real CLIs run as child processes with the npm scripts' node flags, in
 * a temp dir, with an environment that holds no provider keys, on the
 * synthetic RFP fixture (engine/briefs/fixtures/rfp-assistant.json):
 *
 *   engine-research.mjs --fixture rfp-assistant --out <tmp>/r.json
 *   engine-compile.mjs  --record <tmp>/r.json --slug engine-draft-replay-rfp
 *                       --ideas-dir <tmp>/ideas --no-manifest --json
 *   audit-idea-mdx.mjs  --file <tmp>/ideas/engine-draft-replay-rfp.mdx
 *                       --record <tmp>/r.json --siblings <tmp>/siblings --json
 *
 * Every step must exit 0 and the page must pass the FULL deep bar: --record
 * turns on the engine bar (2,200-word floor, filler, duplicates, prompts,
 * Year-One Math and the final artifact audit), and the empty --siblings dir
 * keeps other repository pages out of the cross-idea check.
 *
 * Beyond the unit suites it shows:
 *   - research, compile and audit agree end to end on one record;
 *   - authenticity (ruling R4), which a record cannot prove about itself:
 *     every accepted excerpt is a substring of the fixture page for its
 *     source, and every read source's textSha256 is sha256 of that page's
 *     text; a self-consistent forged excerpt parses but fails this check;
 *   - the F1 mixed scenario and F5 rows 1-4 never reach a page, even with a
 *     writer that selects EVERY accepted item (in-process pipeline, then the
 *     real compile and audit CLIs);
 *   - a legacy v1 record is refused by the compile CLI and by the auditor;
 *   - the review's mutations of the replayed page make the audit CLI exit 1;
 *   - `npm run engine:replay` (scripts/engine-replay.mjs) runs the same flow
 *     and removes its temp dir.
 * It says nothing about live sources, live models or source credibility:
 * that is the live evaluation and the operator's source check.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AUDITOR,
  cleanupTempDirs,
  COMPILER,
  lastJson,
  makeTempDir,
  NODE_FLAGS,
  REPO_ROOT,
  replaceOnce,
  toAuditResult,
  type AuditResult,
} from "./__fixtures__/auditHarness.ts";
import {
  F1_PAGES,
  f1ProviderOptions,
  F5_PAGES,
  F5_ROWS,
  f5ProviderOptions,
  REJECTED_FRAGMENTS,
} from "./__fixtures__/scenarios.ts";
import { evidenceClaimKey, evidenceId } from "./evidence/accept.ts";
import { canonicalSourceUrl } from "./evidence/citation.ts";
import type { AcceptedEvidence, ResearchRecordV2 } from "./evidence/contract.ts";
import { runResearch, type BriefInput, type EditorialEvidenceItem } from "./pipeline.ts";
import {
  createFixtureProviders,
  FIXTURE_BRIEF_SLUG,
  FIXTURE_PAGES,
  fixtureEditorialReply,
  type FixtureProviderOptions,
} from "./providers/fixtures.ts";
import { LegacyResearchRecordError, parseResearchRecord, readLegacyResearchRecordV1 } from "./research-record.ts";

const TIMEOUT = 180_000;
const SLUG = "engine-draft-replay-rfp";
const RESEARCH = path.join(REPO_ROOT, "scripts", "engine-research.mjs");
const REPLAY_SCRIPT = path.join(REPO_ROOT, "scripts", "engine-replay.mjs");
const RE_RESEARCH =
  "Re-research into a new file: `npm run engine:research -- --brief <brief.json> --live --out engine/records/engine-draft-ai-rfp-response-assistant.json`";

const BRIEF: BriefInput = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "engine", "briefs", "fixtures", "rfp-assistant.json"), "utf8"));

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function readJson(file: string): Json {
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!isRecord(value)) throw new Error(`${file}: not a JSON object`);
  return value;
}

type CliRun = { code: number | null; stdout: string; stderr: string };

/**
 * A repo script as a child process: the current node binary with the npm
 * scripts' flags, and an environment of NODE_ENV only (no provider keys, no
 * PATH, nothing inherited), so a fixture run cannot reach a paid API.
 */
function runCli(script: string, args: string[], flags: readonly string[] = NODE_FLAGS): Promise<CliRun> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...flags, script, ...args], {
      cwd: REPO_ROOT,
      env: { NODE_ENV: "test" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      stdout += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      stderr += d;
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function compileArgs(recordPath: string, ideasDir: string): string[] {
  return ["--record", recordPath, "--slug", SLUG, "--ideas-dir", ideasDir, "--no-manifest", "--json"];
}

function auditArgs(file: string, recordPath: string, siblings: string): string[] {
  return ["--file", file, "--record", recordPath, "--siblings", siblings, "--json"];
}

type CompileOutput = { ok: boolean; mdxPath?: string; wordCount?: number; error?: string; issues?: string[] };

function compileOutput(run: CliRun): CompileOutput {
  const value = lastJson(run.stdout);
  if (!isRecord(value) || typeof value.ok !== "boolean") throw new Error(`unexpected compile output: ${run.stdout.slice(0, 200)}`);
  return {
    ok: value.ok,
    ...(typeof value.mdxPath === "string" ? { mdxPath: value.mdxPath } : {}),
    ...(typeof value.wordCount === "number" ? { wordCount: value.wordCount } : {}),
    ...(typeof value.error === "string" ? { error: value.error } : {}),
    ...(Array.isArray(value.issues) ? { issues: value.issues.map(String) } : {}),
  };
}

/** Compile a record file to <dir>/ideas and audit the page with the real CLIs. */
async function compileAndAudit(dir: string, recordPath: string) {
  const ideasDir = path.join(dir, "ideas");
  const siblings = path.join(dir, "siblings");
  fs.mkdirSync(siblings, { recursive: true });
  const compile = await runCli(COMPILER, compileArgs(recordPath, ideasDir));
  const mdxPath = path.join(ideasDir, `${SLUG}.mdx`);
  const audit = await runCli(AUDITOR, auditArgs(mdxPath, recordPath, siblings));
  const page = fs.existsSync(mdxPath) ? fs.readFileSync(mdxPath, "utf8") : "";
  return { compile, audit, auditResult: toAuditResult(lastJson(audit.stdout)), page, mdxPath, siblings };
}

/**
 * Ruling R4: what the record cannot prove about itself. Every accepted
 * excerpt must be a substring of the page text of its own source, and every
 * read source must hash (textSha256) to that page's text. `pages` maps the
 * fixture's cited URLs to the text the fixture reader returned.
 */
function authenticityIssues(record: ResearchRecordV2, pages: Readonly<Record<string, string>>): string[] {
  const byUrl = new Map<string, string>();
  for (const [url, text] of Object.entries(pages)) {
    const canonical = canonicalSourceUrl(url);
    if (canonical) byUrl.set(canonical, text);
  }
  const issues: string[] = [];
  for (const item of record.evidence.accepted) {
    const page = byUrl.get(item.sourceUrl);
    if (page === undefined) issues.push(`${item.id}: no fixture page for ${item.sourceUrl}`);
    else if (!page.includes(item.excerpt)) issues.push(`${item.id}: excerpt is not on its page ${item.sourceUrl}`);
  }
  for (const source of record.evidence.sources) {
    if (source.status !== "read") continue;
    const page = byUrl.get(source.url);
    if (page === undefined) issues.push(`${source.url}: read, but the fixture has no page for it`);
    else if (source.textSha256 !== sha256(page)) issues.push(`${source.url}: textSha256 is not sha256 of the page text`);
  }
  return issues;
}

/**
 * A writer that selects EVERY accepted item (all stats, all quotes, every
 * price under its vendor), so anything acceptance let through would be
 * rendered on the compiled page. The default reply supplies the prose.
 */
function exhaustiveWriter(evidence: EditorialEvidenceItem[]): unknown {
  const reply = fixtureEditorialReply(evidence);
  if (!isRecord(reply)) throw new Error("fixture: editorial reply is not an object");
  const ids = (kind: EditorialEvidenceItem["kind"]) => evidence.filter((e) => e.kind === kind).map((e) => e.id);
  const competitors = Array.isArray(reply.competitors) ? reply.competitors.filter(isRecord) : [];
  const listed = new Set(competitors.flatMap((c) => (Array.isArray(c.priceIds) ? c.priceIds : [])));
  for (const price of evidence) {
    if (price.kind !== "competitor_price" || listed.has(price.id)) continue;
    const row = competitors.find((c) => c.name === price.vendor);
    if (row && Array.isArray(row.priceIds)) row.priceIds.push(price.id);
    else competitors.push({ name: price.vendor, priceIds: [price.id] });
  }
  return { ...reply, marketStatIds: ids("market_stat"), quoteIds: ids("community_quote"), competitors };
}

/** Research in-process on fixture providers, then write the record the way the research CLI does. */
async function researchToFile(options: FixtureProviderOptions, dir: string): Promise<{ record: ResearchRecordV2; recordPath: string }> {
  const { record } = await runResearch({ brief: BRIEF, providers: createFixtureProviders(options), mode: "fixture" });
  const recordPath = path.join(dir, "r.json");
  fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  return { record, recordPath };
}

// ---------------------------------------------------------------------------
// The replay
// ---------------------------------------------------------------------------

type Replay = {
  dir: string;
  recordPath: string;
  research: CliRun;
  compile: CliRun;
  audit: CliRun;
  auditResult: AuditResult;
  page: string;
  mdxPath: string;
  siblings: string;
};

let replay: Replay;

beforeAll(async () => {
  const dir = makeTempDir("engine-replay-gate-");
  const recordPath = path.join(dir, "r.json");
  const research = await runCli(RESEARCH, ["--fixture", "rfp-assistant", "--out", recordPath]);
  const rest = await compileAndAudit(dir, recordPath);
  replay = { dir, recordPath, research, ...rest };
}, TIMEOUT);

afterAll(cleanupTempDirs);

describe("replay: research → compile → audit through the real CLIs (fixture, no provider keys)", () => {
  it("exits 0 at every step and the page passes the full deep bar", () => {
    const { research, compile, audit, auditResult } = replay;
    expect(research.code, research.stderr).toBe(0);
    expect(research.stdout).toMatch(new RegExp(`engine:research ok · mode fixture · slug ${FIXTURE_BRIEF_SLUG}`));
    const report = readJson(`${replay.recordPath}.report.json`);
    expect(report).toMatchObject({ ok: true, mode: "fixture", pipelineVersion: 2, recordContractVersion: 2 });

    expect(compile.code, compile.stderr).toBe(0);
    const compiled = compileOutput(compile);
    expect(compiled.ok).toBe(true);
    expect(compiled.mdxPath).toBe(replay.mdxPath);
    expect(compiled.wordCount).toBeGreaterThanOrEqual(2200);

    expect(auditResult.errors).toEqual([]);
    expect(auditResult.warnings).toEqual([]);
    expect(audit.code).toBe(0);
    expect(auditResult.ok).toBe(true);
    expect(auditResult.metrics).toMatchObject({
      slug: SLUG,
      deep: true,
      wordFloor: 2200,
      wordHardFloor: 2200,
      fillerHits: 0,
      nearDuplicatePairs: 0,
      duplicateSentences: 0,
      crossIdeaSentenceDupes: 0,
      artifact: { verifiedQuotes: 2, marketRows: 2, competitorRows: 3, unboundFigures: 0 },
    });
    expect(auditResult.metrics?.wordCount).toBeGreaterThanOrEqual(2200);
  });

  it("writes only inside its temp dir and never shows a stack trace", () => {
    expect(fs.readdirSync(replay.dir).sort()).toEqual(["ideas", "r.json", "r.json.report.json", "siblings"]);
    expect(fs.readdirSync(path.join(replay.dir, "ideas"))).toEqual([`${SLUG}.mdx`]);
    for (const run of [replay.research, replay.compile, replay.audit]) {
      expect(`${run.stdout}\n${run.stderr}`).not.toMatch(/\n\s+at .*\.(?:ts|mjs):\d+/);
    }
  });

  it("is authentic against the fixture pages (ruling R4): excerpts are on their pages, read sources hash to them", () => {
    const record = parseResearchRecord(readJson(replay.recordPath));
    expect(record.mode).toBe("fixture");
    const counts = { community_quote: 0, market_stat: 0, competitor_price: 0, competitor_availability: 0 };
    for (const item of record.evidence.accepted) counts[item.kind] += 1;
    expect(counts).toEqual({ community_quote: 3, market_stat: 3, competitor_price: 3, competitor_availability: 0 });
    expect(record.evidence.sources.filter((s) => s.status === "read")).toHaveLength(7);
    expect(authenticityIssues(record, FIXTURE_PAGES)).toEqual([]);
  });

  it("catches what the record parser cannot: a self-consistent forged excerpt (ruling R4)", () => {
    const record = parseResearchRecord(readJson(replay.recordPath));
    // An accepted quote the writer did not select, so no reference breaks.
    const unselected = record.evidence.accepted.find(
      (e) => e.kind === "community_quote" && !record.community.quoteIds.includes(e.id),
    );
    if (!unselected) throw new Error("fixture: every accepted quote is selected");
    const excerpt = "Our proposal tool writes every security answer for us and legal never complains.";
    const forged: AcceptedEvidence = {
      ...unselected,
      excerpt,
      excerptSha256: sha256(excerpt),
      id: evidenceId(unselected.kind, unselected.sourceUrl, excerpt, evidenceClaimKey(unselected)),
    };
    const tampered = { ...record, evidence: { ...record.evidence, accepted: record.evidence.accepted.map((e) => (e === unselected ? forged : e)) } };
    // Consistency holds, so the parser accepts it…
    expect(() => parseResearchRecord(JSON.parse(JSON.stringify(tampered)))).not.toThrow();
    // …and only the replay against the source text catches it.
    expect(authenticityIssues(tampered, FIXTURE_PAGES)).toEqual([`${forged.id}: excerpt is not on its page ${forged.sourceUrl}`]);
  });
});

// ---------------------------------------------------------------------------
// Adversarial evidence never reaches a page
// ---------------------------------------------------------------------------

describe("replay: adversarial evidence never reaches the page", () => {
  it(
    "F1 mixed scenario: the rejected 47 PRs / team of 8 and 60% / 25% claims are on no page, even with every accepted item selected",
    async () => {
      const dir = makeTempDir("engine-replay-f1-");
      const { record, recordPath } = await researchToFile(f1ProviderOptions({ synthesis: { editorial: exhaustiveWriter } }), dir);
      // The scenario really did reject them (operator-only rejections keep the text).
      expect(record.evidence.rejected.some((r) => r.candidate?.includes("47 PRs"))).toBe(true);
      expect(record.evidence.rejected.some((r) => r.candidate?.includes("60%"))).toBe(true);
      // Every accepted item is selected, so the page shows the whole accepted bundle.
      expect(record.market.statIds).toHaveLength(record.evidence.accepted.filter((e) => e.kind === "market_stat").length);
      expect(record.community.quoteIds).toHaveLength(record.evidence.accepted.filter((e) => e.kind === "community_quote").length);
      expect(authenticityIssues(record, F1_PAGES)).toEqual([]);

      const { compile, audit, auditResult, page } = await compileAndAudit(dir, recordPath);
      expect(compile.code, compile.stdout).toBe(0);
      expect(auditResult.errors).toEqual([]);
      expect(audit.code).toBe(0);
      for (const fragment of REJECTED_FRAGMENTS) expect(page).not.toContain(fragment);
      expect(page).not.toMatch(/\b47\b/);
      expect(page).not.toMatch(/\b60%/);
    },
    TIMEOUT,
  );

  it(
    "F5 rows 1-4: no wrong claim is accepted or rendered, even with every accepted item selected",
    async () => {
      const dir = makeTempDir("engine-replay-f5-");
      const { record, recordPath } = await researchToFile(f5ProviderOptions(F5_ROWS, { synthesis: { editorial: exhaustiveWriter } }), dir);
      for (const row of F5_ROWS) {
        expect(record.evidence.accepted.some(row.leaked), row.label).toBe(false);
        const claims = [
          ...(row.stats ?? []).map((c) => ({ url: c.sourceUrl, candidate: `${c.subject}: ${c.amountText}` })),
          ...(row.prices ?? []).map((c) => ({ url: c.sourceUrl, candidate: `${c.vendor}: ${c.priceText}` })),
        ];
        for (const claim of claims) {
          const rejection = record.evidence.rejected.find(
            (r) => r.sourceUrl === canonicalSourceUrl(claim.url) && r.candidate === claim.candidate,
          );
          expect(rejection, `${row.label}: ${claim.candidate}`).toBeDefined();
          expect(row.reasons).toContain(rejection?.reason);
        }
      }
      expect(authenticityIssues(record, { ...FIXTURE_PAGES, ...F5_PAGES })).toEqual([]);

      const { compile, audit, auditResult, page } = await compileAndAudit(dir, recordPath);
      expect(compile.code, compile.stdout).toBe(0);
      expect(auditResult.errors).toEqual([]);
      expect(audit.code).toBe(0);
      for (const wrong of ["$20,000/month", "$1.4 billion", "$2024 billion", "2024 billion", "$30/month", "Loopio", "Qvidian"]) {
        expect(page, wrong).not.toContain(wrong);
      }
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// Legacy records and page mutations
// ---------------------------------------------------------------------------

/** A complete contract v1 record (the shape engine/records used before WP54). */
const LEGACY_RECORD = {
  contractVersion: 1,
  brief: {
    title: "AI RFP Response Assistant",
    slug: "ai-rfp-response-assistant",
    oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
    targetCustomer: "SMB SaaS sales and solutions engineers",
  },
  market: {
    summary: "Proposal automation keeps growing.",
    stats: [
      { claim: "RFP software market size", value: "$1.9 billion (2024)", citation: { url: "https://research.example.com/rfp", title: "Report" } },
      { claim: "RFP software forecast", value: "$5.6 billion by 2032", citation: { url: "https://research.example.com/rfp", title: "Report" } },
    ],
  },
  competitors: [
    { name: "Bidwell", pricing: "$49/user/month", url: "https://bidwell.example/pricing" },
    { name: "AnswerDeck", pricing: "$399/month", url: "https://answerdeck.example/pricing" },
    { name: "RFPForge", pricing: "$25/user/month", url: "https://rfpforge.example/pricing" },
  ],
  community: {
    summary: "A team of 8 reviews 47 PRs a week.",
    signals: [{ quote: "We review 47 PRs a week on a team of 8.", citation: { url: "https://news.example.com/item?id=1", title: "Thread" }, verified: false }],
  },
  keywords: [{ term: "rfp response software", volume: 2400, competition: 42, cpc: 18.5, source: "provider" }],
  goToMarket: { positioning: "Cited drafts.", channels: ["LinkedIn"], pricingNotes: "Below incumbents." },
  whyNow: "Questionnaires arrive earlier.",
  provenance: { providerCalls: [], costUsd: 0, ranAt: "2026-09-24T00:00:00.000Z" },
};

describe("replay: legacy records and page mutations", () => {
  it(
    "refuses a legacy v1 record in the compile CLI and in the auditor, with the re-research message",
    async () => {
      // A genuine v1 record: the history-only reader accepts it, the publish path refuses it.
      expect(readLegacyResearchRecordV1(LEGACY_RECORD).contractVersion).toBe(1);
      expect(() => parseResearchRecord(LEGACY_RECORD)).toThrow(LegacyResearchRecordError);

      const dir = makeTempDir("engine-replay-legacy-");
      const legacyPath = path.join(dir, "legacy.json");
      fs.writeFileSync(legacyPath, JSON.stringify(LEGACY_RECORD, null, 2));
      const ideasDir = path.join(dir, "ideas");
      const [compile, audit] = await Promise.all([
        runCli(COMPILER, compileArgs(legacyPath, ideasDir)),
        runCli(AUDITOR, auditArgs(replay.mdxPath, legacyPath, replay.siblings)),
      ]);
      expect(compile.code).toBe(1);
      const compiled = compileOutput(compile);
      expect(compiled.ok).toBe(false);
      expect(compiled.error).toContain('Research record "ai-rfp-response-assistant" is a contract v1 (legacy) record');
      expect(compiled.error).toContain(RE_RESEARCH);
      expect(fs.existsSync(ideasDir)).toBe(false);

      expect(audit.code).toBe(1);
      const result = toAuditResult(lastJson(audit.stdout));
      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toContain(RE_RESEARCH);
    },
    TIMEOUT,
  );

  it(
    "exits nonzero on each reported mutation of the replayed page",
    async () => {
      const page = replay.page;
      const firstQuoteEnd = 'every enterprise deal."\n>';
      const firstAttribution = 'every enterprise deal."\n>\n> — [Ask: how do small teams handle RFPs?](https://news.example.com/item?id=4101)';
      const mutations: Array<{ name: string; mdx: string; expected: RegExp | string }> = [
        {
          name: "sentence appended inside a verified quote",
          mdx: replaceOnce(
            page,
            firstQuoteEnd,
            'every enterprise deal. This product increased our engineering revenue by nine million dollars overnight."\n>',
          ),
          expected: /"We burn weekends .*nine million dollars overnight\." is not a selected evidence quote/,
        },
        {
          name: "quote attribution moved to a fake URL",
          mdx: replaceOnce(page, firstAttribution, firstAttribution.replace("https://news.example.com/item?id=4101", "https://example.org/fake-source")),
          expected: "attribution links to https://example.org/fake-source, but this quote's evidence source is https://news.example.com/item?id=4101",
        },
        {
          name: "ARR inflated to $5,400,000",
          mdx: replaceOnce(page, "= $18,000 ARR**", "= $5,400,000 ARR**"),
          expected: "Year-One Math shows $5,400,000 ARR; the record computes 15 × $100/mo = $18,000 ARR",
        },
        {
          name: '"47 PRs" inserted into The Problem',
          mdx: replaceOnce(
            page,
            "before the deal stalls.",
            "before the deal stalls. One engineer reports reviewing 47 PRs in a week on a team of 8.",
          ),
          expected: /The Problem: unbound figure "47"/,
        },
      ];
      const runs = await Promise.all(
        mutations.map(async (m) => {
          const dir = makeTempDir("engine-replay-mutation-");
          const file = path.join(dir, `${SLUG}.mdx`);
          fs.writeFileSync(file, m.mdx);
          return { m, run: await runCli(AUDITOR, auditArgs(file, replay.recordPath, replay.siblings)) };
        }),
      );
      for (const { m, run } of runs) {
        expect(run.code, m.name).toBe(1);
        const result = toAuditResult(lastJson(run.stdout));
        expect(result.ok, m.name).toBe(false);
        const errors = result.errors.join("\n");
        if (typeof m.expected === "string") expect(errors, m.name).toContain(m.expected);
        else expect(errors, m.name).toMatch(m.expected);
      }
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// The operator command
// ---------------------------------------------------------------------------

describe("npm run engine:replay", () => {
  it(
    "runs the same flow, prints each step's exit code and the verdict, and removes its temp dir",
    async () => {
      const workRoot = makeTempDir("engine-replay-root-");
      // The npm script runs plain node (the script spawns the CLIs with --experimental-strip-types itself).
      const run = await runCli(REPLAY_SCRIPT, ["--work-root", workRoot], []);
      expect(run.code, `${run.stdout}\n${run.stderr}`).toBe(0);
      expect(run.stdout).toMatch(/^ {2}research +exit 0\b/m);
      expect(run.stdout).toMatch(/^ {2}compile +exit 0\b/m);
      expect(run.stdout).toMatch(/^ {2}audit +exit 0 +PASS\b/m);
      expect(run.stdout).toMatch(/^engine:replay PASS$/m);
      expect(`${run.stdout}\n${run.stderr}`).not.toContain(workRoot);
      expect(fs.readdirSync(workRoot)).toEqual([]);
    },
    TIMEOUT,
  );
});
