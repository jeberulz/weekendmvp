/**
 * WP93. Deterministic fictional data for the local demo of the AI cost
 * console (development only, `EDITORIAL_FIXTURE_MODE=local-demo`). Costs are
 * priced with the real rate cards, so the what-if baseline matches the
 * charges. Emails use the reserved `example.test` domain.
 */

import { anthropicCostMicroUsd } from "@/convex/ai/pricing";
import {
  FREE_LIFETIME_CEILING_MICRO_USD,
  OWNER_DAILY_CAP_MICRO_USD,
} from "@/lib/workspace/contracts/metering";
import type { PromptModel } from "@/lib/workspace/contracts/prompts";
import { chargedMicroUsd } from "./money";
import { DAY_MS, utcDayKeyOf, utcDayStart } from "./ranges";
import type {
  ControlRoom,
  OwnerSummary,
  ProjectCost,
  TimelineRow,
  UsageErrorClass,
  UsagePlan,
  UsageRow,
  UsageTier,
} from "./types";

/** Mulberry32: small, seeded, deterministic. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type CallSpec = {
  readonly promptRef: string;
  readonly model: PromptModel;
  readonly tier: Extract<UsageTier, "fast" | "draft" | "deep">;
  readonly input: [number, number];
  readonly output: [number, number];
  readonly cacheShare: number;
  readonly reserveFactor: number;
  readonly batch?: boolean;
};

const WREN_CHAT: CallSpec = { promptRef: "wren-chat@1", model: "claude-haiku-5-5", tier: "fast", input: [3_000, 9_000], output: [150, 600], cacheShare: 0.7, reserveFactor: 6 };
const WREN_PLAN: CallSpec = { promptRef: "wren-plan-turn@1", model: "claude-sonnet-5-5", tier: "draft", input: [5_000, 14_000], output: [400, 1_400], cacheShare: 0.55, reserveFactor: 5 };
const LAUNCH_STEPS: readonly CallSpec[] = [
  { promptRef: "crew-blueprint-personalise@3", model: "claude-sonnet-5-5", tier: "draft", input: [9_000, 16_000], output: [2_500, 5_000], cacheShare: 0.2, reserveFactor: 3 },
  { promptRef: "crew-brand-kit@3", model: "claude-sonnet-5-5", tier: "draft", input: [6_000, 11_000], output: [1_800, 3_600], cacheShare: 0.35, reserveFactor: 3 },
  { promptRef: "crew-email-sequence@3", model: "claude-sonnet-5-5", tier: "draft", input: [7_000, 12_000], output: [2_200, 4_400], cacheShare: 0.35, reserveFactor: 3 },
  { promptRef: "crew-social-pack@4", model: "claude-sonnet-5-5", tier: "draft", input: [7_000, 12_000], output: [2_000, 4_000], cacheShare: 0.35, reserveFactor: 3 },
];
const SEED: CallSpec = { promptRef: "crew-idea-seed@3", model: "claude-opus-5-5", tier: "deep", input: [18_000, 32_000], output: [3_000, 6_000], cacheShare: 0.1, reserveFactor: 2.5, batch: true };

type Founder = { id: string; email: string; plan: UsagePlan; activity: number; projects: string[]; inCohort: boolean };

const FOUNDER_PLANS: readonly UsagePlan[] = ["free", "free", "builders_hub", "free", "free", "builders_hub", "free", "free", "growth", "free", "free", "free"];

function founders(): Founder[] {
  return FOUNDER_PLANS.map((plan, index) => {
    const n = String(index + 1).padStart(2, "0");
    return {
      id: `fixture-owner-${n}`,
      email: `founder${n}@example.test`,
      plan,
      activity: [0.9, 0.35, 0.8, 0.5, 0.2, 0.7, 0.15, 0.45, 0.6, 0.3, 0.25, 0.1][index],
      projects: plan === "free" ? [`fixture-business-${n}a`] : [`fixture-business-${n}a`, `fixture-business-${n}b`],
      inCohort: index < 10,
    };
  });
}

export type FixtureData = {
  readonly rows: readonly UsageRow[];
  readonly summaries: readonly OwnerSummary[];
  readonly projects: readonly ProjectCost[];
  readonly controlRoom: ControlRoom;
};

const cache = new Map<string, FixtureData>();

/** The same data for the whole UTC day, regenerated when the day changes. */
export function fixtureData(nowMs: number): FixtureData {
  const today = utcDayKeyOf(nowMs);
  const hit = cache.get(today);
  if (hit) return hit;
  const data = buildFixture(nowMs);
  cache.clear();
  cache.set(today, data);
  return data;
}

