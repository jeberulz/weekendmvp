import assert from "node:assert/strict";
import test from "node:test";

import {
  buildValidationReport,
  completeDateRanges,
  renderValidationHtml,
  renderValidationMarkdown,
} from "../../lib/validation-report.mjs";

test("completeDateRanges uses complete UTC days without overlap", () => {
  assert.deepEqual(completeDateRanges(new Date("2026-08-05T10:00:00.000Z")), {
    dataLagDays: 2,
    current: { startDate: "2026-07-28", endDate: "2026-08-03" },
    baseline: { startDate: "2026-06-30", endDate: "2026-07-27" },
  });
});

test("completeDateRanges rejects an invalid data-latency window", () => {
  assert.throws(
    () => completeDateRanges(new Date("2026-08-05T10:00:00.000Z"), 0),
    /positive integer/,
  );
});

test("buildValidationReport flags normalized volume and conversion changes", () => {
  const ranges = completeDateRanges(new Date("2026-08-05T10:00:00.000Z"));
  const report = buildValidationReport({
    ranges,
    generatedAt: new Date("2026-08-05T10:00:00.000Z"),
    ideas: [
      {
        slug: "signal-idea",
        title: "Signal | Idea",
        validation: {
          audience: "solo-founders",
          hypothesis: "Solo founders copy a prompt after reading the evidence.",
          primaryAction: "idea_prompt_copied",
        },
      },
      { slug: "thin-idea", title: "Thin Idea" },
    ],
    currentRows: [
      {
        eventName: "page_view",
        pagePath: "/ideas/signal-idea",
        eventCount: 50,
      },
      {
        eventName: "idea_prompt_copied",
        pagePath: "/ideas/signal-idea",
        eventCount: 10,
      },
      {
        eventName: "page_view",
        pagePath: "/ideas/thin-idea",
        eventCount: 5,
      },
    ],
    baselineRows: [
      {
        eventName: "page_view",
        pagePath: "/ideas/signal-idea",
        eventCount: 100,
      },
      {
        eventName: "idea_prompt_copied",
        pagePath: "/ideas/signal-idea",
        eventCount: 5,
      },
      {
        eventName: "page_view",
        pagePath: "/ideas/thin-idea",
        eventCount: 500,
      },
    ],
  });

  assert.equal(report.eligibleIdeas, 1);
  assert.equal(report.signals.length, 1);
  assert.equal(report.signals[0].slug, "signal-idea");
  assert.equal(report.signals[0].baselineWeeklyViews, 25);
  assert.equal(report.signals[0].volumeChange, 1);
  assert.equal(report.signals[0].currentRate, 0.2);
  assert.equal(report.signals[0].baselineRate, 0.05);
  assert.deepEqual(report.signals[0].reasons, [
    "views +100.0%",
    "conversion +15.0pp",
  ]);

  const markdown = renderValidationMarkdown(report);
  assert.match(markdown, /Signal \\| Idea/);
  assert.match(markdown, /Solo founders copy a prompt/);
});

test("renderValidationHtml escapes manifest-authored content", () => {
  const ranges = completeDateRanges(new Date("2026-08-05T10:00:00.000Z"));
  const report = buildValidationReport({
    ranges,
    ideas: [{ slug: "safe", title: "<script>alert(1)</script>" }],
    currentRows: [
      { eventName: "page_view", pagePath: "/ideas/safe", eventCount: 50 },
    ],
    baselineRows: [
      { eventName: "page_view", pagePath: "/ideas/safe", eventCount: 100 },
    ],
  });

  const rendered = renderValidationHtml(report);
  assert.doesNotMatch(rendered, /<script>/);
  assert.match(rendered, /&lt;script&gt;/);
});
