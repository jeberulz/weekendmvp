/**
 * C-JOBS — crew job types, credit prices, change rounds and plan feature keys
 * (WP69-S2).
 *
 * Consumers: Codex's credit ledger and paywall (WP70, `convex/platform/plans.ts`
 * `PLAN_LIMITS`) and Claude's crew generators. Sources: rulings D4 (prices),
 * D17 (change rounds), D19 (task literals) in `docs/wp/RULINGS.md`; strategy §6;
 * `02-architecture.md` §4.1, §4.3, §6.2, §6.3; `03-ai-cost-model.md` §7.
 *
 * Types, constants and pure helpers only: no Convex registration, no network,
 * no env reads, no side effects at import. Credits are whole numbers. Money is
 * integer micro-USD (1 USD = 1_000_000) and rounds up.
 *
 * Job keys, subjects, rounds and revisions:
 * - A job key is `crew:{projectId}:{type}:{subject}:{revision}` (`jobKey`).
 *   `subject` says which thing in the business the job works on:
 *   - `main` for the single per-business artifacts (blueprint, roster, brand kit,
 *     landing, email sequence, the launch social pack, SEO pack, launch plan,
 *     ads drafts, build pack);
 *   - the role key for `crew_hire` (two hires never share a key);
 *   - a caller-supplied request id for Studio renders and extra social packs.
 * - `changeRound` is computed server-side, in the mutation that inserts the
 *   task, as the count of prior non-failed, non-cancelled revision tasks for the
 *   same (projectId, jobType, subject). The client never supplies it. So a failed
 *   or refunded round does not use up a free round.
 * - For crew artifacts `revision === changeRound`. Always-paid jobs (Studio,
 *   hires, extra packs) count revisions the same way per subject; a new request
 *   gets a new subject, so its revision is normally 0.
 * - A key dedupes live work: inserting a task whose key matches one that is
 *   queued, running or succeeded is a no-op. A key held only by failed or
 *   cancelled tasks may be reused, because the retried round has the same
 *   revision; its provider calls get fresh attempt numbers (C-METER
 *   `attemptKey` = `{jobKey}:{attempt}`).
 */

// ---------------------------------------------------------------------------
// Job types (D19: new `tasks.type` literals)
// ---------------------------------------------------------------------------

