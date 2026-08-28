import { DAY, HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components } from "../_generated/api";
import { env, internalQuery, mutation } from "../_generated/server";
import {
  STARTER_KIT_BLOCKER_VALUES,
  STARTER_KIT_PROGRESS_VALUES,
  STARTER_KIT_SECTION_VALUES,
  type StarterKitBlocker,
  type StarterKitProgress,
  type StarterKitSection,
} from "./starterKitFeedbackValidators";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  feedbackBurst: { kind: "token bucket", rate: 3, period: HOUR },
  feedbackSustained: { kind: "token bucket", rate: 10, period: DAY },
});

const MAX_BRIDGE_PAYLOAD_BYTES = 4_096;
const MAX_COMMENTS_LENGTH = 1_000;
const MAX_EMAIL_LENGTH = 320;

type FeedbackPayload = {
  respondentKey: string;
  clientKey: string;
  progress: StarterKitProgress;
  helpfulness: number;
  mostUseful?: StarterKitSection;
  blocker?: StarterKitBlocker;
  comments?: string;
  followUpEmail?: string;
  followUpConsent: boolean;
};

function feedbackBridgeSecret(): string {
  const secret = env.STARTER_KIT_FEEDBACK_BRIDGE_SECRET;
  if (!secret || secret.length < 32) {
    throw new ConvexError({ code: "FEEDBACK_BRIDGE_NOT_CONFIGURED" });
  }
  return secret;
}

function decodeBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function verifyBridgeSignature(
  payload: string,
  signature: string,
): Promise<void> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(feedbackBridgeSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let supplied: ArrayBuffer;
  try {
    supplied = decodeBase64Url(signature);
  } catch {
    throw new ConvexError({ code: "INVALID_FEEDBACK_BRIDGE_SIGNATURE" });
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    supplied,
    new TextEncoder().encode(payload),
  );
  if (!valid) {
    throw new ConvexError({ code: "INVALID_FEEDBACK_BRIDGE_SIGNATURE" });
  }
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (!isOneOf(value, allowed)) {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }
  return value;
}

function optionalText(value: unknown, maximum: number): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string") {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }
  const normalized = value.trim();
  if (normalized.length === 0) return undefined;
  if (normalized.length > maximum) {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }
  return normalized;
}

function parseFeedbackPayload(payload: string): FeedbackPayload {
  if (new TextEncoder().encode(payload).byteLength > MAX_BRIDGE_PAYLOAD_BYTES) {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set([
    "respondentKey",
    "clientKey",
    "progress",
    "helpfulness",
    "mostUseful",
    "blocker",
    "comments",
    "followUpEmail",
    "followUpConsent",
  ]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }
  if (
    typeof record.respondentKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.respondentKey) ||
    typeof record.clientKey !== "string" ||
    record.clientKey.length === 0 ||
    record.clientKey.length > 80 ||
    !isOneOf(record.progress, STARTER_KIT_PROGRESS_VALUES) ||
    typeof record.helpfulness !== "number" ||
    !Number.isInteger(record.helpfulness) ||
    record.helpfulness < 1 ||
    record.helpfulness > 5 ||
    typeof record.followUpConsent !== "boolean"
  ) {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }

  const comments = optionalText(record.comments, MAX_COMMENTS_LENGTH);
  const followUpEmail = optionalText(record.followUpEmail, MAX_EMAIL_LENGTH)?.toLowerCase();
  if (
    (followUpEmail !== undefined &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(followUpEmail) ||
        !record.followUpConsent)) ||
    (record.followUpConsent && followUpEmail === undefined)
  ) {
    throw new ConvexError({ code: "INVALID_FEEDBACK_PAYLOAD" });
  }

  return {
    respondentKey: record.respondentKey,
    clientKey: record.clientKey,
    progress: record.progress,
    helpfulness: record.helpfulness,
    mostUseful: optionalEnum(record.mostUseful, STARTER_KIT_SECTION_VALUES),
    blocker: optionalEnum(record.blocker, STARTER_KIT_BLOCKER_VALUES),
    comments,
    followUpEmail,
    followUpConsent: record.followUpConsent,
  };
}

