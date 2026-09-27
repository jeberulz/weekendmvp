/**
 * WP41-S4 tests: judge prompt, evidence guard, aggregation, findings,
 * caching, and the fixture panel. No key, no network, no spend.
 */

import { describe, expect, it } from "vitest";

import { createMemoryCache } from "./cache.ts";
import { claimsFixtureReply } from "./fixture-replies.ts";
import {
  aggregate,
  buildJudgeMessages,
  estimateJudgeWorstCaseUsd,
  judgeFindings,
  judgeInputText,
  runJudgeLayer,
  validateJudgement,
  type Judgement,
  type JudgeSpec,
  type JudgeThresholds,
} from "./judges.ts";
import { createEvalLlm } from "./llm.ts";
import type { FixtureChatBody, FixtureReply } from "./providers/fixtures.ts";
import type { ModelRates } from "./providers/openrouter.ts";
import { DIMENSIONS, JUDGE_MARKER, RUBRIC_VERSION } from "./rubric.ts";

const SECTIONS = [
  { title: "The Problem", content: "Freelancers chase late invoices by hand every month. It is **slow** and awkward." },
  { title: "Market Research", content: "Grand View puts the market at $4.2 billion in 2025." },
  { title: "AI Prompts to Build This", content: "```text\nBuild the app\n```" },
  { title: "Sources", content: "- [Grand View — invoicing market](https://grandviewresearch.com/x)\n- [Related](/ideas/y)" },
];
const EXCLUDE = ["AI Prompts to Build This", "Sources"];
const JUDGES: JudgeSpec[] = [
  { model: "a/haiku", maxOutputTokens: 1200 },
  { model: "g/flash", maxOutputTokens: 2000, reasoning: "low" },
  { model: "o/luna", maxOutputTokens: 3000, reasoning: "low" },
];
const THRESHOLDS: JudgeThresholds = { failAtOrBelow: 2, warnAtOrBelow: 3, disagreeSpread: 2, minValidJudges: 2 };
const PAGE = judgeInputText(SECTIONS, EXCLUDE, "Sources");

function scores(values: Partial<Record<string, [number, string]>>, fill = 4) {
  return Object.fromEntries(
    DIMENSIONS.map((d) => {
      const [score, quote] = values[d] ?? [fill, ""];
      return [d, { score, quote, reason: "r" }];
    }),
  );
}

function judgement(model: string, s: Record<string, [number, string]> = {}, fill = 4): Judgement {
  return { model, scores: validateJudgement(scores(s, fill), PAGE), cached: false };
}

function panelLlm(replies: Record<string, (body: FixtureChatBody) => FixtureReply>) {
  return createEvalLlm({
    mode: "fixture",
    capUsd: 1,
    fixture: {
      models: JUDGES.map((j) => j.model),
      reply: (body) => (replies[body.model] ?? claimsFixtureReply)(body),
    },
  });
}

describe("judge input and prompt", () => {
  it("drops build prompts, keeps source titles only", () => {
    expect(PAGE).toContain("## The Problem");
    expect(PAGE).not.toContain("Build the app");
    expect(PAGE).toContain("- Grand View — invoicing market");
    expect(PAGE).not.toContain("grandviewresearch.com");
    expect(PAGE).not.toContain("Related");
  });

  it("carries the marker, every dimension, and the page", () => {
    const { system, user } = buildJudgeMessages(PAGE);
    expect(system.startsWith(JUDGE_MARKER)).toBe(true);
    for (const d of DIMENSIONS) expect(system).toContain(`"${d}"`);
    expect(user).toContain("$4.2 billion");
    expect(RUBRIC_VERSION).toMatch(/^rubric-v\d+$/);
  });
});

describe("validateJudgement", () => {
  it("keeps low scores only with a verbatim page quote", () => {
    const v = validateJudgement(
      scores({
        slop: [2, "It is slow and awkward."],
        fake_data: [2, "The market is worth $9 billion."],
        verbosity: [5, "made up quote is fine for a high score"],
      }),
      PAGE,
    );
    expect(v.slop).toMatchObject({ score: 2, valid: true });
    expect(v.fake_data).toMatchObject({ score: 2, valid: false });
    expect(v.verbosity).toMatchObject({ score: 5, valid: true });
  });

  it("rounds, and drops out-of-range or missing scores", () => {
    const v = validateJudgement({ specificity: { score: 4.4 }, slop: { score: 9 }, verbosity: { score: "5" } }, PAGE);
    expect(v.specificity?.score).toBe(4);
    expect(v.slop).toBeUndefined();
    expect(v.verbosity?.score).toBe(5);
    expect(v.consistency).toBeUndefined();
  });
});

