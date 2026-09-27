/**
 * WP41-S5. Calibration: score the engine against a labelled gold set.
 *
 * Good pages are published pages we stand behind; bad pages are seeded
 * copies that each break one thing (evals/gold/manifest.json). The engine
 * passes calibration when it catches at least `minCatchRate` of bad pages
 * with the expected checks and fails no good page.
 *
 * Per-judge numbers show whether one panel member is dragging the median:
 * how often it caught the target flaw, how often it scored a good page at
 * the fail threshold, and how far it sits from the panel median.
 */

import type { JudgeLayerResult } from "./judges.ts";
import type { Dimension } from "./rubric.ts";

export type GoldPage = {
  slug: string;
  path: string;
  label: "good" | "bad";
  flaw?: string;
  expect?: string[];
};

export type CalibrationInput = GoldPage & {
  fails: string[];
  warns: string[];
  judgeLayer?: JudgeLayerResult;
};

export type PageOutcome = {
  slug: string;
  label: "good" | "bad";
  ok: boolean;
  detail: string;
};

export type JudgeStats = {
  model: string;
  targetHits: number;
  targetTotal: number;
  goodFalseAlarms: number;
  discarded: number;
  meanDistance: number | null;
};

export type CalibrationResult = {
  pages: PageOutcome[];
  catchRate: number;
  caught: number;
  bad: number;
  falseFails: number;
  good: number;
  judges: JudgeStats[];
  passed: boolean;
};

const targetDimension = (expect: string[] = []): Dimension | null => {
  const judged = expect.find((c) => c.startsWith("judges."));
  return judged ? (judged.slice("judges.".length) as Dimension) : null;
};

export function scoreCalibration(
  inputs: CalibrationInput[],
  options: { ignoreChecks: string[]; minCatchRate: number; failAtOrBelow: number },
): CalibrationResult {
  const counted = (checks: string[]) => checks.filter((c) => !options.ignoreChecks.includes(c));
  const pages: PageOutcome[] = inputs.map((p) => {
    const fails = counted(p.fails);
    if (p.label === "good") {
      return {
        slug: p.slug,
        label: "good",
        ok: fails.length === 0,
        detail: fails.length === 0 ? "no failures" : `false fail: ${[...new Set(fails)].join(", ")}`,
      };
    }
    const expect = p.expect ?? [];
    const missing = expect.filter((c) => !fails.includes(c));
    const warnedOnly = missing.filter((c) => p.warns.includes(c));
    return {
      slug: p.slug,
      label: "bad",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `caught: ${expect.join(", ")}`
          : `missed: ${missing.join(", ")}${warnedOnly.length > 0 ? ` (warned only: ${warnedOnly.join(", ")})` : ""}`,
    };
  });

  const bad = pages.filter((p) => p.label === "bad");
  const good = pages.filter((p) => p.label === "good");
  const caught = bad.filter((p) => p.ok).length;
  const falseFails = good.filter((p) => !p.ok).length;
  const catchRate = bad.length > 0 ? caught / bad.length : 1;

  const stats = new Map<string, { hits: number; total: number; alarms: number; discarded: number; distances: number[] }>();
  const stat = (model: string) => {
    if (!stats.has(model)) stats.set(model, { hits: 0, total: 0, alarms: 0, discarded: 0, distances: [] });
    return stats.get(model)!;
  };
  for (const p of inputs) {
    if (!p.judgeLayer) continue;
    const target = p.label === "bad" ? targetDimension(p.expect) : null;
    for (const j of p.judgeLayer.judgements) {
      const s = stat(j.model);
      for (const [dim, score] of Object.entries(j.scores)) {
        if (!score) continue;
        if (!score.valid) {
          s.discarded += 1;
          continue;
        }
        const median = p.judgeLayer.dimensions[dim as Dimension]?.median;
        if (typeof median === "number") s.distances.push(Math.abs(score.score - median));
        if (p.label === "good" && score.score <= options.failAtOrBelow) s.alarms += 1;
      }
      if (target) {
        s.total += 1;
        const score = j.scores[target];
        if (score?.valid && score.score <= options.failAtOrBelow) s.hits += 1;
      }
    }
  }
  const judges: JudgeStats[] = [...stats.entries()].map(([model, s]) => ({
    model,
    targetHits: s.hits,
    targetTotal: s.total,
    goodFalseAlarms: s.alarms,
    discarded: s.discarded,
    meanDistance:
      s.distances.length > 0
        ? Math.round((s.distances.reduce((a, b) => a + b, 0) / s.distances.length) * 100) / 100
        : null,
  }));

  return {
    pages,
    catchRate: Math.round(catchRate * 100) / 100,
    caught,
    bad: bad.length,
    falseFails,
    good: good.length,
    judges,
    passed: catchRate >= options.minCatchRate && falseFails === 0,
  };
}

export function renderCalibration(
  result: CalibrationResult,
  meta: { generatedOn: string; mode: string; minCatchRate: number; costUsd: number },
): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return [
    "# Engine calibration (WP41 gold set)",
    "",
    `Generated ${meta.generatedOn} by \`npm run evals:calibrate -- --${meta.mode} --report\` (${meta.mode} mode, $${meta.costUsd.toFixed(4)}). Do not edit by hand.`,
    "",
    `**${result.passed ? "PASS" : "FAIL"}**: caught ${result.caught}/${result.bad} seeded bad pages (${pct(result.catchRate)}, need ${pct(meta.minCatchRate)}), false fails on ${result.falseFails}/${result.good} good pages (need 0).`,
    "",
    "Gold set: `evals/gold/manifest.json`. Layers: 0 and 3 (judges). Claim checks are left out: they depend on live sources, not on the rubric.",
    "",
    "## Pages",
    "",
    "| Page | Label | Result | Detail |",
    "|---|---|---|---|",
    ...result.pages.map((p) => `| \`${p.slug}\` | ${p.label} | ${p.ok ? "ok" : "**wrong**"} | ${p.detail} |`),
    "",
    "## Judges",
    "",
    "Target hits: the judge scored the seeded flaw at the fail threshold. Good-page alarms: dimensions on good pages it scored at the fail threshold. Distance: mean gap from the panel median.",
    "",
    "| Judge | Target hits | Good-page alarms | Discarded scores | Distance from median |",
    "|---|---|---|---|---|",
    ...result.judges.map(
      (j) =>
        `| \`${j.model}\` | ${j.targetHits}/${j.targetTotal} | ${j.goodFalseAlarms} | ${j.discarded} | ${j.meanDistance ?? "-"} |`,
    ),
    "",
  ].join("\n");
}