/** Every crew or Studio job is one `tasks` row with one of these types. */
export const JOB_TYPES = [
  "crew_blueprint",
  "crew_roster",
  "crew_brand_kit",
  "crew_landing",
  "crew_email_sequence",
  "crew_social_pack",
  "crew_seo_pack",
  "crew_launch_plan",
  "crew_ads_drafts",
  "crew_build_pack",
  "crew_hire",
  "studio_image",
  "studio_video",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export function isJobType(value: unknown): value is JobType {
  return typeof value === "string" && (JOB_TYPES as readonly string[]).includes(value);
}

/** Studio renders: every run costs credits, there are no free rounds. */
export const STUDIO_JOB_TYPES = ["studio_image", "studio_video"] as const satisfies readonly JobType[];
export type StudioJobType = (typeof STUDIO_JOB_TYPES)[number];

/**
 * Crew artifacts with a D4 regenerate price. First draft and change rounds 1–2
 * are free; from round 3 they cost this action's credits.
 *
 * The social pack has no separate regenerate price in D4, so a paid revision of
 * the launch pack (no action, round 3+) costs `extra_social_pack`'s 5 credits.
 * Passing `extra_social_pack` explicitly always means a new, extra pack and is
 * charged at every round (`creditCostFor` reason `extra_artifact`).
 */
export const REGENERATE_ACTION_BY_JOB_TYPE = {
  crew_brand_kit: "brand_kit_regenerate",
  crew_landing: "landing_regenerate",
  crew_email_sequence: "email_sequence_regenerate",
  crew_social_pack: "extra_social_pack",
  crew_build_pack: "build_pack_regenerate",
} as const satisfies Partial<Record<JobType, CreditActionKey>>;

export type PricedArtifactJobType = keyof typeof REGENERATE_ACTION_BY_JOB_TYPE;

/**
 * Crew artifacts with no D4 price yet. First draft and rounds 1–2 are free like
 * every artifact; round 3 and later are NOT free and throw `PRICE_NOT_SET` until
 * the owner sets a price. Open question for the owner (WP69-S5).
 */
export const PRICE_TBD_JOB_TYPES = [
  "crew_blueprint",
  "crew_roster",
  "crew_seo_pack",
  "crew_launch_plan",
  "crew_ads_drafts",
] as const satisfies readonly JobType[];

export type PriceTbdJobType = (typeof PRICE_TBD_JOB_TYPES)[number];

// ---------------------------------------------------------------------------
// Plans and feature keys (`02` §4.3)
// ---------------------------------------------------------------------------

/** Plan ids, exactly. Never `builder` (taken by the parked credit-pack catalog) or `starter`. */
export const WORKSPACE_PLAN_IDS = ["free", "builders_hub", "growth"] as const;
export type WorkspacePlanId = (typeof WORKSPACE_PLAN_IDS)[number];

export function isWorkspacePlanId(value: unknown): value is WorkspacePlanId {
  return typeof value === "string" && (WORKSPACE_PLAN_IDS as readonly string[]).includes(value);
}

/**
 * Tenant email sends: a count over an explicit period. Free is a hard lifetime
 * count; paid plans are fair-use monthly soft caps (ops warns, sends continue).
 */
export type EmailSendsLimit = {
  readonly count: number;
  readonly period: "lifetime" | "month";
  readonly enforcement: "hard" | "soft";
};

export type WorkspaceLimits = {
  readonly businesses: number;
  /** Monthly allowance. Free is 0; its one-time grant is `STARTER_CREDITS`. */
  readonly monthlyCredits: number;
  readonly wrenMessagesPerDay: number;
  readonly tenantEmailSends: EmailSendsLimit;
  /** 0 on Free: outbound is drafts only. */
  readonly outboundSendsPerDay: number;
  readonly members: number;
};

export type WorkspaceLimitKey = keyof WorkspaceLimits;

export const WORKSPACE_FEATURE_KEYS = [
  "autopilot",
  "adsLive",
  "nativePublishing",
  "customDomain",
  "studioLongVideo",
  "hireSkippedRoles",
] as const;

export type WorkspaceFeatureKey = (typeof WORKSPACE_FEATURE_KEYS)[number];

export type WorkspaceFeatures = { readonly [K in WorkspaceFeatureKey]: boolean };

export type WorkspacePlanEntry = {
  readonly limits: WorkspaceLimits;
  readonly features: WorkspaceFeatures;
};

/** Free: one-time grant on the first business (ledger `starter_grant`, bucket `bonus`). */
export const STARTER_CREDITS = 50;

/** Monthly allowance by plan (ledger `plan_grant`, bucket `allowance`; no rollover). */
export const MONTHLY_CREDIT_ALLOWANCE = {
  free: 0,
  builders_hub: 500,
  growth: 2_000,
} as const satisfies Record<WorkspacePlanId, number>;

/**
 * The reference table Codex's `PLAN_LIMITS` must match (`02` §4.3). The
 * contract is the keys and these values; a test on Codex's side compares them.
 */
export const WORKSPACE_PLAN_REFERENCE = {
  free: {
    limits: {
      businesses: 1,
      monthlyCredits: MONTHLY_CREDIT_ALLOWANCE.free,
      wrenMessagesPerDay: 40,
      tenantEmailSends: { count: 50, period: "lifetime", enforcement: "hard" },
      outboundSendsPerDay: 0,
      members: 1,
    },
    features: {
      autopilot: false,
      adsLive: false,
      nativePublishing: false,
      customDomain: false,
      studioLongVideo: false,
      hireSkippedRoles: false,
    },
  },
  builders_hub: {
    limits: {
      businesses: 1,
      monthlyCredits: MONTHLY_CREDIT_ALLOWANCE.builders_hub,
      wrenMessagesPerDay: 300,
      tenantEmailSends: { count: 5_000, period: "month", enforcement: "soft" },
      outboundSendsPerDay: 20,
      members: 1,
    },
    features: {
      autopilot: true,
      adsLive: true,
      nativePublishing: true,
      customDomain: true,
      studioLongVideo: true,
      hireSkippedRoles: false,
    },
  },
  growth: {
    limits: {
      businesses: 3,
      monthlyCredits: MONTHLY_CREDIT_ALLOWANCE.growth,
      wrenMessagesPerDay: 600,
      tenantEmailSends: { count: 20_000, period: "month", enforcement: "soft" },
      outboundSendsPerDay: 100,
      members: 3,
    },
    features: {
      autopilot: true,
      adsLive: true,
      nativePublishing: true,
      customDomain: true,
      studioLongVideo: true,
      hireSkippedRoles: true,
    },
  },
} as const satisfies Record<WorkspacePlanId, WorkspacePlanEntry>;

// ---------------------------------------------------------------------------
// Credit actions (D4; strategy §6)
// ---------------------------------------------------------------------------

/**
 * Prices are provisional. The Phase 0 spike (WP69-S4, 2026-11-05) measured them,
 * and the owner raised the two that broke the cost rule. They stay provisional
 * until the remaining owner decisions are made (video, the unpriced change
 * rounds, the paid global budget) and a Recraft measurement confirms the image
 * prices; then S5 flips this to `"frozen"`. Re-check after the first 200 paid
 * actions.
 */
export const PRICES_STATUS: "provisional" | "frozen" = "provisional";

export type CreditActionConstraints = {
  /** Longest render this price covers, in seconds. */
  readonly maxVideoSeconds?: number;
  /** `cheapest`: only the cheapest provider tier may run at this price. */
  readonly providerTier?: "cheapest";
  /** The plan must have this feature (e.g. long video is paid plans only). */
  readonly requiresFeature?: WorkspaceFeatureKey;
  /** Image quality setting this price covers. */
  readonly imageQuality?: "standard" | "high";
  /** Number of posts in one social pack. */
  readonly posts?: number;
};

/**
 * - `always`: every run costs credits (Studio renders, extra social packs, hires).
 * - `after_free_rounds`: a regenerate price, charged from change round 3.
 */
export type CreditActionBilling = "always" | "after_free_rounds";

export type CreditAction = {
  readonly credits: number;
  readonly jobType: JobType;
  readonly billing: CreditActionBilling;
  readonly label: string;
  readonly constraints: CreditActionConstraints;
};

export const CREDIT_ACTIONS = {
  offer_image_standard: {
    // 3 credits (owner, 2026-11-05): a standard image measured $0.035 (Recraft V4.1 list
    // price) and $0.041 (OpenAI gpt-image-2 medium) in WP69-S4, over 2 × $0.013. Three
    // credits hold the rule only on Recraft, so Recraft is the default image provider.
    credits: 3,
    jobType: "studio_image",
    billing: "always",
    label: "Offer image, standard quality",
    constraints: { imageQuality: "standard" },
  },
  offer_image_high_quality: {
    credits: 5,
    jobType: "studio_image",
    billing: "always",
    label: "Offer image, high quality",
    constraints: { imageQuality: "high" },
  },
  post_image: {
    // Same render as a standard offer image, so the same 3 credits.
    credits: 3,
    jobType: "studio_image",
    billing: "always",
    label: "Story or post image",
    constraints: { imageQuality: "standard" },
  },
  short_video: {
    credits: 30,
    jobType: "studio_video",
    billing: "always",
    label: "Short video (up to 8 s)",
    constraints: { maxVideoSeconds: 8, providerTier: "cheapest" },
  },
  launch_film: {
    credits: 150,
    jobType: "studio_video",
    billing: "always",
    label: "UGC or launch film (up to 30 s)",
    constraints: { maxVideoSeconds: 30, providerTier: "cheapest", requiresFeature: "studioLongVideo" },
  },
  brand_kit_regenerate: {
    // 11 credits (owner, 2026-11-05): brand kit text $0.027 + 3 Recraft logo marks at
    // $0.035 ≈ $0.132 (WP69-S4), just over 10 × $0.013.
    credits: 11,
    jobType: "crew_brand_kit",
    billing: "after_free_rounds",
    label: "Brand kit regenerate",
    constraints: {},
  },
  landing_regenerate: {
    credits: 5,
    jobType: "crew_landing",
    billing: "after_free_rounds",
    label: "Landing page regenerate",
    constraints: {},
  },
  email_sequence_regenerate: {
    credits: 3,
    jobType: "crew_email_sequence",
    billing: "after_free_rounds",
    label: "Email sequence regenerate",
    constraints: {},
  },
  extra_social_pack: {
    credits: 5,
    jobType: "crew_social_pack",
    billing: "always",
    label: "Extra social pack (7 posts)",
    constraints: { posts: 7 },
  },
  hire_skipped_specialist: {
    credits: 20,
    jobType: "crew_hire",
    billing: "always",
    label: "Hire a skipped specialist",
    constraints: { requiresFeature: "hireSkippedRoles" },
  },
  build_pack_regenerate: {
    credits: 8,
    jobType: "crew_build_pack",
    billing: "after_free_rounds",
    label: "Engineering (build) pack regenerate",
    constraints: {},
  },
} as const satisfies Record<string, CreditAction>;

export type CreditActionKey = keyof typeof CREDIT_ACTIONS;

export function isCreditActionKey(value: unknown): value is CreditActionKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CREDIT_ACTIONS, value);
}

