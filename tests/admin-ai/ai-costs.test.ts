import { describe, expect, test } from "vitest";

import { anthropicCostMicroUsd } from "@/convex/ai/pricing";
import {
  LAUNCH_TARGET_MICRO_USD,
  byModelTier,
  byPrompt,
  categoryOf,
  efficiency,
  founderRows,
  launchStats,
  overview,
  percentile,
  rowsInDays,
  unitEconomics,
} from "@/lib/admin/ai-costs/aggregate";
import { csvCell, csvUsd, toCsv } from "@/lib/admin/ai-costs/csv";
import { breakdownCsv, foundersCsv } from "@/lib/admin/ai-costs/exports";
import { BUILDERS_HUB_MONTHLY_MICRO_USD, forecast } from "@/lib/admin/ai-costs/forecast";
import { fixtureData } from "@/lib/admin/ai-costs/fixtures";
import { addMicroUsd, chargedMicroUsd, formatUsd, sumMicroUsd } from "@/lib/admin/ai-costs/money";
import { parseRange, resolveRange } from "@/lib/admin/ai-costs/ranges";
import type { AiCostSourceReads } from "@/lib/admin/ai-costs/source";
import type { ProjectCost, UsageRow } from "@/lib/admin/ai-costs/types";
import { buildRangeView } from "@/lib/admin/ai-costs/view";
import { repriceRow, standardPrice, whatIf } from "@/lib/admin/ai-costs/whatif";

const NOW = Date.parse("2026-11-20T15:30:00.000Z");
const TODAY = "2026-11-20";

let counter = 0;
function row(overrides: Partial<UsageRow> = {}): UsageRow {
  counter += 1;
  return {
    id: `row-${counter}`,
    ownerId: "owner-a",
    projectId: null,
    promptRef: "wren-chat@1",
    provider: "anthropic",
    model: "claude-haiku-5-5",
    tier: "fast",
    plan: "free",
    globalPool: "free",
    creditFunded: false,
    ownerBudgetBypass: false,
    batch: false,
    escalation: false,
    reask: false,
    status: "settled",
    reservedMicroUsd: 10_000,
    costMicroUsd: 1_000,
    lateCostMicroUsd: null,
    inputTokens: 1_000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 100,
    images: null,
    estimated: false,
    latencyMs: 100,
    stopReason: "end_turn",
    billed: "actual",
    errorClass: null,
    swept: false,
    createdAt: NOW - 1_000,
    dayKey: TODAY,
    ...overrides,
  };
}

describe("money", () => {
  test("charges follow the meter: nothing while reserved, the larger of cost and late cost after", () => {
    expect(chargedMicroUsd({ status: "reserved", costMicroUsd: 500, lateCostMicroUsd: null })).toBe(0);
    expect(chargedMicroUsd({ status: "settled", costMicroUsd: 500, lateCostMicroUsd: null })).toBe(500);
    expect(chargedMicroUsd({ status: "failed", costMicroUsd: 500, lateCostMicroUsd: 900 })).toBe(900);
    expect(chargedMicroUsd({ status: "failed", costMicroUsd: 500, lateCostMicroUsd: 100 })).toBe(500);
  });

  test("sums stay exact integers and refuse to overflow", () => {
    expect(sumMicroUsd([1, 2, 3], (value) => value)).toBe(6);
    expect(() => addMicroUsd(Number.MAX_SAFE_INTEGER, 1)).toThrow();
  });

  test("formats small amounts with enough digits to see them", () => {
    expect(formatUsd(1_234_567)).toBe("$1.23");
    expect(formatUsd(1_234)).toMatch(/^\$0\.001/);
    expect(formatUsd(null)).toBe("—");
  });
});

describe("ranges", () => {
  test("whole UTC days, today last", () => {
    const week = resolveRange("7d", NOW);
    expect(week.dayKeys).toHaveLength(7);
    expect(week.dayKeys.at(-1)).toBe(TODAY);
    expect(week.dayKeys[0]).toBe("2026-11-14");
    expect(week.startMs).toBe(Date.parse("2026-11-14T00:00:00.000Z"));
    expect(week.endMs).toBe(Date.parse("2026-11-21T00:00:00.000Z"));
    expect(resolveRange("today", NOW).dayKeys).toEqual([TODAY]);
  });

  test("unknown range values fall back to 7 days", () => {
    expect(parseRange("30d")).toBe("30d");
    expect(parseRange(["today", "7d"])).toBe("today");
    expect(parseRange("1y")).toBe("7d");
    expect(parseRange(undefined)).toBe("7d");
  });

  test("rows outside the range's UTC days are dropped", () => {
    const rows = [row({ dayKey: TODAY }), row({ dayKey: "2026-11-01" })];
    expect(rowsInDays(rows, resolveRange("7d", NOW).dayKeys)).toHaveLength(1);
  });
});

