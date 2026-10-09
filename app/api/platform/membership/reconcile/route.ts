import { createHash, timingSafeEqual } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { connection } from "next/server";
import { api } from "@/convex/_generated/api";
import type { SubscriptionSnapshot } from "@/convex/platform/membership/events";
import { signMembershipBridge, type MembershipBridgePayload } from "@/lib/membership-bridge";
import { errorSummary, performFollowUps, subscriptionSnapshot } from "../_events";
import { createMembershipStripe, readMembershipWebhookConfig } from "../_server";
import { MEMBERSHIP_BILLING_PURPOSE } from "@/convex/platform/membership/validators";

/** The most subscriptions one run compares. Same cap as Convex (`RECONCILE_CAP`). */
export const RECONCILE_LIMIT = 1_000;
/** Stripe statuses that bill and keep access. */
const STRIPE_RUNNING = ["active", "past_due"] as const;

function bearerMatches(header: string | null, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

/**
 * WP64-S4. GET /api/platform/membership/reconcile, run daily by the Vercel
 * cron (`vercel.json`), which sends `Authorization: Bearer $CRON_SECRET`.
 * Pushes a fresh snapshot of every membership subscription Stripe runs,
 * re-reads any we think runs that Stripe no longer lists, and frees lapsed
 * seat holds. Bounded, idempotent and safe to run twice: snapshots only move
 * forward and follow-ups check Stripe before acting.
 *
 * Does nothing until `CRON_SECRET` and the webhook configuration are set, so
 * the dormant production deploy answers 200 without touching Stripe.
 */
export async function GET(request: Request) {
  // Never prerendered: a build without CRON_SECRET would otherwise bake in "skipped"
  // and the cron would keep reading it after the secret is set.
  await connection();
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return Response.json({ ok: true, skipped: "not_configured" });
  if (!bearerMatches(request.headers.get("authorization"), secret)) return Response.json({ ok: false }, { status: 401 });

  let config: ReturnType<typeof readMembershipWebhookConfig>;
  try {
    config = readMembershipWebhookConfig(process.env);
  } catch {
    return Response.json({ ok: true, skipped: "not_configured" });
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return Response.json({ ok: true, skipped: "not_configured" });

  const stripe = createMembershipStripe(config);
  const convex = new ConvexHttpClient(convexUrl);
  const send = (payload: MembershipBridgePayload) =>
    convex.action(api.platform.membership.provider.accept, signMembershipBridge(payload, config.bridgeSecret));
  const problems = { failed: 0, refused: 0 };
  // One subscription's trouble never stops the rest of the run.
  const push = async (subscription: SubscriptionSnapshot) => {
    try {
      const result = await send({ kind: "subscription_snapshot", issuedAt: Date.now(), livemode: config.livemode, subscription });
      if (!("actions" in result)) throw new Error("UNEXPECTED_BRIDGE_RESULT");
      const followed = await performFollowUps(stripe, result.actions);
      problems.refused += followed.skipped.length;
      problems.failed += followed.failed.length;
    } catch {
      problems.failed += 1;
    }
  };

  try {
    const released = await send({ kind: "release_expired_holds", issuedAt: Date.now() });

    const seen = new Set<string>();
    let capped = false;
    const subscriptionPrices = Object.entries(config.priceKeys)
      .filter(([, priceKey]) => priceKey === "monthly" || priceKey === "annual")
      .map(([priceId]) => priceId);
    scan: for (const price of subscriptionPrices) {
      for (const status of STRIPE_RUNNING) {
        // Stamped before the list is read, so a list item never outranks a fresher webhook.
        const listedAt = Date.now();
        for await (const subscription of stripe.subscriptions.list({ price, status, limit: 100 })) {
          if (seen.size >= RECONCILE_LIMIT) {
            capped = true;
            break scan;
          }
          if (subscription.metadata?.purpose !== MEMBERSHIP_BILLING_PURPOSE || seen.has(subscription.id)) continue;
          seen.add(subscription.id);
          await push(subscriptionSnapshot(subscription, config.priceKeys, listedAt));
        }
      }
    }

    // Ours says running, Stripe no longer lists it: read it once and settle what it is now.
    const running = await send({ kind: "running_subscriptions", issuedAt: Date.now(), livemode: config.livemode });
    if (!("ids" in running)) throw new Error("UNEXPECTED_BRIDGE_RESULT");
    let refreshed = 0;
    // Skipped when the Stripe scan was capped: an unscanned subscription is not a stopped one.
    for (const id of capped ? [] : running.ids.filter((id) => !seen.has(id))) {
      try {
        const subscription = await stripe.subscriptions.retrieve(id);
        if (subscription.metadata?.purpose !== MEMBERSHIP_BILLING_PURPOSE) continue;
        await push(subscriptionSnapshot(subscription, config.priceKeys, Date.now()));
        refreshed += 1;
      } catch {
        problems.failed += 1;
      }
    }

    const summary = {
      released: "released" in released ? released.released : 0,
      pushed: seen.size,
      refreshed,
      capped: capped || running.capped,
      refused: problems.refused,
      failed: problems.failed,
    };
    // Partial failures still finish the run, then answer 500 so the cron shows them.
    if (problems.failed > 0 || problems.refused > 0) console.error("membership reconcile incomplete", summary);
    return Response.json({ ok: problems.failed === 0, ...summary }, { status: problems.failed === 0 ? 200 : 500 });
  } catch (error) {
    console.error("membership reconcile failed", errorSummary(error));
    return Response.json({ ok: false }, { status: 500 });
  }
}