/** Whether a plan may run an action at all (feature gate only; balance is the ledger's job). */
export function actionAllowedOnPlan(action: CreditActionKey, plan: WorkspacePlanId): boolean {
  const constraints: CreditActionConstraints = CREDIT_ACTIONS[action].constraints;
  const feature = constraints.requiresFeature;
  if (!feature) return true;
  const features: WorkspaceFeatures = WORKSPACE_PLAN_REFERENCE[plan].features;
  return features[feature];
}

// ---------------------------------------------------------------------------
// Provider-cost rule (D4)
// ---------------------------------------------------------------------------

/** Provider cost may not exceed $0.013 per credit. */
export const MAX_PROVIDER_MICRO_USD_PER_CREDIT = 13_000;

/** The most an action priced at `credits` may cost us at the provider, in micro-USD. */
export function maxProviderMicroUsdFor(credits: number): number {
  if (!Number.isInteger(credits) || credits < 0) {
    throw new JobsContractError("INVALID_CREDITS", `credits must be a non-negative integer, got ${credits}`);
  }
  return credits * MAX_PROVIDER_MICRO_USD_PER_CREDIT;
}

/** True when a measured (or planned) provider cost fits the price. */
export function priceRespectsCostRule(credits: number, measuredMicroUsd: number): boolean {
  if (!Number.isInteger(measuredMicroUsd) || measuredMicroUsd < 0) {
    throw new JobsContractError(
      "INVALID_COST",
      `measuredMicroUsd must be a non-negative integer, got ${measuredMicroUsd}`,
    );
  }
  return measuredMicroUsd <= maxProviderMicroUsdFor(credits);
}

