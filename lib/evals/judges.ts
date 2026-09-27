/**
 * WP41-S4. Layer 3: a panel of judges from different model families scores
 * each idea page against the rubric in rubric.ts.
 *
 *   fail  judges.<dimension>   median score at or below failAtOrBelow
 *   warn  judges.<dimension>   median at or below warnAtOrBelow
 *   warn  judges.disagree      valid scores span disagreeSpread or more
 *   warn  judges.incomplete    fewer than minValidJudges valid scores
 *
 * Guard: a score of 3 or lower must quote the page verbatim. A low score
 * whose quote is not on the page is discarded, so a judge cannot invent a
 * criticism. Judges run in parallel and each judgement is cached under
 * page text + rubric version + model.
 */

import { hashKey, type JsonCache } from "./cache.ts";
import { BudgetExceededError, EvalCallError, EvalConfigError } from "./errors.ts";
import { callWithRetry, type EvalLlm } from "./llm.ts";
import {
  estimateInputTokens,
  worstCaseUsd,
  type ChatRequest,
  type ModelRates,
} from "./providers/openrouter.ts";
import { DIMENSIONS, JUDGE_MARKER, renderRubric, RUBRIC_VERSION, type Dimension } from "./rubric.ts";
import { containsVerbatim } from "./text.ts";

export type JudgeSpec = {
  model: string;
  maxOutputTokens: number;
  reasoning?: ChatRequest["reasoning"];
};

export type JudgeThresholds = {
  failAtOrBelow: number;
  warnAtOrBelow: number;
  disagreeSpread: number;
  minValidJudges: number;
};

export type DimensionScore = {
  score: number;
  quote: string;
  reason: string;
  valid: boolean;
  note?: string;
};

export type Judgement = {
  model: string;
  scores: Partial<Record<Dimension, DimensionScore>>;
  cached: boolean;
  error?: string;
};

export type DimensionResult = {
  median: number | null;
  spread: number;
  scores: Array<{ model: string; score: number }>;
  lowest?: { model: string; score: number; quote: string; reason: string };
};

type Section = { title: string; content: string };
type Finding = { check: string; message: string };

/** What judges read: the page body minus build prompts, plus source titles. */
export function judgeInputText(sections: Section[], excludeSections: string[], sourcesTitle: string): string {
  const body = sections
    .filter((s) => !excludeSections.includes(s.title))
    .map((s) => `## ${s.title}\n${s.content.trim()}`)
    .join("\n\n");
  const sources = sections.find((s) => s.title === sourcesTitle)?.content ?? "";
  const titles = [...sources.matchAll(/\[([^\]]*)\]\(https?:\/\/[^)\s]+\)/g)].map((m) => `- ${m[1].trim()}`);
  return titles.length > 0 ? `${body}\n\n## Sources (titles only)\n${titles.join("\n")}` : body;
}

export function buildJudgeMessages(pageText: string): { system: string; user: string } {
  const shape = DIMENSIONS.map((d) => `"${d}":{"score":1-5,"quote":"...","reason":"..."}`).join(",");
  const system = `${JUDGE_MARKER}
You are a strict editor reviewing a published startup idea page. Score the page on each dimension from 1 (bad) to 5 (excellent) using the anchors below. Score the writing and evidence on the page, not whether the idea is good.

${renderRubric()}

Rules:
- Use the whole scale. A 5 means you would publish it unchanged on that dimension.
- For any score of 3 or lower, "quote" must be copied exactly from the page (8 to 300 characters) and show the problem. For 4 or 5, quote the best supporting line or use "".
- "reason" is one sentence, at most 25 words.
- Reply with JSON only: {${shape}}`;
  return { system, user: `PAGE:\n${pageText}` };
}

type RawScore = { score?: unknown; quote?: unknown; reason?: unknown };

/** Validate one judge's reply. Missing or malformed dimensions are left out. */
export function validateJudgement(
  json: unknown,
  pageText: string,
): Partial<Record<Dimension, DimensionScore>> {
  const out: Partial<Record<Dimension, DimensionScore>> = {};
  const obj = (json ?? {}) as Record<string, RawScore>;
  for (const d of DIMENSIONS) {
    const raw = obj[d];
    const score = typeof raw?.score === "number" ? raw.score : Number(raw?.score);
    if (!Number.isFinite(score) || score < 1 || score > 5) continue;
    const rounded = Math.round(score);
    const quote = typeof raw?.quote === "string" ? raw.quote.trim() : "";
    const reason = typeof raw?.reason === "string" ? raw.reason.trim().slice(0, 300) : "";
    if (rounded <= 3 && !containsVerbatim(pageText, quote)) {
      out[d] = { score: rounded, quote, reason, valid: false, note: "low score without a verbatim quote from the page" };
    } else {
      out[d] = { score: rounded, quote, reason, valid: true };
    }
  }
  return out;
}