describe("aggregation", () => {
  test("overview splits pools and shows reserved money apart from settled", () => {
    const rows = [
      row({ costMicroUsd: 100 }),
      row({ globalPool: "paid", plan: "builders_hub", costMicroUsd: 250 }),
      row({ status: "reserved", reservedMicroUsd: 7_000, costMicroUsd: 0 }),
      row({ status: "failed", costMicroUsd: 40, errorClass: "timeout", billed: "possible" }),
      row({ dayKey: "2026-11-19", costMicroUsd: 5 }),
    ];
    const result = overview(rows, ["2026-11-19", TODAY]);
    expect(result.pools.free).toEqual({ chargedMicroUsd: 145, inFlightMicroUsd: 7_000, calls: 4 });
    expect(result.pools.paid).toEqual({ chargedMicroUsd: 250, inFlightMicroUsd: 0, calls: 1 });
    expect(result.byDay).toEqual([
      { dayKey: "2026-11-19", free: 5, paid: 0, uncappedOwner: 0 },
      { dayKey: TODAY, free: 140, paid: 250, uncappedOwner: 0 },
    ]);
    expect(result.totals.failed).toBe(1);
    expect(result.totals.failedMicroUsd).toBe(40);
  });

  test("the owner's uncapped calls stay out of the pools but in the totals", () => {
    const rows = [
      row({ costMicroUsd: 100 }),
      row({ ownerBudgetBypass: true, globalPool: "paid", plan: "builders_hub", costMicroUsd: 9_000 }),
      row({ ownerBudgetBypass: true, globalPool: "paid", status: "reserved", reservedMicroUsd: 4_000, costMicroUsd: 0 }),
    ];
    const result = overview(rows, [TODAY]);
    expect(result.pools.paid).toEqual({ chargedMicroUsd: 0, inFlightMicroUsd: 0, calls: 0 });
    expect(result.uncappedOwner).toEqual({ chargedMicroUsd: 9_000, inFlightMicroUsd: 4_000, calls: 2 });
    expect(result.byDay).toEqual([{ dayKey: TODAY, free: 100, paid: 0, uncappedOwner: 9_000 }]);
    expect(result.totals.chargedMicroUsd).toBe(9_100);
  });

  test("nearest-rank percentiles", () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
  });

  test("launch stats count only launches that started in the range", () => {
    const start = Date.parse("2026-11-14T00:00:00.000Z");
    const end = Date.parse("2026-11-21T00:00:00.000Z");
    const project = (id: string, cost: number, firstCallAt: number, hasLaunch = true): ProjectCost => ({
      projectId: id, ownerId: "owner-a", hasLaunch, firstCallAt, lastCallAt: firstCallAt, calls: 5, failedCalls: 0,
      launchMicroUsd: cost, wrenMicroUsd: 0, truncated: false,
    });
    const stats = launchStats([
      project("p1", 500_000, start + 1),
      project("p2", 900_000, start + 2),
      project("p3", 600_000, start - 1),
      project("p4", 100_000, start + 3, false),
    ], start, end);
    expect(stats.count).toBe(2);
    expect(stats.medianMicroUsd).toBe(500_000);
    expect(stats.overTarget).toBe(1);
    expect(stats.targetMicroUsd).toBe(LAUNCH_TARGET_MICRO_USD);
  });

  test("unit economics: Wren messages, seeds and founder-days", () => {
    const rows = [
      row({ ownerId: "a", costMicroUsd: 300 }),
      row({ ownerId: "a", costMicroUsd: 100, promptRef: "wren-plan-turn@1" }),
      row({ ownerId: "a", status: "failed", costMicroUsd: 0, errorClass: "refusal" }),
      row({ ownerId: "b", costMicroUsd: 200, dayKey: "2026-11-19" }),
      row({ ownerId: null, promptRef: "crew-idea-seed@3", costMicroUsd: 9_000, batch: true }),
    ];
    const unit = unitEconomics(rows, [], 0, NOW);
    expect(unit.wren).toEqual({ messages: 3, chargedMicroUsd: 600, perMessageMicroUsd: 200 });
    expect(unit.seeds).toEqual({ seeds: 1, chargedMicroUsd: 9_000, perSeedMicroUsd: 9_000 });
    expect(unit.founders).toEqual({ activeFounders: 2, founderDays: 2, chargedMicroUsd: 600, perFounderDayMicroUsd: 300 });
    expect(unit.platformMicroUsd).toBe(9_000);
    expect(categoryOf("crew-brand-kit@2")).toBe("crew");
    expect(categoryOf("eval-judge@1")).toBe("other");
  });

  test("breakdowns: shares add up and failure rate ignores in-flight calls", () => {
    const rows = [
      row({ promptRef: "a@1", costMicroUsd: 300 }),
      row({ promptRef: "a@1", status: "failed", costMicroUsd: 100, errorClass: "timeout" }),
      row({ promptRef: "a@1", status: "reserved", costMicroUsd: 0 }),
      row({ promptRef: "b@1", costMicroUsd: 600, model: "claude-sonnet-5-5", tier: "draft" }),
    ];
    const prompts = byPrompt(rows);
    expect(prompts.map((entry) => entry.key)).toEqual(["b@1", "a@1"]);
    expect(prompts.reduce((sum, entry) => sum + (entry.share ?? 0), 0)).toBeCloseTo(1);
    const a = prompts.find((entry) => entry.key === "a@1");
    expect(a?.failureRate).toBe(0.5);
    expect(a?.reserved).toBe(1);
    expect(byModelTier(rows).map((entry) => entry.label)).toEqual(["draft · claude-sonnet-5-5", "fast · claude-haiku-5-5"]);
  });

  test("founder rows put platform work in its own row and biggest spenders first", () => {
    const rows = [
      row({ ownerId: "small", costMicroUsd: 10 }),
      row({ ownerId: "big", costMicroUsd: 900 }),
      row({ ownerId: null, costMicroUsd: 50, promptRef: "crew-idea-seed@3" }),
    ];
    const founders = founderRows(rows, []);
    expect(founders.map((entry) => entry.ownerId)).toEqual(["big", null, "small"]);
    expect(founders.find((entry) => entry.ownerId === null)?.plan).toBe("platform");
  });

  test("efficiency: batch savings, re-asks, max_tokens and the reservation gap", () => {
    const batchRow = row({
      model: "claude-opus-5-5", batch: true, promptRef: "crew-idea-seed@3", ownerId: null,
      inputTokens: 10_000, outputTokens: 2_000,
      costMicroUsd: anthropicCostMicroUsd("claude-opus-5-5", { inputTokens: 10_000, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 2_000 }, { batch: true }),
    });
    const rows = [
      batchRow,
      row({ reask: true, costMicroUsd: 70 }),
      row({ stopReason: "max_tokens", costMicroUsd: 30 }),
      row({ status: "failed", errorClass: "schema_invalid", costMicroUsd: 20, billed: "actual" }),
      row({ status: "reserved", costMicroUsd: 0, reservedMicroUsd: 5_000 }),
    ];
    const result = efficiency(rows, 1, standardPrice);
    expect(result.batch.calls).toBe(1);
    expect(result.batch.savedMicroUsd).toBe((standardPrice(batchRow) ?? 0) - batchRow.costMicroUsd);
    expect(result.batch.savedMicroUsd).toBeGreaterThan(0);
    expect(result.reasks).toEqual({ calls: 1, chargedMicroUsd: 70 });
    expect(result.maxTokens).toEqual({ calls: 1, chargedMicroUsd: 30 });
    expect(result.schemaInvalid).toEqual({ calls: 1, chargedMicroUsd: 20 });
    expect(result.reservation.inFlightMicroUsd).toBe(5_000);
    expect(result.refusalOrSchemaAlarm).toBe(true);
  });
});

