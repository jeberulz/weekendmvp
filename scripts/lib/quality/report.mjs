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

export function renderReport(results, { generatedOn }) {
  const sorted = results.slice().sort(rank);
  const count = (s) => results.filter((r) => r.status === s).length;
  const failing = sorted.filter((r) => r.status === "fail");
  const warning = sorted.filter((r) => r.status === "warn");

  const lines = [
    "# Idea content quality report (Layer 0)",
    "",
    `Generated ${generatedOn} by \`npm run evals:run -- --all --report\`. Do not edit by hand.`,
    "",
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
