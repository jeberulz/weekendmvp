/**
 * Ranked backlog report for a full-corpus Layer 0 run.
 */

const rank = (a, b) =>
  b.fails.length - a.fails.length ||
  b.warns.length - a.warns.length ||
  a.slug.localeCompare(b.slug);

function tallyChecks(results) {
  const tally = new Map();
  for (const r of results) {
    for (const [kind, list] of [["fail", r.fails], ["warn", r.warns]]) {
      for (const check of new Set(list.map((f) => f.check))) {
        const row = tally.get(check) ?? { check, fail: 0, warn: 0 };
        row[kind] += 1;
        tally.set(check, row);
      }
    }
  }
  return [...tally.values()].sort(
    (a, b) => b.fail - a.fail || b.warn - a.warn || a.check.localeCompare(b.check),
  );
}

const cell = (text) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ");

function pageRows(results, key) {
  return results
    .map((r) => {
      const checks = [...new Set(r[key].map((f) => f.check))].join(", ");
      const first = r[key][0]?.message ?? "";
      return `| \`${r.slug}\` | ${r.fails.length} | ${r.warns.length} | ${cell(checks)} | ${cell(first.slice(0, 160))} |`;
    })
    .join("\n");
}

/** Corpus median per judge dimension, from pages that ran Layer 3. */
function judgeTable(results) {
  const judged = results.filter((r) => r.judgeLayer?.metrics?.medians);
  if (judged.length === 0) return [];
  const dims = Object.keys(judged[0].judgeLayer.metrics.medians);
  const rows = dims.map((d) => {
    const values = judged
      .map((r) => r.judgeLayer.metrics.medians[d])
      .filter((v) => typeof v === "number")
      .sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median =
      values.length === 0 ? "-" : values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    const low = values.filter((v) => v <= 2).length;
    return `| \`${d}\` | ${median} | ${low} |`;
  });
  return [
    `## Judge scores (${judged.length} page(s))`,
    "",
    "Median of each page's judge median, 1-5. Rubric: `evals/rubric.md`.",
    "",
    "| Dimension | Corpus median | Pages at 2 or below |",
    "|---|---|---|",
    ...rows,
    "",
  ];
}

/** Corpus totals for claim checks, from pages that ran Layers 1-2. */
function claimsTable(results) {
  const pages = results.filter((r) => r.claimLayer?.metrics);
  if (pages.length === 0) return [];
  const sum = (k) => pages.reduce((n, r) => n + (r.claimLayer.metrics[k] ?? 0), 0);
  const withContradiction = pages.filter((r) => r.claimLayer.metrics.contradicted > 0).length;
  return [
    `## Claims (${pages.length} page(s))`,
    "",
    "Factual claims extracted from The Problem, Market Research and Competitive Landscape, checked against each page's cited sources.",
    "",
    "| Supported | Contradicted | Outdated | Not found in source | Unsourced | Unverifiable |",
    "|---|---|---|---|---|---|",
    `| ${sum("supported")} | ${sum("contradicted")} (${withContradiction} page(s)) | ${sum("outdated")} | ${sum("notFound")} | ${sum("unsourced")} | ${sum("unverifiable")} |`,
    "",
  ];
}

function runLine(run) {
  if (!run) return [];
  const parts = [];
  if (run.layers > 0) {
    parts.push(
      `${run.calls} model call(s), $${run.spentUsd.toFixed(2)} spent` +
        (run.failedCalls > 0 ? `, ${run.failedCalls} failed call(s)` : "") +
        (run.incomplete > 0 ? `, **${run.incomplete} page(s) incomplete**` : ""),
    );
  }
  if (run.links) {
    parts.push(
      `links: ${run.links.checked} checked, ${run.links.dead} dead, ${run.links.blocked} blocked by bot walls, ${run.links.errors} unknown`,
    );
  }
  return parts.length > 0 ? [`Run: ${parts.join("; ")}.`, ""] : [];
}

export function renderReport(results, { generatedOn, layers = 0, mode = null, run = null }) {
  const sorted = results.slice().sort(rank);
  const count = (s) => results.filter((r) => r.status === s).length;
  const failing = sorted.filter((r) => r.status === "fail");
  const warning = sorted.filter((r) => r.status === "warn");

  const lines = [
    "# Idea content quality report",
    "",
    `Generated ${generatedOn} by \`npm run evals:run -- --all --report\`. Do not edit by hand.`,
    "",
    layers > 0
      ? `Layers run: 0-${layers} (${mode}). Layer 1 extracts factual claims; Layer 2 checks them against each page's cited sources. Layer 3 is the judge panel.`
      : "Layers run: 0 only.",
    "",
    ...runLine(run),
    "Layer 0 is the free, deterministic layer: structure, slop phrases, verbosity, unsourced numbers, source hygiene, placeholders, and cross-page duplication. Thresholds live in `evals/config.json`.",
    "",
    "New or edited pages must reach `pass` or `warn` to merge. Pages below are existing debt, ranked worst first.",
    "",
    "## Summary",
    "",
    "| Status | Pages |",
    "|---|---|",
    `| fail | ${count("fail")} |`,
    `| warn | ${count("warn")} |`,
    `| pass | ${count("pass")} |`,
    `| total | ${results.length} |`,
    "",
    "## Findings by check",
    "",
    "| Check | Pages failing | Pages warned |",
    "|---|---|---|",
    ...tallyChecks(results).map((t) => `| \`${t.check}\` | ${t.fail} | ${t.warn} |`),
    "",
    ...claimsTable(results),
    ...judgeTable(results),
    `## Fix first: failing pages (${failing.length})`,
    "",
  ];

  if (failing.length > 0) {
    lines.push(
      "| Page | Fails | Warns | Checks | First failure |",
      "|---|---|---|---|---|",
      pageRows(failing, "fails"),
    );
  } else {
    lines.push("None.");
  }

  lines.push("", `## Review: pages with warnings (${warning.length})`, "");
  if (warning.length > 0) {
    lines.push(
      "| Page | Fails | Warns | Checks | First warning |",
      "|---|---|---|---|---|",
      pageRows(warning, "warns"),
    );
  } else {
    lines.push("None.");
  }

  lines.push(
    "",
    "Run `npm run evals:run -- --slug <slug>` for every finding on one page.",
    "",
  );
  return lines.join("\n");
}
