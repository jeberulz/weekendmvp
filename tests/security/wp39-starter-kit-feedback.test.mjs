import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  feedbackRateLimitKey,
  isAllowedFeedbackOrigin,
  parseStarterKitFeedbackRequest,
  readFeedbackBridgeSecret,
  respondentKey,
  signFeedbackPayload,
} from "../../app/api/starter-kit-feedback/_server.ts";

const SECRET = "a-secure-test-only-feedback-bridge-secret-123456";
const RESPONDENT_ID = "61a00412-087e-4522-98d7-89d5d2dffc08";

function valid(overrides = {}) {
  return {
    respondentId: RESPONDENT_ID,
    progress: "building",
    helpfulness: 4,
    mostUseful: "plan",
    blocker: "time",
    comments: "The plan made the weekend manageable.",
    followUpEmail: null,
    followUpConsent: false,
    website: "",
    ...overrides,
  };
}

test("the feedback bridge fails closed and signs the exact payload", () => {
  assert.equal(
    readFeedbackBridgeSecret({ STARTER_KIT_FEEDBACK_BRIDGE_SECRET: SECRET }),
    SECRET,
  );
  assert.throws(() => readFeedbackBridgeSecret({}), /FEEDBACK_BRIDGE_NOT_CONFIGURED/);
  assert.throws(
    () => readFeedbackBridgeSecret({ STARTER_KIT_FEEDBACK_BRIDGE_SECRET: "short" }),
    /FEEDBACK_BRIDGE_NOT_CONFIGURED/,
  );

  const signed = signFeedbackPayload({ progress: "building" }, SECRET);
  assert.equal(
    signed.signature,
    createHmac("sha256", SECRET).update(signed.payload).digest("base64url"),
  );
  assert.ok(!signed.payload.includes(SECRET));
});

test("the persisted respondent key is stable, one-way, and omits the raw UUID", () => {
  const key = respondentKey(RESPONDENT_ID, SECRET);
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, respondentKey(RESPONDENT_ID, SECRET));
  assert.notEqual(key, respondentKey(RESPONDENT_ID, `${SECRET}-other`));
  assert.ok(!key.includes(RESPONDENT_ID));
});

test("request parsing enforces the effectiveness contract", () => {
  const parsed = parseStarterKitFeedbackRequest(
    valid({ followUpEmail: " Founder@Example.com ", followUpConsent: true }),
  );
  assert.equal(parsed.followUpEmail, "founder@example.com");
  assert.equal(parsed.comments, "The plan made the weekend manageable.");

  for (const bad of [
    null,
    [],
    valid({ respondentId: "not-a-uuid" }),
    valid({ progress: "done" }),
    valid({ helpfulness: 0 }),
    valid({ helpfulness: 3.5 }),
    valid({ mostUseful: "unknown" }),
    valid({ blocker: "money" }),
    valid({ comments: "x".repeat(1_001) }),
    valid({ followUpEmail: "founder@example.com", followUpConsent: false }),
    valid({ followUpEmail: null, followUpConsent: true }),
    valid({ rogue: true }),
  ]) {
    assert.throws(
      () => parseStarterKitFeedbackRequest(bad),
      /INVALID_FEEDBACK_REQUEST/,
    );
  }
});

test("rate-limit keys prefer the trusted edge header and collapse invalid input", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.7",
    "x-forwarded-for": "9.9.9.9",
  });
  assert.equal(feedbackRateLimitKey(headers), "ip:203.0.113.7");
  assert.equal(
    feedbackRateLimitKey(new Headers({ "x-forwarded-for": "not-an-ip" })),
    "ip:unknown",
  );
  assert.equal(feedbackRateLimitKey(new Headers()), "ip:unknown");
});

test("browser requests are same-origin", () => {
  assert.equal(
    isAllowedFeedbackOrigin(
      new Headers({ origin: "https://weekendmvp.app", host: "weekendmvp.app" }),
      {},
    ),
    true,
  );
  assert.equal(
    isAllowedFeedbackOrigin(
      new Headers({ origin: "https://attacker.example", host: "weekendmvp.app" }),
      {},
    ),
    false,
  );
  assert.equal(
    isAllowedFeedbackOrigin(
      new Headers({ origin: "https://weekendmvp.app" }),
      { NEXT_PUBLIC_BASE_URL: "https://weekendmvp.app" },
    ),
    true,
  );
});

test("the route consumes quota before writing and never persists the client key", async () => {
  const source = await readFile(
    new URL("../../app/api/starter-kit-feedback/route.ts", import.meta.url),
    "utf8",
  );
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const consume = withoutComments.indexOf("consumeSubmissionQuota");
  const submit = withoutComments.indexOf("submitFromBridge");
  assert.ok(consume >= 0 && submit > consume);

  const convexSource = await readFile(
    new URL("../../convex/marketing/starterKitFeedback.ts", import.meta.url),
    "utf8",
  );
  const schemaSource = await readFile(
    new URL("../../convex/schema.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(schemaSource.match(/starter_kit_feedback:[\s\S]*?stripe_events:/)?.[0] ?? "", /clientKey|ipAddress/);
  assert.match(convexSource, /export const summarizeRecent = internalQuery/);
  assert.doesNotMatch(convexSource, /export const summarizeRecent = query/);
});
