/**
 * POST /api/subscribe — Beehiiv enrollment (App Router port of api/subscribe.js).
 *
 * Default behavior (no body overrides) enrolls subscribers in the
 * "Weeekend MVP" / starter-kit automation, preserving the existing
 * flow used by the newsletter, 404 page, idea pages, etc.
 *
 * Pages can pass an explicit { automation_ids, utm_campaign } in the
 * JSON body to route the subscriber into a different live automation,
 * e.g. the ship·able workshop waitlist. Only automation IDs on the
 * ALLOWED_AUTOMATIONS allowlist are honored; anything else falls back
 * to the default automation so this endpoint cannot be abused to enroll
 * emails into arbitrary flows.
 *
 * On Beehiiv success, the event is also logged to Convex
 * (api.subscriptions.record) fire-and-forget — Beehiiv is the source of
 * truth for enrollment; a Convex failure never affects the user response.
 */

import { after } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { beehiivSubscribe } from "@/lib/beehiiv";

const DEFAULT_UTM_CAMPAIGN = "starter-kit";

const ALLOWED_UTM_CAMPAIGNS = new Set([
  DEFAULT_UTM_CAMPAIGN,
  "shipable-workshop",
  "newsletter",
  "idea-page",
  "404-page",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const isAllowed =
    !!origin &&
    (origin.endsWith(".vercel.app") ||
      origin.endsWith("weekendmvp.app") ||
      origin.startsWith("http://localhost:"));

  return {
    "Access-Control-Allow-Origin":
      isAllowed && origin ? origin : "https://weekendmvp.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(
  status: number,
  body: unknown,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON in request body" }, cors);
  }

  const email = body.email;
  const firstName = typeof body.first_name === "string" ? body.first_name : undefined;

  if (!email) {
    return json(400, { error: "Email is required" }, cors);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== "string" || !emailRegex.test(email)) {
    return json(400, { error: "Invalid email format" }, cors);
  }

  if (firstName && firstName.length > 50) {
    return json(400, { error: "Name too long" }, cors);
  }

  // Default form + automation = the long-running Weekend MVP welcome flow.
  const DEFAULT_FORM_ID = process.env.BEEHIIV_DEFAULT_FORM_ID ?? "";
  const DEFAULT_AUTOMATION_ID = process.env.BEEHIIV_DEFAULT_AUTOMATION_ID ?? "";

  // Allowlist of automations a caller may enroll into via this endpoint.
  // The paid cohort (BEEHIIV_PAID_AUTOMATION_ID) is intentionally NOT here —
  // that is server-only via the Stripe webhook so a malicious caller cannot
  // mark themselves "paid".
  const ALLOWED_AUTOMATIONS = new Set(
    [
      DEFAULT_AUTOMATION_ID,
      process.env.BEEHIIV_SHIPABLE_AUTOMATION_ID ?? "", // Ship.able Workshop (waitlist)
    ].filter(Boolean),
  );

  // Honor explicit automation routing if the caller provides allowed IDs.
  let automationIds = [DEFAULT_AUTOMATION_ID];
  if (Array.isArray(body.automation_ids) && body.automation_ids.length > 0) {
    const filtered = body.automation_ids.filter(
      (id): id is string => typeof id === "string" && ALLOWED_AUTOMATIONS.has(id),
    );
    if (filtered.length > 0) automationIds = filtered;
  }

  // Pages may also override the UTM campaign (allowlisted) and form ID.
  const utmCampaign =
    typeof body.utm_campaign === "string" && ALLOWED_UTM_CAMPAIGNS.has(body.utm_campaign)
      ? body.utm_campaign
      : DEFAULT_UTM_CAMPAIGN;
  const formId =
    typeof body.form_id === "string" && body.form_id.length === DEFAULT_FORM_ID.length
      ? body.form_id
      : DEFAULT_FORM_ID;

  if (!process.env.BEEHIIV_API_KEY) {
    return json(500, { error: "BEEHIIV_API_KEY not configured" }, cors);
  }

  const utmSource =
    (typeof body.utm_source === "string" && body.utm_source) || "weekendmvp";
  const utmMedium =
    (typeof body.utm_medium === "string" && body.utm_medium) || "website";

  try {
    const result = await beehiivSubscribe({
      email,
      firstName,
      automationIds,
      formId,
      utmSource,
      utmMedium,
      utmCampaign,
    });

    if (!result.ok) {
      console.error("Beehiiv API error:", { status: result.status, data: result.data });
      return json(
        result.status,
        {
          error: "Subscription failed",
          message: "Unable to process subscription. Please try again later.",
        },
        cors,
      );
    }

    // Fire-and-forget event log to Convex. NEVER let a Convex failure (or a
    // missing NEXT_PUBLIC_CONVEX_URL in local static dev) affect the response.
    after(async () => {
      try {
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!convexUrl) return;
        const convex = new ConvexHttpClient(convexUrl);
        await convex.mutation(api.subscriptions.record, {
          email,
          source: "subscribe",
          automationIds,
          utm: { campaign: utmCampaign, source: utmSource, medium: utmMedium },
          beehiivStatus: String(result.status),
        });
      } catch (error) {
        console.error("Convex subscriptions.record failed:", error);
      }
    });

    return json(
      200,
      {
        success: true,
        data: result.data ?? {},
        routed_to: { automation_ids: automationIds, utm_campaign: utmCampaign },
      },
      cors,
    );
  } catch (error) {
    console.error("Internal server error:", error);
    return json(500, { error: "Internal server error" }, cors);
  }
}
