/**
 * WP41-S5 tests: calibration scoring and report. Pure: no LLM calls.
 */

import { describe, expect, it } from "vitest";

import { renderCalibration, scoreCalibration, type CalibrationInput } from "./calibrate.ts";
import { aggregate, validateJudgement, type Judgement } from "./judges.ts";
import { DIMENSIONS } from "./rubric.ts";

const PAGE = "Freelancers chase late invoices by hand every month.";
const OPTIONS = { ignoreChecks: ["duplication"], minCatchRate: 0.9, failAtOrBelow: 2 };

function judgement(model: string, low: Partial<Record<string, number>> = {}): Judgement {
  const raw = Object.fromEntries(DIMENSIONS.map((d) => [d, { score: low[d] ?? 4, quote: PAGE, reason: "r" }]));
  return { model, scores: validateJudgement(raw, PAGE), cached: false };
}

function judged(judgements: Judgement[]) {
  const dimensions = aggregate(judgements);
  return {
    fails: [],
    warns: [],
    judgements,
    dimensions,
    metrics: { medians: {}, costUsd: 0, judgesFailed: 0, cached: 0 },
  };
}

function input(p: Partial<CalibrationInput> & Pick<CalibrationInput, "slug" | "label">): CalibrationInput {
  return { path: `${p.slug}.mdx`, fails: [], warns: [], ...p };
}

describe("scoreCalibration", () => {
  it("passes when every bad page fails as expected and no good page fails", () => {
    const r = scoreCalibration(
      [
        input({ slug: "good", label: "good", fails: ["duplication"] }),
        input({ slug: "bad", label: "bad", expect: ["judges.slop"], fails: ["judges.slop", "judges.verbosity"] }),
      ],
      OPTIONS,
    );
    expect(r).toMatchObject({ passed: true, caught: 1, bad: 1, falseFails: 0, catchRate: 1 });
    expect(r.pages[0].detail).toBe("no failures");
  });

  it("fails on a false fail, and on a catch rate under the bar", () => {
    const r = scoreCalibration(
      [
        input({ slug: "good", label: "good", fails: ["judges.fake_data"] }),
        input({ slug: "b1", label: "bad", expect: ["judges.slop"], warns: ["judges.slop"] }),
        input({ slug: "b2", label: "bad", expect: ["integrity.placeholder", "slop.banned"], fails: ["slop.banned"] }),
      ],
      OPTIONS,
    );
    expect(r.passed).toBe(false);
    expect(r.falseFails).toBe(1);
    expect(r.caught).toBe(0);
    expect(r.pages[1].detail).toBe("missed: judges.slop (warned only: judges.slop)");
    expect(r.pages[2].detail).toBe("missed: integrity.placeholder");
  });

  it("scores each judge on the seeded flaw and on good-page alarms", () => {
    const r = scoreCalibration(
      [
        input({
          slug: "bad",
          label: "bad",
          expect: ["judges.slop"],
          judgeLayer: judged([judgement("a", { slop: 1 }), judgement("b", { slop: 2 }), judgement("c")]),
        }),
        input({
          slug: "good",
          label: "good",
          judgeLayer: judged([judgement("a"), judgement("b"), judgement("c", { consistency: 2 })]),
        }),
      ],
      OPTIONS,
    );
    const byModel = Object.fromEntries(r.judges.map((j) => [j.model, j]));
    expect(byModel.a).toMatchObject({ targetHits: 1, targetTotal: 1, goodFalseAlarms: 0 });
    expect(byModel.c).toMatchObject({ targetHits: 0, goodFalseAlarms: 1 });
    expect(byModel.c.meanDistance).toBeGreaterThan(0);
  });

  it("counts discarded low scores against the judge, not as hits", () => {
    const invalid: Judgement = {
      model: "a",
      scores: validateJudgement({ slop: { score: 1, quote: "not on the page", reason: "r" } }, PAGE),
      cached: false,
    };
    const r = scoreCalibration(
      [input({ slug: "bad", label: "bad", expect: ["judges.slop"], judgeLayer: judged([invalid]) })],
      OPTIONS,
    );
    expect(r.judges[0]).toMatchObject({ targetHits: 0, discarded: 1 });
  });
});

describe("renderCalibration", () => {
  it("states the verdict, the bar, and every page", () => {
    const r = scoreCalibration([input({ slug: "bad", label: "bad", expect: ["slop.banned"], fails: ["slop.banned"] })], OPTIONS);
    const md = renderCalibration(r, { generatedOn: "2026-09-27", mode: "live", minCatchRate: 0.9, costUsd: 0.12 });
    expect(md).toContain("**PASS**: caught 1/1 seeded bad pages (100%, need 90%)");
    expect(md).toContain("| `bad` | bad | ok | caught: slop.banned |");
  });
});
