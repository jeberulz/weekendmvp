/**
 * Client-side helper for the Beehiiv subscribe endpoint (/api/subscribe).
 *
 * The automation allowlist mirrors api/subscribe.js ALLOWED_AUTOMATIONS —
 * the paid-cohort automation is intentionally absent (server-only via the
 * Stripe webhook). Typing `AllowedAutomationId` as a closed union makes it
 * impossible to instantiate a signup surface with a non-allowlisted
 * automation at compile time.
 */

/** Default/long-running Weekend MVP welcome flow (starter kit). */
export const DEFAULT_AUTOMATION_ID =
  "aut_50201ecc-8641-43dc-811b-313be270594b" as const;

/** Ship.able workshop waitlist. */
export const SHIPABLE_WAITLIST_AUTOMATION_ID =
  "aut_b55c6b1e-330b-4768-b44a-30e9e07ae92a" as const;

export type AllowedAutomationId =
  | typeof DEFAULT_AUTOMATION_ID
  | typeof SHIPABLE_WAITLIST_AUTOMATION_ID;

export type SubscribeParams = {
  email: string;
  firstName?: string;
  automationIds?: AllowedAutomationId[];
  utmCampaign?: string;
};

export type SubscribeResult = {
  ok: boolean;
  message: string;
};

/**
 * POST a subscription to /api/subscribe.
 *
 * Per BEEHIIV_CURSOR_RULES.md, the response is read as text before JSON
 * parsing so HTML error pages and empty bodies do not throw.
 */
export async function subscribeViaApi({
  email,
  firstName,
  automationIds,
  utmCampaign,
}: SubscribeParams): Promise<SubscribeResult> {
  try {
    const response = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        ...(firstName ? { first_name: firstName } : {}),
        ...(automationIds && automationIds.length > 0
          ? { automation_ids: automationIds }
          : {}),
        ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
      }),
    });

    const text = await response.text();
    let data: { error?: string; message?: string } = {};
    try {
      if (text) data = JSON.parse(text) as typeof data;
    } catch {
      data = {};
    }

    if (!response.ok) {
      return {
        ok: false,
        message:
          data.message ||
          data.error ||
          "Unable to process subscription. Please try again later.",
      };
    }

    return { ok: true, message: "Subscribed successfully." };
  } catch {
    return {
      ok: false,
      message: "Network error. Please check your connection and try again.",
    };
  }
}