// ---------------------------------------------------------------------------
// Free work and change rounds (D17; `02` §6.3)
// ---------------------------------------------------------------------------

/** "Ask for changes" rounds 1 and 2 are free per artifact. Round 0 is the first draft. */
export const FREE_CHANGE_ROUNDS = 2;

export type CreditCostReason =
  /** Round 0: every first draft in the weekend launch is free. */
  | "first_draft"
  /** Rounds 1..FREE_CHANGE_ROUNDS. */
  | "free_change_round"
  /** Round 3+: the artifact's regenerate price; debits only after the founder approves the spend. */
  | "paid_change_round"
  /** Studio renders and hiring a specialist always cost credits. */
  | "always_paid"
  /** An extra artifact beyond the launch one (an extra social pack): always costs credits. */
  | "extra_artifact";

export type CreditCost = {
  readonly credits: number;
  readonly free: boolean;
  readonly reason: CreditCostReason;
  /** The priced action, when credits are charged. */
  readonly action?: CreditActionKey;
};

export type CreditCostInput = {
  readonly jobType: JobType;
  /**
   * 0 = first draft; n = the nth "Ask for changes" round. Computed server-side
   * in the mutation that inserts the task (count of prior non-failed,
   * non-cancelled revision tasks for the same projectId, jobType and subject),
   * never taken from the client. A failed or refunded round does not use up a
   * free round. For crew artifacts it equals the job key's revision.
   */
  readonly changeRound: number;
  /**
   * Set for Studio renders (required), extra packs, and optionally hires or a
   * paid revision's own regenerate action. Any other action throws.
   */
  readonly action?: CreditActionKey;
  /** The owner's plan; a priced action the plan lacks throws `PLAN_GATED`. */
  readonly plan: WorkspacePlanId;
};