function buildFixture(nowMs: number): FixtureData {
  const rand = seeded(9_301);
  const between = ([lo, hi]: [number, number]) => Math.round(lo + rand() * (hi - lo));
  const rows: UsageRow[] = [];
  const people = founders();
  const todayStart = utcDayStart(utcDayKeyOf(nowMs));
  let serial = 0;

  const push = (
    spec: CallSpec,
    at: number,
    owner: Founder | null,
    projectId: string | null,
    flags: { status?: UsageRow["status"]; errorClass?: UsageErrorClass; reask?: boolean; escalation?: boolean; maxTokens?: boolean; swept?: boolean } = {},
  ) => {
    serial += 1;
    const promptTokens = between(spec.input);
    const cacheRead = Math.round(promptTokens * spec.cacheShare * (0.6 + rand() * 0.8));
    const cacheWrite = Math.round((promptTokens - cacheRead) * 0.15);
    const input = Math.max(0, promptTokens - cacheRead - cacheWrite);
    const output = flags.maxTokens ? spec.output[1] * 2 : between(spec.output);
    const usage = { inputTokens: input, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite, outputTokens: output };
    const cost = anthropicCostMicroUsd(spec.model, usage, { batch: spec.batch === true });
    const reserved = Math.ceil(cost * spec.reserveFactor);
    const status = flags.status ?? "settled";
    const failed = status === "failed";
    const possiblyBilled = failed && (flags.swept || flags.errorClass === "timeout");
    const plan = owner?.plan ?? null;
    rows.push({
      id: `fixture-usage-${String(serial).padStart(5, "0")}`,
      ownerId: owner?.id ?? null,
      projectId,
      promptRef: spec.promptRef,
      provider: "anthropic",
      model: spec.model,
      tier: spec.tier,
      plan,
      globalPool: plan === "builders_hub" || plan === "growth" ? "paid" : "free",
      creditFunded: false,
      batch: spec.batch === true,
      escalation: flags.escalation === true,
      reask: flags.reask === true,
      status,
      reservedMicroUsd: reserved,
      costMicroUsd: status === "settled" ? cost : possiblyBilled ? reserved : failed && flags.errorClass === "schema_invalid" ? cost : 0,
      lateCostMicroUsd: null,
      inputTokens: status === "settled" || flags.errorClass === "schema_invalid" ? input : 0,
      cacheReadTokens: status === "settled" || flags.errorClass === "schema_invalid" ? cacheRead : 0,
      cacheWriteTokens: status === "settled" || flags.errorClass === "schema_invalid" ? cacheWrite : 0,
      outputTokens: status === "settled" || flags.errorClass === "schema_invalid" ? output : 0,
      images: null,
      estimated: false,
      latencyMs: spec.batch ? 3_600_000 : between([900, 14_000]),
      stopReason: status === "settled" ? (flags.maxTokens ? "max_tokens" : "end_turn") : null,
      billed: failed ? (possiblyBilled ? "possible" : flags.errorClass === "schema_invalid" ? "actual" : "none") : status === "settled" ? "actual" : null,
      errorClass: failed ? flags.errorClass ?? "retryable" : null,
      swept: flags.swept === true,
      createdAt: at,
      dayKey: utcDayKeyOf(at),
    });
  };

  const pushImage = (at: number, owner: Founder, projectId: string, recraft: boolean) => {
    serial += 1;
    const cost = recraft ? 35_000 : 41_000;
    rows.push({
      id: `fixture-usage-${String(serial).padStart(5, "0")}`,
      ownerId: owner.id, projectId,
      promptRef: recraft ? "crew-brand-kit@3" : "crew-landing-image@1",
      provider: recraft ? "recraft" : "openai_images",
      model: recraft ? "recraftv4_1" : "gpt-image-2",
      tier: "image", plan: owner.plan,
      globalPool: owner.plan === "free" ? "free" : "paid",
      creditFunded: owner.plan === "free", batch: false, escalation: false, reask: false,
      status: "settled", reservedMicroUsd: cost + 2_000, costMicroUsd: cost, lateCostMicroUsd: null,
      inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0, images: 1,
      estimated: recraft, latencyMs: between([6_000, 20_000]), stopReason: null, billed: "actual",
      errorClass: null, swept: false, createdAt: at, dayKey: utcDayKeyOf(at),
    });
  };

  // 30 days back to today; today's activity stops at "now".
  for (let back = 29; back >= 0; back -= 1) {
    const dayStart = todayStart - back * DAY_MS;
    const dayEnd = back === 0 ? nowMs : dayStart + DAY_MS;
    const at = () => Math.min(dayEnd - 1, dayStart + Math.floor(rand() * Math.max(1, dayEnd - dayStart)));

    // Ownerless seeds, nightly batch.
    const seeds = back % 3 === 0 ? 5 : 2;
    for (let s = 0; s < seeds; s += 1) {
      const failSeed = rand() < 0.06;
      push(SEED, at(), null, null, failSeed ? { status: "failed", errorClass: "permanent" } : {});
    }

    for (const founder of people) {
      if (rand() > founder.activity) continue;
      // A launch on one of the founder's businesses, at most once per business, early in the month.
      const launchProject = founder.projects.find((projectId, index) => back === 25 - ((Number(founder.id.slice(-2)) * 3 + index * 7) % 26));
      if (launchProject) {
        const start = at();
        for (const [index, step] of LAUNCH_STEPS.entries()) {
          const t = start + index * 90_000;
          const fail = rand() < 0.08;
          if (fail) {
            push(step, t, founder, launchProject, { status: "failed", errorClass: "schema_invalid" });
            push(step, t + 20_000, founder, launchProject, { reask: true });
          } else {
            push(step, t, founder, launchProject, { maxTokens: rand() < 0.05 });
          }
        }
        pushImage(start + 400_000, founder, launchProject, true);
        pushImage(start + 420_000, founder, launchProject, false);
      }
      const project = founder.projects[0];
      const messages = Math.round(2 + rand() * 12 * founder.activity);
      for (let m = 0; m < messages; m += 1) {
        const plan = rand() < 0.18;
        const roll = rand();
        push(plan ? WREN_PLAN : WREN_CHAT, at(), founder, project,
          roll < 0.03 ? { status: "failed", errorClass: "timeout" } : roll < 0.045 ? { status: "failed", errorClass: "refusal" } : roll < 0.06 ? { escalation: true } : {});
      }
    }
  }

  // Two calls in flight right now, and one stale reservation the sweep finalised.
  push(WREN_CHAT, nowMs - 4_000, people[0], people[0].projects[0], { status: "reserved" });
  push(LAUNCH_STEPS[1], nowMs - 30_000, people[2], people[2].projects[0], { status: "reserved" });
  push(WREN_PLAN, todayStart + 60_000, people[3], people[3].projects[0], { status: "failed", errorClass: "indeterminate", swept: true });

  rows.sort((a, b) => a.createdAt - b.createdAt);

  const today = utcDayKeyOf(nowMs);
  const summaries: OwnerSummary[] = people.map((founder) => {
    const mine = rows.filter((row) => row.ownerId === founder.id);
    const day = mine.filter((row) => row.dayKey === today);
    const freeWork = mine.filter((row) => row.globalPool === "free" && !row.creditFunded);
    return {
      ownerId: founder.id,
      email: founder.email,
      plan: founder.plan,
      inCohort: founder.inCohort,
      daySpentMicroUsd: day.reduce((sum, row) => sum + chargedMicroUsd(row), 0),
      dayCapMicroUsd: OWNER_DAILY_CAP_MICRO_USD[founder.plan],
      reservedMicroUsd: mine.filter((row) => row.status === "reserved").reduce((sum, row) => sum + row.reservedMicroUsd, 0),
      freeLifetimeSpentMicroUsd: founder.plan === "free" ? freeWork.reduce((sum, row) => sum + chargedMicroUsd(row), 0) : 0,
      freeLifetimeCeilingMicroUsd: FREE_LIFETIME_CEILING_MICRO_USD,
      businesses: founder.projects.length,
      launches: new Set(mine.filter((row) => row.promptRef.startsWith("crew-")).map((row) => row.projectId)).size,
      businessesTruncated: false,
      lastActiveAt: mine.at(-1)?.createdAt ?? null,
    };
  });

  const projectIds = [...new Set(rows.map((row) => row.projectId).filter((id): id is string => id !== null))];
  const projects: ProjectCost[] = projectIds.map((projectId) => {
    const mine = rows.filter((row) => row.projectId === projectId);
    const wren = mine.filter((row) => row.promptRef.startsWith("wren-"));
    const launch = mine.filter((row) => !row.promptRef.startsWith("wren-"));
    return {
      projectId,
      ownerId: mine[0]?.ownerId ?? null,
      hasLaunch: launch.some((row) => row.promptRef.startsWith("crew-")),
      firstCallAt: mine[0]?.createdAt ?? null,
      lastCallAt: mine.at(-1)?.createdAt ?? null,
      calls: mine.length,
      failedCalls: mine.filter((row) => row.status === "failed").length,
      launchMicroUsd: launch.reduce((sum, row) => sum + chargedMicroUsd(row), 0),
      wrenMicroUsd: wren.reduce((sum, row) => sum + chargedMicroUsd(row), 0),
      truncated: false,
    };
  });

  const todayRows = rows.filter((row) => row.dayKey === today);
  const poolSpent = (pool: "free" | "paid") => todayRows.filter((row) => row.globalPool === pool).reduce((sum, row) => sum + chargedMicroUsd(row), 0);
  const poolInFlight = (pool: "free" | "paid") => todayRows.filter((row) => row.globalPool === pool && row.status === "reserved").reduce((sum, row) => sum + row.reservedMicroUsd, 0);
  const freeSpent = poolSpent("free");
  const controlRoom: ControlRoom = {
    configured: true,
    workspaceEnabled: true,
    cohortMode: "allowlist",
    cohortSize: people.filter((founder) => founder.inCohort).length,
    cohortSizeTruncated: false,
    freeBudgetMicroUsd: 7_000_000,
    paidBudgetMicroUsd: 3_000_000,
    killSwitches: { ai: false, studioVideo: true, publish: true, email: true, social: true, ads: true },
    spendAlarmState: { dayKey: today, free80: freeSpent + poolInFlight("free") >= 5_600_000, free100: false, paid80: false, paid100: false },
    dayKey: today,
    free: { spentMicroUsd: freeSpent, inFlightMicroUsd: poolInFlight("free") },
    paid: { spentMicroUsd: poolSpent("paid"), inFlightMicroUsd: poolInFlight("paid") },
  };

  return { rows, summaries, projects, controlRoom };
}

/** A fixture founder's (or the platform's) timeline, newest first. */
export function fixtureTimeline(data: FixtureData, ownerId: string | null): TimelineRow[] {
  return data.rows
    .filter((row) => row.ownerId === ownerId)
    .slice()
    .reverse()
    .map((row) => ({
      ...row,
      errorKind: row.promptRef.startsWith("crew-idea-seed") && row.status === "failed" ? "invalid_request_error" : null,
      errorDetail: row.promptRef.startsWith("crew-idea-seed") && row.status === "failed"
        ? "messages.0.content: input exceeds the batch request size limit (fictional)"
        : null,
    }));
}