export const consumeSubmissionQuota = mutation({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args) => {
    await verifyBridgeSignature(args.payload, args.signature);
    const feedback = parseFeedbackPayload(args.payload);
    await rateLimiter.limit(ctx, "feedbackBurst", {
      key: feedback.clientKey,
      throws: true,
    });
    await rateLimiter.limit(ctx, "feedbackSustained", {
      key: feedback.clientKey,
      throws: true,
    });
    return { ok: true as const };
  },
});

export const submitFromBridge = mutation({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args) => {
    await verifyBridgeSignature(args.payload, args.signature);
    const feedback = parseFeedbackPayload(args.payload);
    const now = Date.now();
    const existing = await ctx.db
      .query("starter_kit_feedback")
      .withIndex("by_respondentKey", (q) =>
        q.eq("respondentKey", feedback.respondentKey),
      )
      .unique();

    const values = {
      progress: feedback.progress,
      helpfulness: feedback.helpfulness,
      mostUseful: feedback.mostUseful,
      blocker: feedback.blocker,
      comments: feedback.comments,
      followUpEmail: feedback.followUpEmail,
      followUpConsent: feedback.followUpConsent,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch("starter_kit_feedback", existing._id, {
        ...values,
        submissionCount: existing.submissionCount + 1n,
      });
      return { created: false as const };
    }

    await ctx.db.insert("starter_kit_feedback", {
      respondentKey: feedback.respondentKey,
      ...values,
      submissionCount: 1n,
      createdAt: now,
    });
    return { created: true as const };
  },
});

function emptyCounts<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<
    T,
    number
  >;
}

/**
 * Operator-only by construction: internal functions are absent from the
 * public client API. This intentionally summarizes a bounded recent sample;
 * it never scans an unbounded feedback table or exposes respondent keys.
 */
export const summarizeRecent = internalQuery({
  args: { since: v.number(), limit: v.number() },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.since) || !Number.isFinite(args.limit)) {
      throw new ConvexError({ code: "INVALID_FEEDBACK_SUMMARY_RANGE" });
    }
    const limit = Math.min(Math.max(Math.floor(args.limit), 1), 200);
    const rows = await ctx.db
      .query("starter_kit_feedback")
      .withIndex("by_updatedAt", (q) => q.gte("updatedAt", args.since))
      .order("desc")
      .take(limit + 1);
    const isTruncated = rows.length > limit;
    const sample = rows.slice(0, limit);
    const progress = emptyCounts(STARTER_KIT_PROGRESS_VALUES);
    const mostUseful = emptyCounts(STARTER_KIT_SECTION_VALUES);
    const blockers = emptyCounts(STARTER_KIT_BLOCKER_VALUES);
    let usefulnessTotal = 0;

    for (const row of sample) {
      progress[row.progress] += 1;
      usefulnessTotal += row.helpfulness;
      if (row.mostUseful) mostUseful[row.mostUseful] += 1;
      if (row.blocker) blockers[row.blocker] += 1;
    }

    return {
      since: args.since,
      sampleSize: sample.length,
      isTruncated,
      averageHelpfulness:
        sample.length === 0 ? null : usefulnessTotal / sample.length,
      progress,
      mostUseful,
      blockers,
      followUpOptIns: sample.filter((row) => row.followUpConsent).length,
      recentResponses: sample.slice(0, 25).map((row) => ({
        progress: row.progress,
        helpfulness: row.helpfulness,
        mostUseful: row.mostUseful ?? null,
        blocker: row.blocker ?? null,
        comments: row.comments ?? null,
        followUpEmail: row.followUpEmail ?? null,
        updatedAt: row.updatedAt,
        submissionCount: row.submissionCount,
      })),
    };
  },
});
