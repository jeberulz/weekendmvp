/**
 * POST /api/ideas-subscribe — Startup Ideas email capture (App Router port of
 * api/ideas-subscribe.js). Same Beehiiv integration as /api/subscribe with
 * different UTM tracking (startup-ideas / website / daily-ideas) and the
 * daily-ideas automation. HTTP 409 from Beehiiv ("already subscribed") is a
 * success.
 *
 * Header quirks from the legacy handler are preserved intentionally: only the
 * preflight, the invalid-JSON error, the Beehiiv-error response, and the
 * success responses carry `Access-Control-Allow-Origin: *`.
 */

import { after } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { beehiivSubscribe } from "@/lib/beehiiv";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch (e) {
      console.error("Error parsing request body:", e);
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const email = typeof body.email === "string" ? body.email : "";
    const firstName = typeof body.first_name === "string" ? body.first_name : "";

    // Validate required fields
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const AUTOMATION_ID = process.env.BEEHIIV_IDEAS_AUTOMATION_ID ?? "";

    if (!process.env.BEEHIIV_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const automationIds = [AUTOMATION_ID];
    const result = await beehiivSubscribe({
      email,
      firstName: firstName || "Friend",
      automationIds,
      utmSource: "startup-ideas",
      utmMedium: "website",
      utmCampaign: "daily-ideas",
    });

    const data = result.data ?? {};
    const dataMessage = typeof data.message === "string" ? data.message : undefined;
    const alreadySubscribed =
      result.status === 409 || (dataMessage !== undefined && dataMessage.includes("already"));

    if (!result.ok && !alreadySubscribed) {
      console.error("Beehiiv API Error:", {
        status: result.status,
        response: data,
        email,
      });

      return new Response(JSON.stringify({ error: dataMessage || "Failed to subscribe" }), {
        status: result.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Fire-and-forget event log to Convex — never affects the user response;
    // skipped silently when NEXT_PUBLIC_CONVEX_URL is unset.
    after(async () => {
      try {
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!convexUrl) return;
        const convex = new ConvexHttpClient(convexUrl);
        await convex.mutation(api.subscriptions.record, {
          email,
          source: "idea-page",
          automationIds,
          utm: { campaign: "daily-ideas", source: "startup-ideas", medium: "website" },
          beehiivStatus: String(result.status),
        });
      } catch (error) {
        console.error("Convex subscriptions.record failed:", error);
      }
    });

    // Success (including already-subscribed)
    return new Response(
      JSON.stringify({
        success: true,
        message: alreadySubscribed ? "Already subscribed" : "Successfully subscribed",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Subscription error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
