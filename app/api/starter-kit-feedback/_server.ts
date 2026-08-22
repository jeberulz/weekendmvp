import { createHmac } from "node:crypto";

type FeedbackEnvironment = Readonly<Record<string, string | undefined>>;

export const MAX_FEEDBACK_BODY_BYTES = 4_096;
export const MIN_FEEDBACK_SECRET_LENGTH = 32;

const PROGRESS_VALUES = new Set([
  "not_started",
  "planning",
  "building",
  "shipped",
  "paused",
]);
const SECTION_VALUES = new Set([
  "rules",
  "scorecard",
  "spec",
  "plan",
  "ideas",
  "prompts",
  "templates",
]);
const BLOCKER_VALUES = new Set([
  "time",
  "scope",
  "technical",
  "audience",
  "motivation",
  "other",
]);
const RESPONDENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]{2,45}$/i;

export type StarterKitFeedbackRequest = {
  respondentId: string;
  progress: string;
  helpfulness: number;
  mostUseful: string | null;
  blocker: string | null;
  comments: string | null;
  followUpEmail: string | null;
  followUpConsent: boolean;
  website: string;
};

export function readFeedbackBridgeSecret(
  environment: FeedbackEnvironment,
): string {
  const secret = environment.STARTER_KIT_FEEDBACK_BRIDGE_SECRET;
  if (!secret || secret.length < MIN_FEEDBACK_SECRET_LENGTH) {
    throw new Error("FEEDBACK_BRIDGE_NOT_CONFIGURED");
  }
  return secret;
}

function optionalEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error("INVALID_FEEDBACK_REQUEST");
  }
  return value;
}

function optionalText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_FEEDBACK_REQUEST");
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > maximum) {
    throw new Error("INVALID_FEEDBACK_REQUEST");
  }
  return normalized;
}

export function parseStarterKitFeedbackRequest(
  value: unknown,
): StarterKitFeedbackRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_FEEDBACK_REQUEST");
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set([
    "respondentId",
    "progress",
    "helpfulness",
    "mostUseful",
    "blocker",
    "comments",
    "followUpEmail",
    "followUpConsent",
    "website",
  ]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    throw new Error("INVALID_FEEDBACK_REQUEST");
  }
  if (
    typeof record.respondentId !== "string" ||
    !RESPONDENT_ID.test(record.respondentId) ||
    typeof record.progress !== "string" ||
    !PROGRESS_VALUES.has(record.progress) ||
    typeof record.helpfulness !== "number" ||
    !Number.isInteger(record.helpfulness) ||
    record.helpfulness < 1 ||
    record.helpfulness > 5 ||
    typeof record.followUpConsent !== "boolean"
  ) {
    throw new Error("INVALID_FEEDBACK_REQUEST");
  }

  const followUpEmail = optionalText(record.followUpEmail, 320)?.toLowerCase() ?? null;
  if (
    (followUpEmail !== null &&
      (!EMAIL.test(followUpEmail) || !record.followUpConsent)) ||
    (record.followUpConsent && followUpEmail === null)
  ) {
    throw new Error("INVALID_FEEDBACK_REQUEST");
  }

  return {
    respondentId: record.respondentId.toLowerCase(),
    progress: record.progress,
    helpfulness: record.helpfulness,
    mostUseful: optionalEnum(record.mostUseful, SECTION_VALUES),
    blocker: optionalEnum(record.blocker, BLOCKER_VALUES),
    comments: optionalText(record.comments, 1_000),
    followUpEmail,
    followUpConsent: record.followUpConsent,
    website: optionalText(record.website, 200) ?? "",
  };
}

export function respondentKey(respondentId: string, bridgeSecret: string) {
  return createHmac("sha256", bridgeSecret)
    .update(`starter-kit-feedback:respondent:${respondentId}`)
    .digest("hex");
}

export function signFeedbackPayload(payload: object, bridgeSecret: string) {
  const serialized = JSON.stringify(payload);
  return {
    payload: serialized,
    signature: createHmac("sha256", bridgeSecret)
      .update(serialized)
      .digest("base64url"),
  };
}

function normalizeIp(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  if (!first) return null;
  if (IPV4.test(first)) {
    return first.split(".").every((part) => Number(part) <= 255) ? first : null;
  }
  if (!IPV6.test(first)) return null;
  const groups = first.toLowerCase().split(":");
  return groups.length > 4 ? `${groups.slice(0, 4).join(":")}::/64` : first.toLowerCase();
}

/** Used only inside the signed bridge payload; never persisted. */
export function feedbackRateLimitKey(headers: Headers): string {
  const trusted = normalizeIp(headers.get("x-vercel-forwarded-for"));
  if (trusted) return `ip:${trusted}`;
  const forwarded = normalizeIp(headers.get("x-forwarded-for"));
  if (forwarded) return `ip:${forwarded}`;
  const realIp = normalizeIp(headers.get("x-real-ip"));
  return realIp ? `ip:${realIp}` : "ip:unknown";
}

export function isAllowedFeedbackOrigin(
  headers: Headers,
  environment: FeedbackEnvironment,
): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;

  const configured = environment.NEXT_PUBLIC_BASE_URL;
  if (configured) {
    try {
      return new URL(origin).origin === new URL(configured).origin;
    } catch {
      return false;
    }
  }

  const host = headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}