describe("what-if model swap", () => {
  test("re-prices the same tokens at another model's published rates", () => {
    const usage = { inputTokens: 4_000, cacheReadTokens: 1_000, cacheWriteTokens: 500, outputTokens: 800 };
    const chat = row({ ...usage, costMicroUsd: anthropicCostMicroUsd("claude-haiku-5-5", usage) });
    expect(repriceRow(chat, "claude-sonnet-5-5")).toBe(anthropicCostMicroUsd("claude-sonnet-5-5", usage));
    const [entry] = whatIf([chat, row({ status: "failed", errorClass: "timeout" }), row({ provider: "recraft", model: "recraftv3" })]);
    expect(entry.calls).toBe(1);
    expect(entry.baselineMicroUsd).toBe(chat.costMicroUsd);
    expect(entry.byModel["claude-sonnet-5-5"]).toBeGreaterThan(entry.byModel["claude-haiku-5-5"]);
  });
});

describe("forecast", () => {
  test("monthly cost from unit costs, next to Builder's Hub revenue", () => {
    const result = forecast(
      { launchMicroUsd: 600_000, wrenMessageMicroUsd: 2_000, platformPerDayMicroUsd: 100_000 },
      { foundersPerDay: 10, launchesPerFounder: 1, messagesPerFounder: 50, paidShare: 0.1 },
    );
    expect(result.foundersPerMonth).toBe(300);
    expect(result.launchMicroUsd).toBe(180_000_000);
    expect(result.wrenMicroUsd).toBe(30_000_000);
    expect(result.platformMicroUsd).toBe(3_000_000);
    expect(result.monthlyCostMicroUsd).toBe(213_000_000);
    expect(result.monthlyRevenueMicroUsd).toBe(30 * BUILDERS_HUB_MONTHLY_MICRO_USD);
    expect(result.missing).toEqual([]);
  });

  test("missing unit costs are flagged, bad inputs are clamped", () => {
    const result = forecast(
      { launchMicroUsd: null, wrenMessageMicroUsd: null, platformPerDayMicroUsd: 0 },
      { foundersPerDay: -5, launchesPerFounder: 1, messagesPerFounder: 1, paidShare: 4 },
    );
    expect(result.monthlyCostMicroUsd).toBe(0);
    expect(result.costShareOfRevenue).toBeNull();
    expect(result.missing).toEqual(["launch", "wren"]);
  });
});

