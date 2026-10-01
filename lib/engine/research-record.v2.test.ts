/**
 * Research record contract v2 parser (WP46-S3, evidence contract §8).
 *
 * The parser is a closed schema: accepted evidence re-validates offline,
 * every selected id resolves to an accepted item of the right kind, and
 * fact-bearing prose carries figures only through evidence tokens.
 *
 * Records here are built programmatically — synthetic source pages →
 * acceptEvidence → a v2 record → JSON round trip — so no test hard-codes an
 * evidence id (ruling R1 changes the id hash). Ids a test needs that are not
 * accepted are derived from real ones or produced by acceptEvidence itself.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { acceptEvidence, type SourceInput } from "./evidence/accept.ts";
import { canonicalSourceUrl } from "./evidence/citation.ts";
import {
  EVIDENCE_LIMITS,
  FACT_BEARING_FIELDS,
  type AcceptedEvidence,
  type ExtractionCandidates,
  type ResearchRecordV2,
  type SourceAcquisition,
  type SourceRole,
} from "./evidence/contract.ts";
import {
  LegacyResearchRecordError,
  parseResearchRecord,
  readLegacyResearchRecordV1,
  RESEARCH_RECORD_V2_LIMITS,
  ResearchRecordParseError,
} from "./research-record.ts";

// ---------------------------------------------------------------------------
// Synthetic sources and evidence
// ---------------------------------------------------------------------------

const AT = "2026-09-30T12:00:00.000Z";

type Page = { url: string; title: string; roles: SourceRole[]; text?: string };

const PAGES = {
  report: {
    url: "https://research.example.com/ai-code-review-market",
    title: "AI code review market report",
    roles: ["market"],
    text: "Market overview. The AI code review market was valued at $1.4 billion in 2025. Analysts expect the AI code review market to reach $10.8 billion by 2034.",
  },
  survey: {
    url: "https://survey.example.org/developer-tools-2025",
    title: "Developer tools survey 2025",
    roles: ["market"],
    text: "Developer survey results. In 2025, 62% of developers used AI code review assistants at work.",
  },
  coderabbit: {
    url: "https://www.coderabbit.ai/pricing",
    title: "CodeRabbit pricing",
    roles: ["competitors"],
    text: "Pricing\nPro\n$24/user/month, billed annually\nUnlimited reviews for private repositories.\nEnterprise\nCustom pricing",
  },
  graphite: {
    url: "https://graphite.dev/pricing",
    title: "Graphite pricing",
    roles: ["competitors"],
    text: "Graphite pricing\nTeam\n$40/user/month\nStacked pull requests with automated review.",
  },
  qodo: {
    url: "https://www.qodo.ai/pricing",
    title: "Qodo pricing",
    roles: ["competitors"],
    text: "Qodo plans\nTeams\n$30/user/month, billed annually\nCode review agents for growing teams.",
  },
  hn: {
    url: "https://news.ycombinator.com/item?id=27515468",
    title: "Ask HN: AI code review",
    roles: ["community"],
    text: "Comment: All these small teams need is a quiet sanity check on every pull request. Reply: agreed, the rest is noise.",
  },
  forum: {
    url: "https://forum.example.com/t/ai-review-noise",
    title: "AI review noise",
    roles: ["community"],
    text: "Our bot leaves forty comments per PR and nobody reads any of them anymore.",
  },
  mirror: {
    url: "https://lobste.rs/s/abc123/review_noise",
    title: "Review noise",
    roles: ["community"],
    text: "Quoting HN: All these small teams need is a quiet sanity check on every pull request.",
  },
  // Cited by the community search but never read (no text): unreadable.
  reddit: {
    url: "https://www.reddit.com/r/ExperiencedDevs/comments/abc123/review_load/",
    title: "r/ExperiencedDevs",
    roles: ["community"],
  },
} satisfies Record<string, Page>;

const HN_QUOTE = "All these small teams need is a quiet sanity check on every pull request.";
const FORUM_QUOTE = "Our bot leaves forty comments per PR and nobody reads any of them anymore.";
/** The review's rejected claim (F1): not on the cited page, so never accepted. */
const REJECTED_QUOTE = "We review 47 PRs a week on a team of 8 and it eats 60% of our time versus 25% coding.";

const VENDORS = ["CodeRabbit", "Graphite", "Qodo"];

const CANDIDATES: ExtractionCandidates = {
  quotes: [
    { sourceUrl: PAGES.hn.url, text: HN_QUOTE },
    { sourceUrl: PAGES.forum.url, text: FORUM_QUOTE },
    { sourceUrl: PAGES.mirror.url, text: HN_QUOTE },
    { sourceUrl: PAGES.hn.url, text: REJECTED_QUOTE },
    { sourceUrl: PAGES.reddit.url, text: "Reviewing AI generated pull requests now takes longer than writing the code myself." },
  ],
  marketStats: [
    {
      sourceUrl: PAGES.report.url,
      supportingText: "The AI code review market was valued at $1.4 billion in 2025.",
      subject: "AI code review market",
      metric: "market_size",
      amountText: "$1.4 billion",
      year: 2025,
      periodKind: "measured",
    },
    {
      sourceUrl: PAGES.report.url,
      supportingText: "Analysts expect the AI code review market to reach $10.8 billion by 2034.",
      subject: "AI code review market",
      metric: "market_size",
      amountText: "$10.8 billion",
      year: 2034,
      periodKind: "projected",
    },
    {
      sourceUrl: PAGES.survey.url,
      supportingText: "In 2025, 62% of developers used AI code review assistants at work.",
      subject: "developers using AI code review assistants",
      metric: "adoption",
      amountText: "62%",
      year: 2025,
      periodKind: "measured",
    },
  ],
  competitorPrices: [
    {
      vendor: "CodeRabbit",
      sourceUrl: PAGES.coderabbit.url,
      supportingText: "Pro\n$24/user/month, billed annually",
      plan: "Pro",
      priceText: "$24/user/month, billed annually",
    },
    {
      vendor: "Graphite",
      sourceUrl: PAGES.graphite.url,
      supportingText: "Team\n$40/user/month",
      plan: "Team",
      priceText: "$40/user/month",
    },
    {
      vendor: "Qodo",
      sourceUrl: PAGES.qodo.url,
      supportingText: "Teams\n$30/user/month, billed annually",
      plan: "Teams",
      priceText: "$30/user/month, billed annually",
    },
  ],
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`fixture: missing ${label}`);
  return value;
}

function canonical(url: string): string {
  return must(canonicalSourceUrl(url), `canonical form of ${url}`);
}

function acquisitionInput(pages: ReadonlyArray<Page>): Map<string, SourceInput> {
  return new Map(
    pages.map((p): [string, SourceInput] => [
      p.url,
      p.text === undefined
        ? { status: "unreadable" }
        : { status: "read", text: p.text, retrievedAt: AT, textSha256: sha256(p.text) },
    ]),
  );
}

