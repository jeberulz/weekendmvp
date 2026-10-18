import { createHash, timingSafeEqual } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { api } from "@/convex/_generated/api";
import { LIVE_EVENT_KEY } from "@/lib/live/config";
import { LIVE_SEATS_CACHE_TAG } from "@/lib/live/stripe-catalog";
import { signLiveWorkshopEvent } from "@/lib/live/workshop-bridge";
import { readLiveWorkshopBillingConfig } from "../_server";

function bearerMatches(header: string | null, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

/**
 * GET /api/live/reconcile — daily sweep of lapsed workshop seat holds.
 * Auth: `Authorization: Bearer $CRON_SECRET` (same secret as membership reconcile).
 * Does nothing when billing/cron aren't configured.
 */
export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return Response.json({ ok: true, skipped: "not_configured" });
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let config: ReturnType<typeof readLiveWorkshopBillingConfig>;
  try {
    config = readLiveWorkshopBillingConfig(process.env);
  } catch {
    return Response.json({ ok: true, skipped: "not_configured" });
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return Response.json({ ok: true, skipped: "not_configured" });

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const result = await convex.action(
      api.live.workshopBridge.accept,
      signLiveWorkshopEvent(
        {
          kind: "release_expired_holds",
          issuedAt: Date.now(),
          eventKey: LIVE_EVENT_KEY,
        },
        config.bridgeSecret,
      ),
    );
    const released =
      result && typeof result === "object" && "released" in result
        ? Number((result as { released: unknown }).released) || 0
        : 0;
    if (released > 0) revalidateTag(LIVE_SEATS_CACHE_TAG, "max");
    return Response.json({ ok: true, released });
  } catch (error) {
    console.error("live workshop reconcile failed", {
      name: error instanceof Error ? error.name : "Error",
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
