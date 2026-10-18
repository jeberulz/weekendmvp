import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { LIVE_EVENT_KEY } from "@/lib/live/config";
import { signLiveWorkshopEvent } from "@/lib/live/workshop-bridge";
import {
  LIVE_CHECKOUT_ERROR_STATUS,
  checkoutSessionParams,
  createLiveWorkshopStripe,
  liveCheckoutError,
  readLiveWorkshopBillingConfig,
  resolveCheckoutPrice,
  type OpenedWorkshopOrder,
} from "../_server";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_:-]{16,80}$/;

/**
 * POST /api/live/checkout
 * Auth-gated Checkout Session for the Build-Along. Reserves a workshop_seats
 * row (35m hold), opens a Stripe Payments session (expires ~31m) with
 * automatic_tax + required billing address. Purpose-separated from ship·able
 * Payment Links, membership, and claim/pay.
 *
 * Body: `{ idempotencyKey: string, next?: boolean }`
 * `next: true` buys the optional 5 Dec session once that price exists.
 */
export async function POST(request: Request) {
  const token = await convexAuthNextjsToken();
  if (!token) return liveCheckoutError("AUTHENTICATION_REQUIRED", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return liveCheckoutError("INVALID_REQUEST", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return liveCheckoutError("INVALID_REQUEST", 400);
  }
  const candidate = body as Record<string, unknown>;
  const idempotencyKey =
    typeof candidate.idempotencyKey === "string" ? candidate.idempotencyKey : "";
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return liveCheckoutError("INVALID_REQUEST", 400);
  }
  const forNextSession = candidate.next === true;

  let config: ReturnType<typeof readLiveWorkshopBillingConfig>;
  try {
    config = readLiveWorkshopBillingConfig(process.env);
  } catch {
    return liveCheckoutError("BILLING_UNAVAILABLE");
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return liveCheckoutError("BILLING_UNAVAILABLE");

  const now = Date.now();

  try {
    const stripe = createLiveWorkshopStripe(config);
    const resolved = await resolveCheckoutPrice(stripe, config, now, { forNextSession });
    if (!resolved) return liveCheckoutError("PRICE_NOT_CONFIGURED");

    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);

    const begunRaw = await convex.action(
      api.live.workshopBridge.accept,
      signLiveWorkshopEvent(
        {
          kind: "begin_checkout",
          eventKey: LIVE_EVENT_KEY,
          lookupKey: resolved.lookupKey,
          idempotencyKey,
          livemode: config.livemode,
        },
        config.bridgeSecret,
      ),
    );

    type BeginOk = {
      ok: true;
      orderId: string;
      seatNumber: number;
      sessionExpiresAt: number;
      email: string;
      checkoutSessionId?: string;
    };
    type BeginFail = { ok: false; code: string };
    const begun = begunRaw as BeginOk | BeginFail | null;

    if (!begun || typeof begun !== "object" || !("ok" in begun)) {
      return liveCheckoutError("BILLING_UNAVAILABLE");
    }
    if (!begun.ok) {
      const code = typeof begun.code === "string" ? begun.code : "BILLING_UNAVAILABLE";
      return liveCheckoutError(code, LIVE_CHECKOUT_ERROR_STATUS[code] ?? 503);
    }

    const order: OpenedWorkshopOrder = {
      orderId: String(begun.orderId),
      seatNumber: begun.seatNumber,
      sessionExpiresAt: begun.sessionExpiresAt,
      email: begun.email,
      checkoutSessionId: begun.checkoutSessionId,
    };

    const session = await stripe.checkout.sessions.create(
      checkoutSessionParams(config, order, resolved.priceId, resolved.priceKey, resolved.lookupKey),
      { idempotencyKey: `live-workshop:${order.orderId}:${idempotencyKey}` },
    );
    if (!session.url || !session.id) return liveCheckoutError("BILLING_UNAVAILABLE");

    const sessionPrefix = config.livemode ? "cs_live_" : "cs_test_";
    if (!session.id.startsWith(sessionPrefix)) return liveCheckoutError("BILLING_UNAVAILABLE");
    if (new URL(session.url).hostname !== "checkout.stripe.com") {
      return liveCheckoutError("BILLING_UNAVAILABLE");
    }

    if (order.checkoutSessionId !== session.id) {
      await convex.action(
        api.live.workshopBridge.accept,
        signLiveWorkshopEvent(
          {
            kind: "attach_session",
            orderId: order.orderId,
            checkoutSessionId: session.id,
            priceId: resolved.priceId,
          },
          config.bridgeSecret,
        ),
      );
      if (order.checkoutSessionId) {
        await Promise.allSettled([stripe.checkout.sessions.expire(order.checkoutSessionId)]);
      }
    }

    return Response.json({ ok: true, url: session.url });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
    console.error("live workshop checkout failed", {
      name: error instanceof Error ? error.name : "Error",
      code,
    });
    return liveCheckoutError("BILLING_UNAVAILABLE");
  }
}