describe("CSV export", () => {
  test("quotes, escapes and defuses spreadsheet formulas", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("a,b\r\n1,x\r\n");
  });

  test("dollar amounts keep every micro-dollar", () => {
    expect(csvUsd(1_234_567)).toBe("1.234567");
    expect(csvUsd(7)).toBe("0.000007");
    expect(csvUsd(null)).toBe("");
  });

  test("founder and prompt tables export one line per row plus a header", () => {
    const rows = [row({ ownerId: "a" }), row({ ownerId: "b", promptRef: "crew-brand-kit@2" })];
    expect(foundersCsv(founderRows(rows, [])).trim().split("\r\n")).toHaveLength(3);
    expect(breakdownCsv(byPrompt(rows), "prompt_ref").split("\r\n")[0]).toMatch(/^prompt_ref,/);
  });
});

describe("view model on fixtures", () => {
  test("fixture totals match the per-row charges and nothing real leaks in", async () => {
    const data = fixtureData(NOW);
    const source: AiCostSourceReads = {
      mode: "fixture",
      nowMs: NOW,
      async readRange(id) {
        const range = resolveRange(id, NOW);
        return { range, rows: rowsInDays(data.rows, range.dayKeys), truncated: false, readUntilMs: null, rowCap: 20_000 };
      },
      async ownerSummaries(ids) {
        return { summaries: data.summaries.filter((summary) => ids.includes(summary.ownerId)), truncated: false };
      },
      async launchCosts(ids) {
        return { projects: data.projects.filter((project) => ids.includes(project.projectId)), truncated: false };
      },
      async controlRoom() {
        return data.controlRoom;
      },
    };
    const view = await buildRangeView(source, "30d");
    const rows = rowsInDays(data.rows, view.range.dayKeys);
    const total = sumMicroUsd(rows, chargedMicroUsd);
    expect(view.overview.totals.chargedMicroUsd).toBe(total);
    expect(view.overview.pools.free.chargedMicroUsd + view.overview.pools.paid.chargedMicroUsd + view.overview.uncappedOwner.chargedMicroUsd).toBe(total);
    expect(view.founders.reduce((sum, founder) => sum + founder.chargedMicroUsd, 0)).toBe(total);
    expect(view.prompts.reduce((sum, prompt) => sum + prompt.chargedMicroUsd, 0)).toBe(total);
    expect(view.unit.launches.count).toBeGreaterThan(0);
    expect(data.summaries.every((summary) => summary.email === null || summary.email.endsWith("@example.test"))).toBe(true);
  });
});
