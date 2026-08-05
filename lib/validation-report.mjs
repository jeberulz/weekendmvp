export const FUNNEL_EVENTS = [
  "idea_prompt_copied",
  "starter_kit_clicked",
  "newsletter_subscribed",
  "checkout_started",
  "purchase_completed",
];

const DAY_MS = 86_400_000;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDate(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function completeDateRanges(now = new Date()) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const currentEnd = shiftUtcDate(today, -1);
  const currentStart = shiftUtcDate(currentEnd, -6);
  const baselineEnd = shiftUtcDate(currentStart, -1);
  const baselineStart = shiftUtcDate(baselineEnd, -27);

  return {
    current: { startDate: isoDate(currentStart), endDate: isoDate(currentEnd) },
    baseline: {
      startDate: isoDate(baselineStart),
      endDate: isoDate(baselineEnd),
    },
  };
}

export function normalizeGaRows(rows = []) {
  return rows.map((row) => ({
    eventName: row.dimensionValues?.[0]?.value ?? "",
    pagePath: row.dimensionValues?.[1]?.value ?? "",
    eventCount: Number(row.metricValues?.[0]?.value ?? 0),
  }));
}

function emptyMetrics() {
  return { views: 0, events: new Map() };
}

function aggregate(rows) {
  const pages = new Map();
  const totals = new Map();

  for (const row of rows) {
    if (!row.pagePath || !Number.isFinite(row.eventCount)) continue;
    const metrics = pages.get(row.pagePath) ?? emptyMetrics();

    if (row.eventName === "page_view") {
      metrics.views += row.eventCount;
    } else {
      metrics.events.set(
        row.eventName,
        (metrics.events.get(row.eventName) ?? 0) + row.eventCount,
      );
      totals.set(
        row.eventName,
        (totals.get(row.eventName) ?? 0) + row.eventCount,
      );
    }
    pages.set(row.pagePath, metrics);
  }

  return { pages, totals };
}

function relativeChange(current, baseline) {
  if (baseline === 0) return current === 0 ? 0 : null;
  return (current - baseline) / baseline;
}