export async function runJudge(args: {
  llm: EvalLlm;
  spec: JudgeSpec;
  slug: string;
  pageText: string;
  cache?: JsonCache;
}): Promise<Judgement> {
  const key = hashKey(RUBRIC_VERSION, args.spec.model, args.spec.reasoning ?? "", args.pageText);
  // Raw reply cached, so an evidence-guard fix re-applies for free.
  const hit = args.cache?.get<{ raw: unknown }>("judge", key);
  if (hit) return { model: args.spec.model, scores: validateJudgement(hit.raw, args.pageText), cached: true };

  const { system, user } = buildJudgeMessages(args.pageText);
  try {
    const result = await callWithRetry(args.llm, {
      label: `judge ${args.slug} ${args.spec.model}`,
      model: args.spec.model,
      system,
      user,
      maxOutputTokens: args.spec.maxOutputTokens,
      reasoning: args.spec.reasoning,
      json: true,
    });
    args.cache?.set("judge", key, { raw: result.json });
    return { model: args.spec.model, scores: validateJudgement(result.json, args.pageText), cached: false };
  } catch (error) {
    // Budget and config problems stop the run; one judge failing does not.
    if (error instanceof BudgetExceededError || error instanceof EvalConfigError) throw error;
    if (error instanceof EvalCallError) {
      return { model: args.spec.model, scores: {}, cached: false, error: error.message };
    }
    throw error;
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const shortModel = (model: string) => model.split("/").pop() ?? model;

export function aggregate(judgements: Judgement[]): Record<Dimension, DimensionResult> {
  const out = {} as Record<Dimension, DimensionResult>;
  for (const d of DIMENSIONS) {
    const valid = judgements
      .map((j) => ({ model: j.model, s: j.scores[d] }))
      .filter((x): x is { model: string; s: DimensionScore } => x.s?.valid === true);
    const scores = valid.map((v) => ({ model: v.model, score: v.s.score }));
    const values = scores.map((s) => s.score);
    const low = valid.slice().sort((a, b) => a.s.score - b.s.score)[0];
    out[d] = {
      median: median(values),
      spread: values.length > 0 ? Math.max(...values) - Math.min(...values) : 0,
      scores,
      ...(low ? { lowest: { model: low.model, score: low.s.score, quote: low.s.quote, reason: low.s.reason } } : {}),
    };
  }
  return out;
}

export function judgeFindings(
  results: Record<Dimension, DimensionResult>,
  thresholds: JudgeThresholds,
): { fails: Finding[]; warns: Finding[] } {
  const fails: Finding[] = [];
  const warns: Finding[] = [];
  for (const d of DIMENSIONS) {
    const r = results[d];
    if (r.scores.length < thresholds.minValidJudges || r.median === null) {
      warns.push({ check: "judges.incomplete", message: `${d}: only ${r.scores.length} valid judge score(s)` });
      continue;
    }
    const who = r.scores.map((s) => `${shortModel(s.model)} ${s.score}`).join(", ");
    const evidence = r.lowest?.quote ? `: "${r.lowest.quote.slice(0, 140)}"` : "";
    const why = r.lowest?.reason ? ` (${r.lowest.reason})` : "";
    const message = `${d} ${r.median}/5 (${who})${evidence}${why}`;
    if (r.median <= thresholds.failAtOrBelow) fails.push({ check: `judges.${d}`, message });
    else if (r.median <= thresholds.warnAtOrBelow) warns.push({ check: `judges.${d}`, message });
    if (r.spread >= thresholds.disagreeSpread) {
      warns.push({ check: "judges.disagree", message: `${d}: judges differ by ${r.spread} points (${who}); review by hand` });
    }
  }
  return { fails, warns };
}

export type JudgeLayerResult = {
  fails: Finding[];
  warns: Finding[];
  judgements: Judgement[];
  dimensions: Record<Dimension, DimensionResult>;
  metrics: { medians: Partial<Record<Dimension, number | null>>; costUsd: number; judgesFailed: number; cached: number };
};

export async function runJudgeLayer(args: {
  slug: string;
  sections: Section[];
  llm: EvalLlm;
  judges: JudgeSpec[];
  thresholds: JudgeThresholds;
  excludeSections: string[];
  sourcesTitle: string;
  cache?: JsonCache;
}): Promise<JudgeLayerResult> {
  const start = args.llm.ledger().length;
  const pageText = judgeInputText(args.sections, args.excludeSections, args.sourcesTitle);
  const judgements = await Promise.all(
    args.judges.map((spec) => runJudge({ llm: args.llm, spec, slug: args.slug, pageText, cache: args.cache })),
  );
  const dimensions = aggregate(judgements);
  const { fails, warns } = judgeFindings(dimensions, args.thresholds);
  for (const j of judgements.filter((x) => x.error)) {
    warns.push({ check: "judges.error", message: `${shortModel(j.model)} did not score the page: ${j.error}` });
  }
  const costUsd = args.llm
    .ledger()
    .slice(start)
    .filter((e) => e.label.split(" ")[1] === args.slug && e.label.startsWith("judge "))
    .reduce((sum, e) => sum + e.costUsd, 0);
  return {
    fails,
    warns,
    judgements,
    dimensions,
    metrics: {
      medians: Object.fromEntries(DIMENSIONS.map((d) => [d, dimensions[d].median])),
      costUsd,
      judgesFailed: judgements.filter((j) => j.error).length,
      cached: judgements.filter((j) => j.cached).length,
    },
  };
}

/** Upper bound for one page: every judge at its full output allowance. */
export function estimateJudgeWorstCaseUsd(args: {
  sections: Section[];
  judges: JudgeSpec[];
  rates: Map<string, ModelRates>;
  excludeSections: string[];
  sourcesTitle: string;
}): number {
  const pageText = judgeInputText(args.sections, args.excludeSections, args.sourcesTitle);
  const { system, user } = buildJudgeMessages(pageText);
  const inputTokens = estimateInputTokens([system, user]);
  return args.judges.reduce((sum, spec) => {
    const rates = args.rates.get(spec.model);
    if (!rates) throw new EvalConfigError(`no price for judge model ${spec.model}`);
    return sum + worstCaseUsd(rates, { inputTokens, maxOutputTokens: spec.maxOutputTokens });
  }, 0);
}