/**
 * The credit price of one job. Pure; the ledger debits `credits` at job start
 * only when `free` is false and a `spend` approval exists.
 *
 * Rules, in order:
 * 1. Studio jobs need an action and always cost credits (`always_paid`).
 * 2. `crew_hire` always costs `hire_skipped_specialist` (`always_paid`).
 * 3. An explicit always-paid action on a crew job (an extra social pack) always
 *    costs credits (`extra_artifact`), whatever the round.
 * 4. Any other explicit action must be the job type's regenerate action, or it throws.
 * 5. Rounds 0..`FREE_CHANGE_ROUNDS` are free; later rounds cost the regenerate
 *    price, or throw `PRICE_NOT_SET` for an unpriced artifact.
 * A priced action the plan does not include throws `PLAN_GATED`.
 *
 * `changeRound` must come from the server-side count described on
 * `CreditCostInput`; see the file header for subjects and revisions.
 */
export function creditCostFor(input: CreditCostInput): CreditCost {
  const { jobType, changeRound, action, plan } = input;
  if (!isJobType(jobType)) {
    throw new JobsContractError("UNKNOWN_JOB_TYPE", `unknown job type: ${String(jobType)}`);
  }
  if (!Number.isInteger(changeRound) || changeRound < 0) {
    throw new JobsContractError(
      "INVALID_CHANGE_ROUND",
      `changeRound must be a non-negative integer, got ${changeRound}`,
    );
  }
  if (!isWorkspacePlanId(plan)) {
    throw new JobsContractError("UNKNOWN_PLAN", `unknown plan: ${String(plan)}`);
  }
  if (action !== undefined) {
    if (!isCreditActionKey(action)) {
      throw new JobsContractError("UNKNOWN_ACTION", `unknown credit action: ${String(action)}`);
    }
    if (CREDIT_ACTIONS[action].jobType !== jobType) {
      throw new JobsContractError(
        "ACTION_JOB_MISMATCH",
        `action ${action} runs as ${CREDIT_ACTIONS[action].jobType}, not ${jobType}`,
      );
    }
  }

  const priced = (priceAction: CreditActionKey, reason: CreditCostReason): CreditCost => {
    if (!actionAllowedOnPlan(priceAction, plan)) {
      throw new JobsContractError("PLAN_GATED", `${priceAction} is not included in the ${plan} plan`);
    }
    return { credits: CREDIT_ACTIONS[priceAction].credits, free: false, reason, action: priceAction };
  };

  if (jobType === "studio_image" || jobType === "studio_video") {
    if (action === undefined) {
      throw new JobsContractError("ACTION_REQUIRED", `${jobType} needs a credit action to be priced`);
    }
    return priced(action, "always_paid");
  }
  if (jobType === "crew_hire") return priced("hire_skipped_specialist", "always_paid");

  if (action !== undefined) {
    const billing: CreditActionBilling = CREDIT_ACTIONS[action].billing;
    if (billing === "always") return priced(action, "extra_artifact");
    const regenerate = isPricedArtifactJobType(jobType) ? REGENERATE_ACTION_BY_JOB_TYPE[jobType] : undefined;
    if (action !== regenerate) {
      throw new JobsContractError("ACTION_NOT_APPLICABLE", `${action} does not price a ${jobType} job`);
    }
  }

  if (changeRound === 0) return { credits: 0, free: true, reason: "first_draft" };
  if (changeRound <= FREE_CHANGE_ROUNDS) return { credits: 0, free: true, reason: "free_change_round" };

  if (isPricedArtifactJobType(jobType)) {
    return priced(REGENERATE_ACTION_BY_JOB_TYPE[jobType], "paid_change_round");
  }

  throw new JobsContractError(
    "PRICE_NOT_SET",
    `${jobType} has no credit price for change round ${changeRound}; the owner has not set one`,
  );
}

function isPricedArtifactJobType(jobType: JobType): jobType is PricedArtifactJobType {
  return Object.prototype.hasOwnProperty.call(REGENERATE_ACTION_BY_JOB_TYPE, jobType);
}

// ---------------------------------------------------------------------------
// Job idempotency key (`02` §6.2, extended with a subject)
// ---------------------------------------------------------------------------

/** The subject of a single per-business artifact. */
export const JOB_SUBJECT_MAIN = "main";

/** Longest subject (role key or request id). */
export const JOB_SUBJECT_MAX_LENGTH = 64;