function formatPercent(value, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedPercent(value) {
  if (value === null) return "new";
  const percentage = value * 100;
  return `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`;
}

function formatSignedPoints(value) {
  const points = value * 100;
  return `${points >= 0 ? "+" : ""}${points.toFixed(1)}pp`;
}

function tableCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function html(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildValidationReport({
  currentRows,
  baselineRows,
  ideas,
  ranges,
  generatedAt = new Date(),
  minimumCurrentViews = 25,
  minimumBaselineViews = 100,
  volumeThreshold = 0.25,
  conversionPointThreshold = 0.02,
}) {
  const current = aggregate(currentRows);
  const baseline = aggregate(baselineRows);
  const signals = [];
  let eligibleIdeas = 0;

  for (const idea of ideas) {
    const path = `/ideas/${idea.slug}`;
    const currentMetrics = current.pages.get(path) ?? emptyMetrics();
    const baselineMetrics = baseline.pages.get(path) ?? emptyMetrics();
    const primaryAction =
      idea.validation?.primaryAction ?? "idea_prompt_copied";
    const currentActions = currentMetrics.events.get(primaryAction) ?? 0;
    const baselineActions = baselineMetrics.events.get(primaryAction) ?? 0;

    if (
      currentMetrics.views < minimumCurrentViews ||
      baselineMetrics.views < minimumBaselineViews
    ) {
      continue;
    }
    eligibleIdeas += 1;

    const baselineWeeklyViews = baselineMetrics.views / 4;
    const volumeChange = relativeChange(
      currentMetrics.views,
      baselineWeeklyViews,
    );
    const currentRate = currentActions / currentMetrics.views;
    const baselineRate = baselineActions / baselineMetrics.views;
    const conversionPointChange = currentRate - baselineRate;
    const reasons = [];

    if (volumeChange !== null && Math.abs(volumeChange) >= volumeThreshold) {
      reasons.push(`views ${formatSignedPercent(volumeChange)}`);
    }
    if (Math.abs(conversionPointChange) >= conversionPointThreshold) {
      reasons.push(`conversion ${formatSignedPoints(conversionPointChange)}`);
    }
    if (reasons.length === 0) continue;

    signals.push({
      slug: idea.slug,
      title: idea.title,
      audience: idea.validation?.audience ?? null,
      hypothesis: idea.validation?.hypothesis ?? null,
      primaryAction,
      currentViews: currentMetrics.views,
      baselineWeeklyViews,
      volumeChange,
      currentActions,
      currentRate,
      baselineRate,
      conversionPointChange,
      reasons,
      severity: Math.max(
        Math.abs(volumeChange ?? 0) / volumeThreshold,
        Math.abs(conversionPointChange) / conversionPointThreshold,
      ),
    });
  }

  signals.sort((a, b) => b.severity - a.severity);

  const funnel = FUNNEL_EVENTS.map((eventName) => {
    const currentCount = current.totals.get(eventName) ?? 0;
    const baselineWeeklyCount = (baseline.totals.get(eventName) ?? 0) / 4;
    return {
      eventName,
      currentCount,
      baselineWeeklyCount,
      change: relativeChange(currentCount, baselineWeeklyCount),
    };
  });

  return {
    generatedAt: generatedAt.toISOString(),
    ranges,
    minimumCurrentViews,
    minimumBaselineViews,
    eligibleIdeas,
    totalIdeas: ideas.length,
    signals,
    funnel,
  };
}

export function renderValidationMarkdown(report) {
  const lines = [
    `# Weekly Validation Digest — ${report.ranges.current.endDate}`,
    "",
    `Current: ${report.ranges.current.startDate} → ${report.ranges.current.endDate} (7 complete UTC days)`,
    `Baseline: ${report.ranges.baseline.startDate} → ${report.ranges.baseline.endDate} (28 complete UTC days, normalized to 7 days for volume)`,
    "",
    "## Signals",
    "",
  ];

  if (report.signals.length === 0) {
    lines.push(
      `No idea crossed the configured thresholds. ${report.eligibleIdeas} of ${report.totalIdeas} ideas had at least ${report.minimumCurrentViews} current and ${report.minimumBaselineViews} baseline views.`,
    );
  } else {
    lines.push(
      "| Idea | Views: current / baseline week | Primary action | Conversion: current / baseline | Signal |",
      "| --- | ---: | --- | ---: | --- |",
    );
    for (const signal of report.signals) {
      lines.push(
        `| [${tableCell(signal.title)}](https://www.weekendmvp.app/ideas/${signal.slug}) | ${signal.currentViews} / ${signal.baselineWeeklyViews.toFixed(1)} | ${signal.primaryAction} | ${formatPercent(signal.currentRate)} / ${formatPercent(signal.baselineRate)} | ${signal.reasons.join("; ")} |`,
      );
      if (signal.hypothesis) {
        lines.push(
          `| ↳ Hypothesis |  |  |  | ${tableCell(signal.hypothesis)} |`,
        );
      }
    }
  }

  lines.push(
    "",
    "## Funnel",
    "",
    "| Event | Current 7 days | Baseline weekly average | Change |",
    "| --- | ---: | ---: | ---: |",
  );
  for (const event of report.funnel) {
    lines.push(
      `| ${event.eventName} | ${event.currentCount} | ${event.baselineWeeklyCount.toFixed(1)} | ${formatSignedPercent(event.change)} |`,
    );
  }

  lines.push(
    "",
    "## Method",
    "",
    `Page-level signals require ≥${report.minimumCurrentViews} current views and ≥${report.minimumBaselineViews} baseline views. A signal is emitted for ≥25% weekly-normalized view movement or ≥2.0 percentage points of primary-action conversion movement.`,
    "",
    `_Generated ${report.generatedAt}_`,
    "",
  );

  return lines.join("\n");
}

export function renderValidationHtml(report) {
  const signalRows =
    report.signals.length === 0
      ? `<p>No idea crossed the configured thresholds. ${report.eligibleIdeas} of ${report.totalIdeas} ideas had enough traffic for comparison.</p>`
      : `<table style="border-collapse:collapse;width:100%">
          <thead><tr><th align="left">Idea</th><th align="right">Views</th><th align="right">Conversion</th><th align="left">Signal</th></tr></thead>
          <tbody>${report.signals
            .map(
              (signal) => `<tr>
                <td style="padding:8px 0"><a href="https://www.weekendmvp.app/ideas/${encodeURIComponent(signal.slug)}">${html(signal.title)}</a></td>
                <td align="right">${signal.currentViews} / ${signal.baselineWeeklyViews.toFixed(1)}</td>
                <td align="right">${formatPercent(signal.currentRate)} / ${formatPercent(signal.baselineRate)}</td>
                <td style="padding-left:12px">${html(signal.reasons.join("; "))}</td>
              </tr>`,
            )
            .join("")}</tbody>
        </table>`;

  const funnelRows = report.funnel
    .map(
      (event) => `<tr>
        <td style="padding:6px 0">${html(event.eventName)}</td>
        <td align="right">${event.currentCount}</td>
        <td align="right">${event.baselineWeeklyCount.toFixed(1)}</td>
        <td align="right">${html(formatSignedPercent(event.change))}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#171717;line-height:1.5;max-width:760px;margin:0 auto;padding:24px">
  <h1>Weekly Validation Digest — ${html(report.ranges.current.endDate)}</h1>
  <p><strong>Current:</strong> ${html(report.ranges.current.startDate)} → ${html(report.ranges.current.endDate)}<br>
  <strong>Baseline:</strong> ${html(report.ranges.baseline.startDate)} → ${html(report.ranges.baseline.endDate)}</p>
  <h2>Signals</h2>
  ${signalRows}
  <h2>Funnel</h2>
  <table style="border-collapse:collapse;width:100%">
    <thead><tr><th align="left">Event</th><th align="right">Current</th><th align="right">Baseline/week</th><th align="right">Change</th></tr></thead>
    <tbody>${funnelRows}</tbody>
  </table>
  <p style="margin-top:28px;color:#666;font-size:13px">Signals require ≥${report.minimumCurrentViews} current views and ≥${report.minimumBaselineViews} baseline views. Thresholds: 25% volume or 2.0pp conversion movement.</p>
</body></html>`;
}