describe("aggregate and findings", () => {
  it("takes the median and fails a dimension at 2 or below", () => {
    const agg = aggregate([
      judgement("a/haiku", { fake_data: [2, "Grand View puts the market at $4.2 billion in 2025."] }),
      judgement("g/flash", { fake_data: [1, "Grand View puts the market at $4.2 billion in 2025."] }),
      judgement("o/luna", { fake_data: [4, ""] }),
    ]);
    expect(agg.fake_data.median).toBe(2);
    expect(agg.fake_data.lowest?.model).toBe("g/flash");
    const { fails, warns } = judgeFindings(agg, THRESHOLDS);
    expect(fails).toHaveLength(1);
    expect(fails[0].check).toBe("judges.fake_data");
    expect(fails[0].message).toContain("fake_data 2/5 (haiku 2, flash 1, luna 4)");
    expect(fails[0].message).toContain("$4.2 billion");
    expect(warns.map((w) => w.check)).toContain("judges.disagree");
  });

  it("warns at a median of 3 and passes at 4", () => {
    const quote = "Freelancers chase late invoices by hand every month.";
    const agg = aggregate([
      judgement("a/haiku", { slop: [3, quote] }),
      judgement("g/flash", { slop: [3, quote] }),
      judgement("o/luna"),
    ]);
    const { fails, warns } = judgeFindings(agg, THRESHOLDS);
    expect(fails).toEqual([]);
    expect(warns.map((w) => w.check)).toEqual(["judges.slop"]);
  });

  it("ignores invalid scores and flags too few valid ones", () => {
    const agg = aggregate([
      judgement("a/haiku", { consistency: [1, "not on the page at all"] }),
      judgement("g/flash", { consistency: [1, "also invented"] }),
      judgement("o/luna"),
    ]);
    expect(agg.consistency.scores).toEqual([{ model: "o/luna", score: 4 }]);
    const { fails, warns } = judgeFindings(agg, THRESHOLDS);
    expect(fails).toEqual([]);
    expect(warns).toContainEqual({ check: "judges.incomplete", message: "consistency: only 1 valid judge score(s)" });
  });

  it("averages the middle two with an even count", () => {
    const agg = aggregate([judgement("a/haiku", {}, 5), judgement("g/flash", {}, 4)]);
    expect(agg.specificity.median).toBe(4.5);
  });
});

describe("runJudgeLayer", () => {
  const base = { slug: "test-idea", sections: SECTIONS, judges: JUDGES, thresholds: THRESHOLDS, excludeSections: EXCLUDE, sourcesTitle: "Sources" };

  it("runs the fixture panel and passes a solid page", async () => {
    const llm = panelLlm({});
    const result = await runJudgeLayer({ ...base, llm });
    expect(result.fails).toEqual([]);
    expect(result.warns).toEqual([]);
    expect(result.metrics.medians.slop).toBe(4);
    expect(result.metrics.costUsd).toBeGreaterThan(0);
    expect(llm.ledger().map((e) => e.label)).toEqual(JUDGES.map((j) => `judge test-idea ${j.model}`));
  });

  it("sends reasoning effort only for the judges configured with it", async () => {
    const bodies: FixtureChatBody[] = [];
    const record = (body: FixtureChatBody) => (bodies.push(body), claimsFixtureReply(body));
    const llm = panelLlm(Object.fromEntries(JUDGES.map((j) => [j.model, record])));
    await runJudgeLayer({ ...base, llm });
    const byModel = Object.fromEntries(bodies.map((b) => [b.model, b as FixtureChatBody & { reasoning?: unknown }]));
    expect(byModel["a/haiku"].reasoning).toBeUndefined();
    expect(byModel["o/luna"].reasoning).toEqual({ effort: "low" });
    expect(byModel["o/luna"].max_tokens).toBe(3000);
  });

  it("keeps going when one judge fails, and reports it", async () => {
    const llm = panelLlm({ "o/luna": () => ({ text: "I would rather not." }) });
    const result = await runJudgeLayer({ ...base, llm });
    expect(result.metrics.judgesFailed).toBe(1);
    expect(result.warns.map((w) => w.check)).toEqual(["judges.error"]);
    expect(result.metrics.medians.specificity).toBe(4);
  });

  it("fails a sloppy page scored low by two judges with real quotes", async () => {
    const low = (): FixtureReply => ({
      text: JSON.stringify(scores({ slop: [1, "It is slow and awkward."] })),
    });
    const llm = panelLlm({ "a/haiku": low, "g/flash": low });
    const result = await runJudgeLayer({ ...base, llm });
    expect(result.fails.map((f) => f.check)).toEqual(["judges.slop"]);
  });

  it("re-scores an unchanged page from cache for $0", async () => {
    const cache = createMemoryCache();
    await runJudgeLayer({ ...base, llm: panelLlm({}), cache });
    const llm = panelLlm({});
    const second = await runJudgeLayer({ ...base, llm, cache });
    expect(second.metrics.cached).toBe(3);
    expect(second.metrics.costUsd).toBe(0);
    expect(llm.ledger()).toHaveLength(0);
  });

  it("estimates a worst case from each judge's allowance", () => {
    const rate = (p: number, c: number): ModelRates => ({
      id: "x",
      name: "x",
      promptUsd: p,
      completionUsd: c,
      requestUsd: 0,
      contextLength: null,
      supportedParameters: null,
    });
    const rates = new Map(JUDGES.map((j) => [j.model, rate(0.000001, 0.000005)]));
    const usd = estimateJudgeWorstCaseUsd({ sections: SECTIONS, judges: JUDGES, rates, excludeSections: EXCLUDE, sourcesTitle: "Sources" });
    expect(usd).toBeGreaterThan((1200 + 2000 + 3000) * 0.000005);
    expect(() =>
      estimateJudgeWorstCaseUsd({ sections: SECTIONS, judges: JUDGES, rates: new Map(), excludeSections: EXCLUDE, sourcesTitle: "Sources" }),
    ).toThrow(/no price/);
  });
});
