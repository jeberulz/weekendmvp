/**
 * Fixture: a small, fully valid, APPROVED Pain Engine review record for the
 * editorial submission tests.
 *
 * It passes `buildSubmission` end to end (title gate, manifest identity and
 * taxonomy, evidence mapping, source-review self-check) and the editorial
 * envelope schema, so the validator and convex tests can assert on the
 * real submission path instead of a hand-shaped envelope.
 *
 * The draft is invented test data — it is never a real submission: the slug
 * is `fixture-quiet-hours`, the findings point at example URLs, and the
 * record is built in memory only (never written under engine/pain/review/).
 */
import type { PainFinding, ReviewRecord, Scorecard } from "../types";

export const FIXTURE_SLUG = "fixture-quiet-hours";
export const FIXTURE_TITLE = "Quiet Hours for Shared Desks";
export const FIXTURE_PRODUCT_NAME = "Quiet Hours";

const FINDING_1: PainFinding = {
  source: "hacker-news",
  url: "https://news.ycombinator.com/item?id=40000001",
  title: "Shared desks are too noisy to focus",
  text: "I pay for a hot desk and still end up working from a cafe because the open floor is too loud for calls.",
  context: "HN user dang",
  date: "2026-11-20",
  agreementCount: 42,
  quote: "I pay for a hot desk and still end up working from a cafe.",
};

const FINDING_2: PainFinding = {
  source: "github-issues",
  url: "https://github.com/example/quiet-hours/issues/1",
  title: "Need a way to book a quiet slot",
  text: "Members want to reserve a quiet hour before they arrive so they know they will have a focused block.",
  context: "GitHub issue",
  date: "2026-11-21",
  agreementCount: 7,
  quote: "Members want to reserve a quiet hour before they arrive.",
};

const SCORECARD: Scorecard = {
  composite: 5.5,
  opportunity: 5,
  problem: 6,
  feasibility: 8,
  whyNow: 4,
  labels: { opportunity: "Good", problem: "Good", feasibility: "Strong", whyNow: "Weak" },
  verdict: "BUILD",
  rationale: "Fixture verdict: real, repeated pain with a small buildable first version.",
};

function fixtureMdx(): string {
  return `---
slug: ${FIXTURE_SLUG}
title: "${FIXTURE_TITLE}"
---

## The Problem

Shared desks are too noisy to focus. People pay for a hot desk and still end up working from a cafe because the open floor is too loud for calls.

## The Solution

Quiet Hours lets members reserve a focused hour at a shared desk before they arrive.

**How it works:**

1. **Pick a quiet slot** — members book an hour in a low-noise zone.
2. **Hold the desk** — the desk is held for that hour, no walk-ins.
3. **Focus, then leave** — the slot ends and the desk returns to open use.

## Market Research

Two reports from two sources describe the same pain: paying for a desk that is too loud to use for calls.

## Competitive Landscape

The status quo is working from a cafe instead of the desk that was already paid for.

## Business Model

A small per-slot fee paid by members, or a monthly add-on sold to the desk operator.

## Recommended Tech Stack

A booking page, a calendar, and a simple payment link.

## AI Prompts to Build This

Ask for a booking page with time slots, a hold, and a confirmation email.

## Sources

- "I pay for a hot desk and still end up working from a cafe." — HN user dang
- "Members want to reserve a quiet hour before they arrive." — GitHub issue
`;
}

export type FixtureOverrides = {
  /** Defaults to "approved". */
  status?: ReviewRecord["status"];
  /** Defaults to a fixed decidedAt; pass null to omit it. */
  decidedAt?: string | null;
  /** Replace the first finding's quote (and its text) — changes the record hash. */
  findingText?: string;
};

/** Build the fixture record. Pass `status: "pending"` for refusal tests. */
export function buildApprovedFixtureRecord(overrides: FixtureOverrides = {}): ReviewRecord {
  const finding1: PainFinding = overrides.findingText
    ? { ...FINDING_1, text: overrides.findingText, quote: overrides.findingText }
    : FINDING_1;
  const findings = [finding1, FINDING_2];
  const slug = FIXTURE_SLUG;
  const title = FIXTURE_TITLE;
  const mdx = fixtureMdx();
  const manifestRow: Record<string, unknown> = {
    slug,
    title,
    category: "saas",
    description: `${title} — ${FIXTURE_PRODUCT_NAME}, a weekend-buildable tool for the people reporting this pain.`,
    buildTime: "10",
    revenueGoal: "5k-month",
    applicationCategory: "BusinessApplication",
    tools: ["claude", "cursor", "v0"],
    audiences: ["solo-founders", "weekend-builders"],
    source: `pain-engine:${slug}`,
    scores: {
      opportunity: 5,
      pain: 6,
      timing: 4,
      builder_confidence: 8,
    },
    og: {
      subject: `${FIXTURE_PRODUCT_NAME}: a focused tool that removes one manual task, shown in use, no people, no legible text`,
      accent: "mint",
      status: "draft",
    },
    researchLevel: "deep",
    provenance: {
      researchCalls: ["pain-engine:listen", "pain-engine:cluster", "pain-engine:write"],
      citations: 2,
      wordCount: 1200,
      auditPassed: false,
      publishNotes: "pain-engine draft; awaiting single human approval",
      researchMode: "pain-engine",
    },
    highlights: { problemQuote: finding1.quote },
  };
  const record: ReviewRecord = {
    slug,
    status: overrides.status ?? "approved",
    createdAt: "2026-11-24T00:00:00.000Z",
    decidedAt: overrides.decidedAt === null ? undefined : (overrides.decidedAt ?? "2026-11-24T12:00:00.000Z"),
    decisionReason: "Fixture approval.",
    cluster: {
      id: "cluster-fixture",
      label: "shared desk noise",
      findings,
      sources: ["hacker-news", "github-issues"],
      score: {
        frequency: 5,
        intensity: 6,
        workaroundSpend: 3,
        buildability: 8,
        total: 55,
        rationale: "Fixture cluster.",
      },
      scorecard: SCORECARD,
    },
    draft: {
      slug,
      title,
      productName: FIXTURE_PRODUCT_NAME,
      category: "saas",
      mdx,
      manifestRow,
      evidence: findings,
      gaps: [],
      scorecard: SCORECARD,
      communitySignals: [
        { source: "hacker-news", reports: 1, totalAgreement: 42 },
        { source: "github-issues", reports: 1, totalAgreement: 7 },
      ],
      prices: [],
      statusQuoCompetitor: "",
      biggestRisk: "Fixture risk: willingness to pay is unproven.",
      notProven: ["Fixture unproven: nobody has paid for a quiet slot yet."],
      demands: {
        timeToFirstRevenue: "2 weeks",
        capital: "$0",
        difficulty: "Easy",
        difficultyScore: 2,
      },
      costUsd: 0,
    },
    runCostUsd: 0,
  };
  return record;
}