/**
 * Which subjects a job type takes:
 * - `main`: only `main` (the single per-business artifacts);
 * - `named`: never `main` (hires: the role key; Studio: a request id);
 * - `main_or_named`: `main` for the launch social pack, a request id for an extra pack.
 */
export const JOB_SUBJECT_RULE = {
  crew_blueprint: "main",
  crew_roster: "main",
  crew_brand_kit: "main",
  crew_landing: "main",
  crew_email_sequence: "main",
  crew_social_pack: "main_or_named",
  crew_seo_pack: "main",
  crew_launch_plan: "main",
  crew_ads_drafts: "main",
  crew_build_pack: "main",
  crew_hire: "named",
  studio_image: "named",
  studio_video: "named",
} as const satisfies Record<JobType, "main" | "named" | "main_or_named">;

function subjectProblem(jobType: JobType, subject: unknown): string | null {
  if (typeof subject !== "string" || subject.length === 0 || subject.length > JOB_SUBJECT_MAX_LENGTH) {
    return `subject must be 1-${JOB_SUBJECT_MAX_LENGTH} characters`;
  }
  if (subject.includes(":")) return "subject must not contain ':'";
  const rule = JOB_SUBJECT_RULE[jobType];
  if (rule === "main" && subject !== JOB_SUBJECT_MAIN) return `${jobType} takes the subject "main"`;
  if (rule === "named" && subject === JOB_SUBJECT_MAIN) return `${jobType} needs a role key or request id, not "main"`;
  return null;
}

/**
 * `crew:{projectId}:{type}:{subject}:{revision}`. Re-inserting live work with
 * the same key is a no-op (see the file header for subjects and revisions).
 */
export function jobKey(projectId: string, jobType: JobType, subject: string, revision: number): string {
  if (typeof projectId !== "string" || projectId.length === 0 || projectId.includes(":")) {
    throw new JobsContractError("INVALID_JOB_KEY", "projectId must be a non-empty string without ':'");
  }
  if (!isJobType(jobType)) {
    throw new JobsContractError("UNKNOWN_JOB_TYPE", `unknown job type: ${String(jobType)}`);
  }
  const problem = subjectProblem(jobType, subject);
  if (problem) throw new JobsContractError("INVALID_JOB_KEY", problem);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new JobsContractError("INVALID_JOB_KEY", `revision must be a non-negative integer, got ${revision}`);
  }
  return `crew:${projectId}:${jobType}:${subject}:${revision}`;
}

export type ParsedJobKey = {
  readonly projectId: string;
  readonly jobType: JobType;
  readonly subject: string;
  readonly revision: number;
};

/** The parts of a job key, or null when the string is not a valid one. */
export function parseJobKey(key: string): ParsedJobKey | null {
  if (typeof key !== "string") return null;
  const match = /^crew:([^:]+):([a-z_]+):([^:]+):(0|[1-9][0-9]*)$/.exec(key);
  if (!match) return null;
  const [, projectId, jobType, subject, revisionText] = match;
  if (!isJobType(jobType)) return null;
  if (subjectProblem(jobType, subject)) return null;
  const revision = Number(revisionText);
  if (!Number.isSafeInteger(revision)) return null;
  return { projectId, jobType, subject, revision };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const JOBS_ERROR_CODES = [
  "UNKNOWN_JOB_TYPE",
  "UNKNOWN_ACTION",
  "UNKNOWN_PLAN",
  "INVALID_CHANGE_ROUND",
  "ACTION_REQUIRED",
  "ACTION_JOB_MISMATCH",
  "ACTION_NOT_APPLICABLE",
  "PLAN_GATED",
  "PRICE_NOT_SET",
  "INVALID_JOB_KEY",
  "INVALID_CREDITS",
  "INVALID_COST",
] as const;

export type JobsErrorCode = (typeof JOBS_ERROR_CODES)[number];

/** Thrown by the pure helpers in this file. A programming error, never shown to founders as-is. */
export class JobsContractError extends Error {
  readonly code: JobsErrorCode;

  constructor(code: JobsErrorCode, message: string) {
    super(message);
    this.name = "JobsContractError";
    this.code = code;
  }
}

export function isJobsContractError(value: unknown): value is JobsContractError {
  return value instanceof JobsContractError;
}