function sourceList(pages: ReadonlyArray<Page>): SourceAcquisition[] {
  return pages.map((p): SourceAcquisition =>
    p.text === undefined
      ? { url: canonical(p.url), roles: [...p.roles], status: "unreadable", detail: "HTTP 403 from www.reddit.com" }
      : { url: canonical(p.url), roles: [...p.roles], status: "read", retrievedAt: AT, textSha256: sha256(p.text) },
  );
}

function accept(pages: ReadonlyArray<Page>, candidates: Partial<ExtractionCandidates>) {
  return acceptEvidence({
    candidates: { quotes: [], marketStats: [], competitorPrices: [], ...candidates },
    citations: pages.map((p) => ({ url: p.url, title: p.title })),
    sources: acquisitionInput(pages),
    vendorHints: VENDORS,
  });
}

const ALL_PAGES: Page[] = Object.values(PAGES);
const BASE = accept(ALL_PAGES, CANDIDATES);

function find(predicate: (item: AcceptedEvidence) => boolean, label: string): AcceptedEvidence {
  return must(BASE.accepted.find(predicate), `accepted ${label}`);
}

const EV = {
  statMeasured: find((e) => e.kind === "market_stat" && e.amount.value === "1.4", "measured stat"),
  statProjected: find((e) => e.kind === "market_stat" && e.period.kind === "projected", "projected stat"),
  statAdoption: find((e) => e.kind === "market_stat" && e.metric === "adoption", "adoption stat"),
  priceCodeRabbit: find((e) => e.kind === "competitor_price" && e.vendor === "CodeRabbit", "CodeRabbit price"),
  priceGraphite: find((e) => e.kind === "competitor_price" && e.vendor === "Graphite", "Graphite price"),
  priceQodo: find((e) => e.kind === "competitor_price" && e.vendor === "Qodo", "Qodo price"),
  quoteHn: find((e) => e.kind === "community_quote" && e.sourceUrl === canonical(PAGES.hn.url), "HN quote"),
  quoteForum: find((e) => e.kind === "community_quote" && e.sourceUrl === canonical(PAGES.forum.url), "forum quote"),
  quoteMirror: find((e) => e.kind === "community_quote" && e.sourceUrl === canonical(PAGES.mirror.url), "mirror quote"),
};

const tok = (item: AcceptedEvidence) => `[[ev:${item.id}]]`;

/** An id with the right shape that is not accepted (last hex digit changed). */
function forgeId(id: string): string {
  const forged = `${id.slice(0, -1)}${id.endsWith("0") ? "1" : "0"}`;
  if (BASE.accepted.some((e) => e.id === forged)) throw new Error("fixture: forged id collides");
  return forged;
}

function indexOfAccepted(item: AcceptedEvidence): number {
  const index = BASE.accepted.findIndex((e) => e.id === item.id);
  if (index < 0) throw new Error("fixture: item not accepted");
  return index;
}

function sourceIndex(page: Page): number {
  const index = ALL_PAGES.indexOf(page);
  if (index < 0) throw new Error("fixture: unknown page");
  return index;
}

