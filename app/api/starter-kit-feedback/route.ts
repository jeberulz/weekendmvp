import { isRateLimitError } from "@convex-dev/rate-limiter";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  MAX_FEEDBACK_BODY_BYTES,
  feedbackRateLimitKey,
  isAllowedFeedbackOrigin,
  parseStarterKitFeedbackRequest,
  readFeedbackBridgeSecret,
  respondentKey,
  signFeedbackPayload,
} from "./_server";

function jsonError(status: number, code: string) {
  return Response.json({ ok: false, code }, { status });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE");
  }
  if (!isAllowedFeedbackOrigin(request.headers, process.env)) {
    return jsonError(403, "CROSS_ORIGIN_FORBIDDEN");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FEEDBACK_BODY_BYTES) {
    return jsonError(413, "FEEDBACK_TOO_LARGE");
  }

  let input: ReturnType<typeof parseStarterKitFeedbackRequest>;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_FEEDBACK_BODY_BYTES) {
      return jsonError(413, "FEEDBACK_TOO_LARGE");
    }
    input = parseStarterKitFeedbackRequest(JSON.parse(body));
  } catch {
    return jsonError(400, "INVALID_FEEDBACK_REQUEST");
  }

  // Bots that fill the visually hidden field get a deliberately boring
  // success response. Do not reveal that their submission was discarded.
  if (input.website) return Response.json({ ok: true });

  let bridgeSecret: string;
  try {
    bridgeSecret = readFeedbackBridgeSecret(process.env);
  } catch {
    return jsonError(503, "FEEDBACK_NOT_CONFIGURED");
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return jsonError(503, "FEEDBACK_NOT_CONFIGURED");

  const signed = signFeedbackPayload(
    {
      respondentKey: respondentKey(input.respondentId, bridgeSecret),
      clientKey: feedbackRateLimitKey(request.headers),
      progress: input.progress,
      helpfulness: input.helpfulness,
      mostUseful: input.mostUseful,
      blocker: input.blocker,
      comments: input.comments,
      followUpEmail: input.followUpEmail,
      followUpConsent: input.followUpConsent,
    },
    bridgeSecret,
  );

  try {
    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(
      api.marketing.starterKitFeedback.consumeSubmissionQuota,
      signed,
    );
    await convex.mutation(
      api.marketing.starterKitFeedback.submitFromBridge,
      signed,
    );
    return Response.json({ ok: true });
  } catch (error) {
    if (isRateLimitError(error)) {
      return Response.json(
        { ok: false, code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "retry-after": String(Math.ceil(error.data.retryAfter / 1_000)),
          },
        },
      );
    }
    const code =
      error && typeof error === "object" && "data" in error
        ? ((error.data as { code?: string })?.code ?? "FEEDBACK_FAILED")
        : "FEEDBACK_FAILED";
    if (code === "INVALID_FEEDBACK_PAYLOAD") {
      return jsonError(400, "INVALID_FEEDBACK_REQUEST");
    }
    return jsonError(500, "FEEDBACK_FAILED");
  }
}