function buildRecord(): ResearchRecordV2 {
  return {
    contractVersion: 2,
    pipelineVersion: 2,
    mode: "fixture",
    brief: {
      title: "AI Code Reviewer",
      slug: "ai-code-reviewer",
      oneLiner: "A quiet, repository-aware sanity check for every pull request on small GitHub teams.",
      targetCustomer: "Indie developers and small engineering teams maintaining GitHub repositories",
    },
    evidence: {
      contractVersion: 1,
      accepted: BASE.accepted,
      rejected: BASE.rejected,
      sources: sourceList(ALL_PAGES),
    },
    market: {
      summary: `AI code review is an established category: the market was ${tok(EV.statMeasured)} and analysts project ${tok(EV.statProjected)}. Adoption is mainstream, at ${tok(EV.statAdoption)}.`,
      statIds: [EV.statMeasured.id, EV.statProjected.id, EV.statAdoption.id],
    },
    competitors: [
      {
        name: "CodeRabbit",
        priceIds: [EV.priceCodeRabbit.id],
        notes: `Per-seat pricing at ${tok(EV.priceCodeRabbit)} targets teams that want broad automated review.`,
      },
      {
        name: "Graphite",
        priceIds: [EV.priceGraphite.id],
        notes: "Bundles review with stacked pull requests, which suits teams already living in its workflow.",
      },
      { name: "Qodo", priceIds: [EV.priceQodo.id] },
    ],
    community: {
      summary: `Small teams describe review fatigue rather than a lack of tooling, for example ${tok(EV.quoteHn)}.`,
      quoteIds: [EV.quoteHn.id, EV.quoteForum.id],
    },
    keywords: [
      { term: "ai code review", volume: 2400, competition: 0.42, cpc: 6.5, source: "provider" },
      { term: "automated pull request review", volume: 320, competition: 0.31, cpc: 4.1, source: "provider" },
    ],
    goToMarket: {
      positioning: "A low-noise reviewer that explains what changed and flags the few risks worth a senior engineer's attention.",
      channels: ["GitHub Marketplace listing", "Open-source maintainer outreach"],
      pricingNotes: `Undercut per-seat incumbents such as ${tok(EV.priceCodeRabbit)} with a simple team plan.`,
    },
    whyNow: "AI-generated code is increasing review load faster than small teams can add reviewers.",
    howItWorks: [
      "Install — Add the GitHub App to a repository in 2 clicks.",
      "Review — Get one short summary and at most 3 risks per pull request.",
    ],
    scores: { opportunity: 7.5, pain: 8, timing: 8, builderConfidence: 7, execution: 7.5 },
    editorial: {
      productName: "ReviewLoom",
      dontBuildYet: "Do not build IDE plugins or self-hosted runners in the first 30 days.",
      problemNarrative:
        "Small GitHub teams merge more AI-assisted code than ever, and review has become the bottleneck. Maintainers describe queues of pull requests that nobody has time to read closely, and bots that bury the one useful comment under noise.",
      solutionNarrative:
        "ReviewLoom reads each pull request with the repository's own conventions in mind and posts one short summary with the few risks worth a human look.",
      competitiveNarrative:
        "CodeRabbit and Qodo sell broad per-seat review; Graphite bundles review with stacked pull requests. ReviewLoom stays quiet by default and explains its reasoning.",
      pricingTiers: [
        { name: "Solo", price: "$12/month", includes: "One private repository and unlimited public repositories." },
        { name: "Crew", price: "$20/developer/month", includes: "Up to 10 private repositories and shared team rules." },
      ],
      unitEconomics: [{ label: "Model cost per review", value: "$0.04 per pull request" }],
      stackNotes: "Next.js App Router, a GitHub App webhook handler and a queue for review jobs.",
      audienceShort: "small GitHub teams",
      brandBrief: "Calm, precise and quiet; no mascots.",
      yearOne: {
        funnel: [
          { stage: "Marketplace visitors", count: 1200 },
          { stage: "Private-repository trials", count: 120 },
          { stage: "Paying Crew accounts", count: 45 },
        ],
        tier: "Crew",
        payingAccounts: 45,
        seatsPerAccount: 5,
        assumptions: "Five paid developers per Crew account on average.",
      },
      dataModel: [
        { table: "repositories", columns: "id, workspace_id, github_repo_id, name" },
        { table: "reviews", columns: "id, repository_id, pr_number, summary, created_at" },
      ],
    },
    provenance: {
      providerCalls: [
        { provider: "fixture", operation: "synthesis:fixture-synthesis", costUsd: 0 },
        { provider: "fixture", operation: "search:fixture-search", costUsd: 0 },
      ],
      costUsd: 0,
      ranAt: "2026-09-30T12:05:00.000Z",
      models: { synthesis: "fixture-synthesis", search: "fixture-search", keywordData: "fixture-keywords" },
      attempts: {
        brief_normalization: 1,
        market_stats: 1,
        competitors: 1,
        community_signals: 2,
        evidence_extraction: 1,
        keywords_demand: 1,
        editorial_synthesis: 1,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJson(value: unknown): Json {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  if (!isRecord(parsed)) throw new Error("fixture: not a JSON object");
  return parsed;
}

/** A fresh JSON round trip of the valid fixture record. */
function fresh(): Json {
  return toJson(buildRecord());
}

function segments(pathText: string): Array<string | number> {
  if (pathText === "") return [];
  return pathText
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

function getAt(root: unknown, pathText: string): unknown {
  let node: unknown = root;
  for (const key of segments(pathText)) {
    if (typeof key === "number") {
      if (!Array.isArray(node)) throw new Error(`fixture: ${pathText} is not an array at [${key}]`);
      node = node[key];
    } else {
      if (!isRecord(node)) throw new Error(`fixture: ${pathText} is not an object at .${key}`);
      node = node[key];
    }
  }
  return node;
}

function setAt(root: unknown, pathText: string, value: unknown): void {
  const keys = segments(pathText);
  const last = keys.pop();
  const parent = getAt(root, keys.join("."));
  if (typeof last === "number" && Array.isArray(parent)) parent[last] = value;
  else if (typeof last === "string" && isRecord(parent)) parent[last] = value;
  else throw new Error(`fixture: cannot set ${pathText}`);
}

function deleteAt(root: unknown, pathText: string): void {
  const keys = segments(pathText);
  const last = keys.pop();
  const parent = getAt(root, keys.join("."));
  if (typeof last !== "string" || !isRecord(parent)) throw new Error(`fixture: cannot delete ${pathText}`);
  delete parent[last];
}

function textAt(root: unknown, pathText: string): string {
  const value = getAt(root, pathText);
  if (typeof value !== "string") throw new Error(`fixture: ${pathText} is not text`);
  return value;
}

function arrayAt(root: unknown, pathText: string): unknown[] {
  const value = getAt(root, pathText);
  if (!Array.isArray(value)) throw new Error(`fixture: ${pathText} is not an array`);
  return value;
}

/** Rename every occurrence of an id (the item and all references to it). */
function renameId(record: Json, from: string, to: string): Json {
  return toJson(JSON.parse(JSON.stringify(record).split(from).join(to)));
}

function issuesOf(record: unknown): string[] {
  try {
    parseResearchRecord(record);
  } catch (error) {
    if (error instanceof LegacyResearchRecordError) throw error;
    if (error instanceof ResearchRecordParseError) return error.issues;
    throw error;
  }
  return [];
}

function expectRejected(record: unknown, ...patterns: RegExp[]): string[] {
  const issues = issuesOf(record);
  expect(issues.length, "expected the record to be rejected").toBeGreaterThan(0);
  const text = issues.join("\n");
  for (const pattern of patterns) expect(text).toMatch(pattern);
  return issues;
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Valid records
// ---------------------------------------------------------------------------

describe("parseResearchRecord: valid records", () => {
  it("builds its fixture from accepted evidence only", () => {
    expect(BASE.accepted).toHaveLength(9);
    expect(BASE.rejected.map((r) => r.reason).sort()).toEqual(["source_unreadable", "span_not_found"]);
  });

  it("parses a record built from accepted evidence and returns a fresh deep copy", () => {
    const input = fresh();
    const parsed = parseResearchRecord(input);
    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    const shared = [
      "brief",
      "evidence",
      "evidence.accepted",
      "evidence.accepted[0]",
      `evidence.accepted[${indexOfAccepted(EV.statMeasured)}].amount`,
      `evidence.accepted[${indexOfAccepted(EV.priceCodeRabbit)}].price`,
      "evidence.rejected[0]",
      "evidence.sources[0]",
      "evidence.sources[0].roles",
      "market.statIds",
      "competitors[0]",
      "competitors[0].priceIds",
      "community.quoteIds",
      "keywords[0]",
      "goToMarket.channels",
      "howItWorks",
      "scores",
      "editorial.pricingTiers[0]",
      "editorial.yearOne.funnel[0]",
      "editorial.dataModel[0]",
      "provenance.providerCalls[0]",
      "provenance.models",
      "provenance.attempts",
    ].filter((p) => getAt(parsed, p) === getAt(input, p));
    expect(shared).toEqual([]);

    parsed.competitors[0]?.priceIds.push("p_000000000000");
    parsed.market.statIds.length = 0;
    expect(input).toEqual(fresh());
  });

  it("trims editorial strings in the copy and leaves the input alone", () => {
    const input = fresh();
    setAt(input, "market.summary", `  ${textAt(input, "market.summary")}\n`);
    setAt(input, "howItWorks[0]", `\t${textAt(input, "howItWorks[0]")}  `);
    const parsed = parseResearchRecord(input);
    expect(parsed.market.summary).toBe(textAt(fresh(), "market.summary"));
    expect(parsed.howItWorks[0]).toBe(textAt(fresh(), "howItWorks[0]"));
    expect(textAt(input, "market.summary").startsWith("  ")).toBe(true);
  });

  it("accepts a record without the optional scores, editorial and competitor notes", () => {
    const input = fresh();
    deleteAt(input, "scores");
    deleteAt(input, "editorial");
    deleteAt(input, "competitors[0].notes");
    deleteAt(input, "competitors[1].notes");
    const parsed = parseResearchRecord(input);
    expect(parsed.scores).toBeUndefined();
    expect(parsed.editorial).toBeUndefined();
    expect(parsed.competitors[0]).toEqual({ name: "CodeRabbit", priceIds: [EV.priceCodeRabbit.id] });
  });

  it("accepts scores without the optional execution score", () => {
    const input = fresh();
    deleteAt(input, "scores.execution");
    expect(parseResearchRecord(input).scores).toEqual({ opportunity: 7.5, pain: 8, timing: 8, builderConfidence: 7 });
  });

  it("accepts a live-mode record", () => {
    const input = fresh();
    setAt(input, "mode", "live");
    expect(parseResearchRecord(input).mode).toBe("live");
  });
});

// ---------------------------------------------------------------------------
// Legacy and version handling
// ---------------------------------------------------------------------------

const RECORDS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../engine/records");
const COMMITTED_RECORDS = readdirSync(RECORDS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

function readCommitted(file: string): Json {
  return toJson(JSON.parse(readFileSync(path.join(RECORDS_DIR, file), "utf8")));
}

function legacyError(record: unknown): LegacyResearchRecordError {
  try {
    parseResearchRecord(record);
  } catch (error) {
    if (error instanceof LegacyResearchRecordError) return error;
    throw error;
  }
  throw new Error("expected LegacyResearchRecordError");
}

describe("parseResearchRecord: legacy and unsupported versions", () => {
  it("finds committed engine records to check", () => {
    expect(COMMITTED_RECORDS.length).toBeGreaterThan(0);
  });

  it.each(COMMITTED_RECORDS)("refuses committed %s if it is contract v1, and parses it if it is v2", (file) => {
    const record = readCommitted(file);
    if (record.contractVersion !== 1) {
      expect(parseResearchRecord(record).contractVersion).toBe(2);
      return;
    }
    const error = legacyError(record);
    expect(error).toBeInstanceOf(ResearchRecordParseError);
    expect(error.name).toBe("LegacyResearchRecordError");
    expect(error.message).toMatch(/contract v1 \(legacy\)/);
    expect(error.message).toMatch(/evidence was not accepted before writing/);
    expect(error.message).toMatch(/npm run engine:research -- --brief <brief\.json> --live/);
    expect(error.message).toMatch(/cannot be compiled or pass the engine audit/);
    expect(error.issues).toEqual([error.message]);
    expect(error.slug).toBe(getAt(record, "brief.slug"));
    // The history-only reader still reads it.
    expect(readLegacyResearchRecordV1(record).contractVersion).toBe(1);
  });

  it("refuses any contractVersion 1 object as legacy, however it is shaped", () => {
    const relabeled = fresh();
    setAt(relabeled, "contractVersion", 1);
    expect(legacyError(relabeled).slug).toBe("ai-code-reviewer");
    const bare = legacyError({ contractVersion: 1 });
    expect(bare.slug).toBeUndefined();
    expect(bare.message).toMatch(/npm run engine:research -- --brief <brief\.json> --live/);
    // A slug that is not a plain slug never reaches the message.
    expect(legacyError({ contractVersion: 1, brief: { slug: "x\n$(rm -rf ~)" } }).message).not.toMatch(/rm -rf/);
  });

  it("refuses a v1-shaped record relabeled contractVersion 2, listing what is missing", () => {
    const file = must(
      COMMITTED_RECORDS.find((f) => readCommitted(f).contractVersion === 1),
      "a committed v1 record",
    );
    const record = readCommitted(file);
    setAt(record, "contractVersion", 2);
    const issues = expectRejected(
      record,
      /^pipelineVersion: /m,
      /^mode: /m,
      /^evidence: required object/m,
      /^market\.stats: unknown field/m,
      /^market\.statIds: required array/m,
      /^community\.signals: unknown field/m,
      /^competitors\[0\]\.pricing: unknown field/m,
      /^provenance\.models: required object/m,
    );
    expect(issues.some((i) => /legacy/i.test(i))).toBe(false);
  });

  it.each([
    ["3", 3],
    ['"2"', "2"],
    ["missing", undefined],
    ["null", null],
  ])("rejects contractVersion %s without calling it legacy", (_label, version) => {
    const input = fresh();
    if (version === undefined) deleteAt(input, "contractVersion");
    else setAt(input, "contractVersion", version);
    expectRejected(input, /^contractVersion: unsupported value/m);
  });

  it.each([
    ["not an object", "record"],
    ["an array", [1, 2]],
    ["null", null],
  ])("rejects a root that is %s", (_label, value) => {
    expectRejected(value, /^root: expected an object/m);
  });

  it.each([
    ["1", 1],
    ["3", 3],
    ["missing", undefined],
  ])("rejects pipelineVersion %s", (_label, version) => {
    const input = fresh();
    if (version === undefined) deleteAt(input, "pipelineVersion");
    else setAt(input, "pipelineVersion", version);
    expectRejected(input, /^pipelineVersion: expected 2/m);
  });

  it("rejects an evidence block whose contractVersion is not 1", () => {
    const input = fresh();
    setAt(input, "evidence.contractVersion", 2);
    expectRejected(input, /^evidence\.contractVersion: expected 1/m);
  });
});

// ---------------------------------------------------------------------------
// Offline re-validation of accepted evidence
// ---------------------------------------------------------------------------

describe("parseResearchRecord: accepted evidence is re-validated", () => {
  const statIndex = indexOfAccepted(EV.statMeasured);
  const priceIndex = indexOfAccepted(EV.priceCodeRabbit);
  const quoteIndex = indexOfAccepted(EV.quoteHn);

  it("rejects a flipped amount", () => {
    const input = fresh();
    setAt(input, `evidence.accepted[${statIndex}].amount.value`, "1.5");
    // Before ruling R1 the claim check fails; after it, the id (which hashes the claim) does.
    expectRejected(input, new RegExp(`^evidence\\.accepted\\[${statIndex}\\]: .*(?:amount_mismatch|id:)`, "m"));
  });

  it("rejects a dropped price qualifier", () => {
    const input = fresh();
    setAt(input, `evidence.accepted[${priceIndex}].price.qualifiers`, []);
    expectRejected(input, new RegExp(`^evidence\\.accepted\\[${priceIndex}\\]: .*(?:qualifier_dropped|id:)`, "m"));
  });

  it("rejects a changed excerpt whose digests were not recomputed", () => {
    const input = fresh();
    setAt(input, `evidence.accepted[${statIndex}].excerpt`, "The AI code review market was valued at $1.5 billion in 2025.");
    expectRejected(input, new RegExp(`^evidence\\.accepted\\[${statIndex}\\]: excerptSha256`, "m"));
  });

  it("rejects a changed excerpt even when its id and digest are recomputed", () => {
    // acceptEvidence computes the id and digest for the altered excerpt: the
    // subject is not part of the id (ruling R1), so this is exactly the id a
    // forger would recompute for the original claim on the altered text.
    const altered = "The pet grooming market was valued at $1.4 billion in 2025.";
    const oracle = must(
      accept([{ ...PAGES.report, text: altered }], {
        marketStats: [
          {
            sourceUrl: PAGES.report.url,
            supportingText: altered,
            subject: "pet grooming market",
            metric: "market_size",
            amountText: "$1.4 billion",
            year: 2025,
            periodKind: "measured",
          },
        ],
      }).accepted[0],
      "oracle stat",
    );
    const input = renameId(fresh(), EV.statMeasured.id, oracle.id);
    setAt(input, `evidence.accepted[${statIndex}].excerpt`, oracle.excerpt);
    setAt(input, `evidence.accepted[${statIndex}].excerptSha256`, oracle.excerptSha256);
    const issues = expectRejected(
      input,
      new RegExp(`^evidence\\.accepted\\[${statIndex}\\]: claim: subject_not_in_context`, "m"),
    );
    expect(issues.join("\n")).not.toMatch(/excerptSha256|id: does not match/);
  });

  it("rejects a changed id, even when every reference follows it", () => {
    const input = renameId(fresh(), EV.statMeasured.id, forgeId(EV.statMeasured.id));
    expectRejected(input, new RegExp(`^evidence\\.accepted\\[${statIndex}\\]: id:`, "m"));
  });

  it("rejects an accepted item whose source is listed as unreadable", () => {
    const input = fresh();
    setAt(input, `evidence.sources[${sourceIndex(PAGES.hn)}]`, {
      url: canonical(PAGES.hn.url),
      roles: ["community"],
      status: "unreadable",
      detail: "HTTP 403",
    });
    expectRejected(input, new RegExp(`^evidence\\.accepted\\[${quoteIndex}\\]: source: listed as unreadable, not read`, "m"));
  });

  it("rejects an accepted item whose source is missing from evidence.sources", () => {
    const input = fresh();
    arrayAt(input, "evidence.sources").splice(sourceIndex(PAGES.hn), 1);
    expectRejected(input, new RegExp(`^evidence\\.accepted\\[${quoteIndex}\\]: source: not listed`, "m"));
  });

  it("rejects a duplicated accepted item", () => {
    const input = fresh();
    const accepted = arrayAt(input, "evidence.accepted");
    accepted.push(structuredClone(accepted[0]));
    expectRejected(input, new RegExp(`^evidence\\.accepted\\[${accepted.length - 1}\\]: duplicate evidence id`, "m"));
  });

  it("rejects more accepted items of one kind than the cap allows", () => {
    const page: Page = {
      url: "https://forum.example.com/t/many-review-complaints",
      title: "Review complaints",
      roles: ["community"],
      text: [
        "Review queues doubled after we adopted AI pair programming tools.",
        "Nobody on our team trusts the bot summaries without checking them.",
        "Every pull request now needs a second human pass anyway.",
        "The noisy comments train everyone to ignore the useful ones.",
        "We turned the reviewer off after a single painful sprint.",
        "Small teams cannot afford a reviewer that cries wolf daily.",
      ].join(" "),
    };
    const sentences = must(page.text, "page text").split(/(?<=\.) /);
    const extra = accept([page], { quotes: sentences.map((text) => ({ sourceUrl: page.url, text })) }).accepted;
    expect(extra).toHaveLength(6);
    const input = fresh();
    arrayAt(input, "evidence.accepted").push(...arrayAt(toJson({ extra }), "extra"));
    arrayAt(input, "evidence.sources").push(...sourceList([page]));
    expect(arrayAt(input, "evidence.accepted").filter((e) => isRecord(e) && e.kind === "community_quote")).toHaveLength(9);
    expectRejected(
      input,
      new RegExp(`^evidence\\.accepted: 9 community_quote items; at most ${EVIDENCE_LIMITS.maxAccepted.community_quote}`, "m"),
    );
  });

  const VERIFIED_PATHS = [
    "",
    "brief",
    "evidence",
    "evidence.accepted[0]",
    `evidence.accepted[${statIndex}].amount`,
    `evidence.accepted[${statIndex}].period`,
    `evidence.accepted[${priceIndex}].price`,
    "evidence.rejected[0]",
    "evidence.sources[0]",
    "market",
    "competitors[0]",
    "community",
    "keywords[0]",
    "goToMarket",
    "scores",
    "editorial",
    "editorial.pricingTiers[0]",
    "editorial.unitEconomics[0]",
    "editorial.dataModel[0]",
    "editorial.yearOne",
    "editorial.yearOne.funnel[0]",
    "provenance",
    "provenance.providerCalls[0]",
    "provenance.models",
  ];

  it.each(VERIFIED_PATHS.map((p) => [p === "" ? "(root)" : p, p]))(
    "rejects a stray verified: true at %s",
    (_label, at) => {
      const input = fresh();
      setAt(input, at === "" ? "verified" : `${at}.verified`, true);
      expectRejected(input, /verified/);
    },
  );
});

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

describe("parseResearchRecord: references resolve to accepted evidence", () => {
  it.each([
    ["market.statIds", () => EV.statMeasured.id, "market_stat"],
    ["competitors[0].priceIds", () => EV.priceCodeRabbit.id, "competitor_price"],
    ["community.quoteIds", () => EV.quoteHn.id, "community_quote"],
  ])("rejects an unknown id in %s", (listPath, realId, kind) => {
    const input = fresh();
    setAt(input, `${listPath}[0]`, forgeId(realId()));
    expectRejected(input, new RegExp(`^${escapeRe(listPath)}\\[0\\]: "[a-z]_[0-9a-f]{12}" is not an accepted ${kind}`, "m"));
  });

  it("rejects a reference to a candidate that was rejected", () => {
    // The id the rejected "47 PRs" quote would have had, if its page said it.
    const would = must(
      accept([{ ...PAGES.hn, text: REJECTED_QUOTE }], { quotes: [{ sourceUrl: PAGES.hn.url, text: REJECTED_QUOTE }] })
        .accepted[0],
      "would-be id",
    );
    const input = fresh();
    expect(JSON.stringify(getAt(input, "evidence.rejected"))).toContain("47 PRs");
    arrayAt(input, "community.quoteIds").push(would.id);
    setAt(input, "community.summary", `${textAt(input, "community.summary")} One reviewer said ${tok(would)}.`);
    expectRejected(
      input,
      /^community\.quoteIds\[2\]: "q_[0-9a-f]{12}" is not an accepted community_quote/m,
      /^community\.summary: unknown evidence id "q_[0-9a-f]{12}"/m,
    );
  });

  it("rejects an id of the wrong kind", () => {
    const input = fresh();
    setAt(input, "market.statIds[0]", EV.quoteForum.id);
    expectRejected(input, /^market\.statIds\[0\]: "q_[0-9a-f]{12}" is a community_quote, not a market_stat/m);
  });

  it("rejects a competitor pointing at another vendor's price", () => {
    const input = fresh();
    setAt(input, "competitors[0].priceIds", [EV.priceGraphite.id]);
    expectRejected(input, /^competitors\[0\]\.priceIds\[0\]: price "p_[0-9a-f]{12}" is for Graphite, not CodeRabbit/m);
  });

  it("rejects a competitor name that differs from its price's vendor only by case", () => {
    const input = fresh();
    setAt(input, "competitors[2].name", "qodo");
    expectRejected(input, /^competitors\[2\]\.priceIds\[0\]: price "p_[0-9a-f]{12}" is for Qodo, not qodo/m);
  });

  it("rejects the same quote id twice to reach the minimum", () => {
    const input = fresh();
    setAt(input, "community.quoteIds", [EV.quoteHn.id, EV.quoteHn.id]);
    expectRejected(
      input,
      /^community\.quoteIds\[1\]: duplicate id/m,
      /^community\.quoteIds: need ≥2 accepted community quotes with distinct text \(got 1\)/m,
    );
  });

  it("rejects two quotes with the same text from different pages", () => {
    const input = fresh();
    setAt(input, "community.quoteIds", [EV.quoteHn.id, EV.quoteMirror.id]);
    expectRejected(
      input,
      /^community\.quoteIds\[1\]: same quote text as community\.quoteIds\[0\]/m,
      /^community\.quoteIds: need ≥2 accepted community quotes with distinct text \(got 1\)/m,
    );
  });

  it("rejects too few market stats", () => {
    const input = fresh();
    setAt(input, "market.statIds", [EV.statMeasured.id]);
    expectRejected(input, /^market\.statIds: need ≥2/m);
  });

  it("rejects a repeated stat id", () => {
    const input = fresh();
    setAt(input, "market.statIds", [EV.statMeasured.id, EV.statMeasured.id]);
    expectRejected(input, /^market\.statIds\[1\]: duplicate id/m, /^market\.statIds: need ≥2/m);
  });

  it("rejects fewer than three priced competitors", () => {
    const input = fresh();
    arrayAt(input, "competitors").pop();
    expectRejected(input, /^competitors: need ≥3/m);
  });

  it("rejects a competitor without a price", () => {
    const input = fresh();
    setAt(input, "competitors[1].priceIds", []);
    expectRejected(input, /^competitors\[1\]\.priceIds: need ≥1/m);
  });

  it.each([
    ["case", "codeRabbit"],
    ["vendor key", "Code Rabbit"],
  ])("rejects competitor names that repeat by %s", (_label, name) => {
    const input = fresh();
    setAt(input, "competitors[1].name", name);
    expectRejected(input, /^competitors\[1\]\.name: repeats competitors\[0\]\.name/m);
  });
});

// ---------------------------------------------------------------------------
// Editorial text
// ---------------------------------------------------------------------------

const REJECTED_CLAIMS = ["47 PRs on a team of 8", "60% of time reviewing versus 25% coding", "$5k"];
const FIELDS_UNDER_TEST = ["market.summary", "editorial.problemNarrative", "competitors[0].notes", "whyNow"];

describe("parseResearchRecord: fact-bearing text carries figures only through tokens", () => {
  it.each(FIELDS_UNDER_TEST.flatMap((field) => REJECTED_CLAIMS.map((claim) => [claim, field])))(
    'rejects "%s" stated in %s',
    (claim, field) => {
      const input = fresh();
      setAt(input, field, `${textAt(input, field)} Teams report ${claim}.`);
      expectRejected(input, new RegExp(`^${escapeRe(field)}: unbound figure`, "m"));
    },
  );

  it.each(FACT_BEARING_FIELDS.map((field) => [field.replace("[]", "[0]")]))(
    "applies the figure rule to fact-bearing field %s",
    (field) => {
      const input = fresh();
      setAt(input, field, `${textAt(input, field)} It saves $5k.`);
      expectRejected(input, new RegExp(`^${escapeRe(field)}: unbound figure "\\$5k"`, "m"));
    },
  );

  it("accepts an accepted-evidence token where a fact-bearing field needs a figure", () => {
    const input = fresh();
    setAt(input, "whyNow", `${textAt(input, "whyNow")} The category already reached ${tok(EV.statMeasured)}.`);
    setAt(input, "editorial.problemNarrative", `${textAt(input, "editorial.problemNarrative")} One maintainer put it plainly: ${tok(EV.quoteForum)}.`);
    const parsed = parseResearchRecord(input);
    expect(parsed.whyNow).toContain(tok(EV.statMeasured));
  });

  it("accepts a qualitative paraphrase of the evidence", () => {
    const input = fresh();
    setAt(
      input,
      "editorial.problemNarrative",
      "Reviewers on small teams describe spending more of their week reading pull requests than writing code, and they say automated reviewers bury the one useful comment under noise.",
    );
    setAt(input, "community.summary", "Maintainers want a quiet sanity check, not another stream of comments nobody reads.");
    expect(() => parseResearchRecord(input)).not.toThrow();
  });

  it("allows figures in proposal fields", () => {
    const input = fresh();
    setAt(input, "editorial.stackNotes", "Cache 30 days of review history and cap each summary at 120 words.");
    setAt(input, "goToMarket.channels[1]", "Post 2 build logs a week on X");
    expect(() => parseResearchRecord(input)).not.toThrow();
  });

  it.each([
    ["editorial.stackNotes"],
    ["howItWorks[0]"],
    ["goToMarket.channels[0]"],
    ["editorial.pricingTiers[0].includes"],
    ["editorial.yearOne.assumptions"],
    ["brief.targetCustomer"],
  ])("rejects an unknown evidence token in %s", (field) => {
    const input = fresh();
    setAt(input, field, `${textAt(input, field)} ${tok({ ...EV.statMeasured, id: forgeId(EV.statMeasured.id) })}`);
    expectRejected(input, new RegExp(`^${escapeRe(field)}: unknown evidence id`, "m"));
  });

  it("rejects a malformed evidence token", () => {
    const input = fresh();
    setAt(input, "editorial.stackNotes", `${textAt(input, "editorial.stackNotes")} [[ev:s_123]]`);
    expectRejected(input, /^editorial\.stackNotes: malformed evidence token/m);
  });

  it("refuses evidence tokens in brief.oneLiner even when they resolve", () => {
    const input = fresh();
    setAt(input, "brief.oneLiner", `${textAt(input, "brief.oneLiner")} ${tok(EV.statMeasured)}`);
    expectRejected(input, /^brief\.oneLiner: evidence tokens are not allowed/m);
  });

  it("rejects a text field above the size bound", () => {
    const input = fresh();
    setAt(input, "whyNow", "a".repeat(RESEARCH_RECORD_V2_LIMITS.textChars + 1));
    expectRejected(input, new RegExp(`^whyNow: at most ${RESEARCH_RECORD_V2_LIMITS.textChars} characters`, "m"));
  });

  it.each([
    ["whyNow", ""],
    ["market.summary", "   "],
    ["community.summary", 42],
    ["goToMarket.positioning", null],
  ])("rejects an empty or non-string %s", (field, value) => {
    const input = fresh();
    setAt(input, field, value);
    expectRejected(input, new RegExp(`^${escapeRe(field)}: required non-empty string`, "m"));
  });
});

// ---------------------------------------------------------------------------
// Year-one plan
// ---------------------------------------------------------------------------

describe("parseResearchRecord: year-one plan", () => {
  it("accepts a per-seat plan on a per-developer tier", () => {
    const parsed = parseResearchRecord(fresh());
    expect(parsed.editorial?.yearOne).toEqual({
      funnel: [
        { stage: "Marketplace visitors", count: 1200 },
        { stage: "Private-repository trials", count: 120 },
        { stage: "Paying Crew accounts", count: 45 },
      ],
      tier: "Crew",
      payingAccounts: 45,
      seatsPerAccount: 5,
      assumptions: "Five paid developers per Crew account on average.",
    });
  });

  it("rejects payingAccounts 0.4 instead of rounding it", () => {
    const input = fresh();
    setAt(input, "editorial.yearOne.payingAccounts", 0.4);
    expectRejected(input, /^editorial\.yearOne\.payingAccounts: must be a whole number ≥ 1 \(got 0\.4\)/m);
  });

  it("rejects a last funnel stage that differs from payingAccounts", () => {
    const input = fresh();
    setAt(input, "editorial.yearOne.payingAccounts", 40);
    expectRejected(input, /^editorial\.yearOne\.payingAccounts: must equal the last funnel stage count \(45\)/m);
  });

  it("rejects an unknown tier", () => {
    const input = fresh();
    setAt(input, "editorial.yearOne.tier", "Enterprise");
    expectRejected(input, /^editorial\.yearOne\.tier: "Enterprise" is not a pricing tier/m);
  });

  it("rejects more than one seat on a flat tier", () => {
    const input = fresh();
    setAt(input, "editorial.yearOne.tier", "Solo");
    setAt(input, "editorial.yearOne.seatsPerAccount", 2);
    expectRejected(input, /^editorial\.yearOne\.seatsPerAccount: must be 1 for a flat tier price/m);
  });

  it("rejects a year-one plan without pricing tiers", () => {
    const input = fresh();
    deleteAt(input, "editorial.pricingTiers");
    expectRejected(input, /^editorial\.yearOne: needs editorial\.pricingTiers/m);
  });

  it("rejects the legacy monthlyRevenuePerAccount field", () => {
    const input = fresh();
    setAt(input, "editorial.yearOne.monthlyRevenuePerAccount", 100);
    expectRejected(input, /^editorial\.yearOne\.monthlyRevenuePerAccount: unknown field/m);
  });

  it("rejects a growing funnel", () => {
    const input = fresh();
    setAt(input, "editorial.yearOne.funnel[1].count", 5000);
    expectRejected(input, /^editorial\.yearOne\.funnel: stage counts must not increase/m);
  });

  it("rejects duplicate pricing tier names", () => {
    const input = fresh();
    setAt(input, "editorial.pricingTiers[1].name", "solo");
    expectRejected(input, /^editorial\.pricingTiers\[1\]\.name: repeats editorial\.pricingTiers\[0\]\.name/m);
  });
});

// ---------------------------------------------------------------------------
// Closed schema and shape
// ---------------------------------------------------------------------------

describe("parseResearchRecord: closed schema and shape", () => {
  it("rejects an unknown top-level key", () => {
    const input = fresh();
    setAt(input, "notes", "operator scratch");
    expectRejected(input, /^notes: unknown field/m);
  });

  it("rejects a v1-style market.stats riding along", () => {
    const input = fresh();
    setAt(input, "market.stats", [{ claim: "AI code review market", value: "$1.4B", citation: { url: PAGES.report.url, title: "x" } }]);
    expectRejected(input, /^market\.stats: unknown field/m);
  });

  it.each([
    ["provenance.models.embedding", "text-embedding"],
    ["goToMarket.audience", "teams"],
    ["editorial.pricingTiers[0].currency", "USD"],
    ["editorial.dataModel[0].indexes", "id"],
    ["evidence.sources[0].text", "full page body"],
    ["brief.audience", "teams"],
  ])("rejects an unknown nested key %s", (field, value) => {
    const input = fresh();
    setAt(input, field, value);
    expectRejected(input, new RegExp(`^${escapeRe(field)}: unknown field`, "m"));
  });

  it.each([
    ["missing", undefined],
    ["replay", "replay"],
    ["LIVE", "LIVE"],
  ])("rejects mode %s", (_label, mode) => {
    const input = fresh();
    if (mode === undefined) deleteAt(input, "mode");
    else setAt(input, "mode", mode);
    expectRejected(input, /^mode: expected "live" or "fixture"/m);
  });

  it.each([
    ["a missing keywordData model", (r: Json) => deleteAt(r, "provenance.models.keywordData"), /^provenance\.models\.keywordData: required non-empty string/m],
    ["an empty search model", (r: Json) => setAt(r, "provenance.models.search", ""), /^provenance\.models\.search: required non-empty string/m],
    ["models that are not an object", (r: Json) => setAt(r, "provenance.models", "gpt"), /^provenance\.models: required object/m],
    ["a fractional attempt count", (r: Json) => setAt(r, "provenance.attempts.market_stats", 1.5), /^provenance\.attempts\.market_stats: expected an integer ≥ 0/m],
    ["a negative attempt count", (r: Json) => setAt(r, "provenance.attempts.competitors", -1), /^provenance\.attempts\.competitors: expected an integer ≥ 0/m],
    ["a string attempt count", (r: Json) => setAt(r, "provenance.attempts.competitors", "1"), /^provenance\.attempts\.competitors: expected an integer ≥ 0/m],
    ["an empty step id", (r: Json) => setAt(r, "provenance.attempts", { "": 1 }), /^provenance\.attempts: "" is not a step id/m],
    ["attempts that are an array", (r: Json) => setAt(r, "provenance.attempts", [1, 2]), /^provenance\.attempts: required object/m],
    ["a ranAt that is not ISO", (r: Json) => setAt(r, "provenance.ranAt", "yesterday"), /^provenance\.ranAt: expected an ISO 8601 time/m],
    ["a negative cost", (r: Json) => setAt(r, "provenance.costUsd", -0.01), /^provenance\.costUsd: expected a finite number ≥ 0/m],
    ["a provider call without an operation", (r: Json) => deleteAt(r, "provenance.providerCalls[0].operation"), /^provenance\.providerCalls\[0\]\.operation: required non-empty string/m],
    ["a provider call whose cost is not a number", (r: Json) => setAt(r, "provenance.providerCalls[0].costUsd", null), /^provenance\.providerCalls\[0\]\.costUsd: expected a finite number ≥ 0/m],
  ])("rejects %s", (_label, mutate, pattern) => {
    const input = fresh();
    mutate(input);
    expectRejected(input, pattern);
  });

  it.each([
    ["three of the four published scores", (r: Json) => deleteAt(r, "scores.timing"), /^scores\.timing: required when scores are present/m],
    ["a score above 10", (r: Json) => setAt(r, "scores.opportunity", 11), /^scores\.opportunity: expected a number from 0 to 10/m],
    ["a negative execution score", (r: Json) => setAt(r, "scores.execution", -1), /^scores\.execution: expected a number from 0 to 10/m],
    ["a non-numeric score", (r: Json) => setAt(r, "scores.pain", "8"), /^scores\.pain: expected a number from 0 to 10/m],
  ])("rejects %s", (_label, mutate, pattern) => {
    const input = fresh();
    mutate(input);
    expectRejected(input, pattern);
  });

  it.each([
    ["a non-canonical source URL", (r: Json) => setAt(r, "evidence.sources[2].url", "https://www.coderabbit.ai/pricing/?utm_source=x"), /^evidence\.sources\[2\]\.url: must be a canonical http\(s\) URL/m],
    ["a repeated source URL", (r: Json) => setAt(r, "evidence.sources[1].url", canonical(PAGES.report.url)), /^evidence\.sources\[1\]\.url: repeats evidence\.sources\[0\]\.url/m],
    ["empty roles", (r: Json) => setAt(r, "evidence.sources[0].roles", []), /^evidence\.sources\[0\]\.roles: need 1–3 of market, competitors, community/m],
    ["an unknown role", (r: Json) => setAt(r, "evidence.sources[0].roles", ["pricing"]), /^evidence\.sources\[0\]\.roles\[0\]: expected market, competitors or community/m],
    ["a repeated role", (r: Json) => setAt(r, "evidence.sources[0].roles", ["market", "market"]), /^evidence\.sources\[0\]\.roles\[1\]: repeated role/m],
    ["an unknown status", (r: Json) => setAt(r, "evidence.sources[0].status", "ok"), /^evidence\.sources\[0\]\.status: unknown status/m],
    ["a read source without textSha256", (r: Json) => deleteAt(r, "evidence.sources[0].textSha256"), /^evidence\.sources\[0\]\.textSha256: required for a read source/m],
    ["a read source with a malformed textSha256", (r: Json) => setAt(r, "evidence.sources[0].textSha256", "ABC"), /^evidence\.sources\[0\]\.textSha256: expected 64 lowercase hex digits/m],
    ["a read source without retrievedAt", (r: Json) => deleteAt(r, "evidence.sources[0].retrievedAt"), /^evidence\.sources\[0\]\.retrievedAt: required for a read source/m],
    ["a read source with a detail", (r: Json) => setAt(r, "evidence.sources[0].detail", "fine"), /^evidence\.sources\[0\]\.detail: only for a source that was not read/m],
    ["an unread source with retrievedAt", (r: Json) => setAt(r, `evidence.sources[${sourceIndex(PAGES.reddit)}].retrievedAt`, AT), new RegExp(`^evidence\\.sources\\[${sourceIndex(PAGES.reddit)}\\]\\.retrievedAt: only for a read source`, "m")],
    ["an unread source with textSha256", (r: Json) => setAt(r, `evidence.sources[${sourceIndex(PAGES.reddit)}].textSha256`, sha256("x")), new RegExp(`^evidence\\.sources\\[${sourceIndex(PAGES.reddit)}\\]\\.textSha256: only for a read source`, "m")],
    ["a detail above 200 characters", (r: Json) => setAt(r, `evidence.sources[${sourceIndex(PAGES.reddit)}].detail`, "x".repeat(201)), new RegExp(`^evidence\\.sources\\[${sourceIndex(PAGES.reddit)}\\]\\.detail: at most 200 characters`, "m")],
    ["more sources than the bound", (r: Json) => arrayAt(r, "evidence.sources").push(...Array.from({ length: RESEARCH_RECORD_V2_LIMITS.sources }, (_, i) => ({ url: `https://example.com/s/${i}`, roles: ["market"], status: "timeout" }))), new RegExp(`^evidence\\.sources: at most ${RESEARCH_RECORD_V2_LIMITS.sources} entries`, "m")],
  ])("rejects %s", (_label, mutate, pattern) => {
    const input = fresh();
    mutate(input);
    expectRejected(input, pattern);
  });

  it.each([
    ["an unknown rejection reason", (r: Json) => setAt(r, "evidence.rejected[0].reason", "made_up"), /^evidence\.rejected\[0\]\.reason: unknown rejection reason/m],
    ["an unknown kind", (r: Json) => setAt(r, "evidence.rejected[0].kind", "opinion"), /^evidence\.rejected\[0\]\.kind: expected community_quote, market_stat or competitor_price/m],
    ["a candidate above 120 characters", (r: Json) => setAt(r, "evidence.rejected[0].candidate", "x".repeat(121)), /^evidence\.rejected\[0\]\.candidate: at most 120 characters/m],
    ["a detail above 200 characters", (r: Json) => setAt(r, "evidence.rejected[0].detail", "x".repeat(201)), /^evidence\.rejected\[0\]\.detail: at most 200 characters/m],
    ["more rejections than the bound", (r: Json) => setAt(r, "evidence.rejected", Array.from({ length: EVIDENCE_LIMITS.maxRejectedStored + 1 }, () => ({ kind: "market_stat", reason: "amount_mismatch" }))), new RegExp(`^evidence\\.rejected: at most ${EVIDENCE_LIMITS.maxRejectedStored} entries`, "m")],
  ])("rejects %s", (_label, mutate, pattern) => {
    const input = fresh();
    mutate(input);
    expectRejected(input, pattern);
  });

  it.each([
    ["model-sourced keyword metrics", (r: Json) => setAt(r, "keywords[0].source", "model"), /^keywords\[0\]\.source: keyword metrics must be provider-sourced/m],
    ["a negative keyword volume", (r: Json) => setAt(r, "keywords[0].volume", -1), /^keywords\[0\]\.volume: required finite non-negative number/m],
    ["a single GTM channel", (r: Json) => setAt(r, "goToMarket.channels", ["SEO"]), /^goToMarket\.channels: need ≥2/m],
    ["a single how-it-works step", (r: Json) => setAt(r, "howItWorks", ["Install — Add the app."]), /^howItWorks: need ≥2/m],
    ["a slug that is not URL-safe", (r: Json) => setAt(r, "brief.slug", "AI Code Reviewer"), /^brief\.slug: must match/m],
    ["a data model table that is not an identifier", (r: Json) => setAt(r, "editorial.dataModel[0].table", "Repos; DROP"), /^editorial\.dataModel\[0\]\.table: /m],
    ["an empty pricing tier list", (r: Json) => setAt(r, "editorial.pricingTiers", []), /^editorial\.pricingTiers: need ≥1/m],
    ["an empty optional editorial string", (r: Json) => setAt(r, "editorial.brandBrief", ""), /^editorial\.brandBrief: required non-empty string/m],
    ["empty competitor notes", (r: Json) => setAt(r, "competitors[1].notes", " "), /^competitors\[1\]\.notes: required non-empty string/m],
  ])("rejects %s", (_label, mutate, pattern) => {
    const input = fresh();
    mutate(input);
    expectRejected(input, pattern);
  });

  it("collects every issue instead of stopping at the first", () => {
    const input = fresh();
    setAt(input, "mode", "replay");
    setAt(input, "whyNow", "");
    setAt(input, "market.statIds", []);
    setAt(input, "editorial.yearOne.payingAccounts", 0.4);
    setAt(input, "provenance.models.search", "");
    expectRejected(
      input,
      /^mode: /m,
      /^whyNow: /m,
      /^market\.statIds: /m,
      /^editorial\.yearOne\.payingAccounts: /m,
      /^provenance\.models\.search: /m,
    );
  });
});
