/**
 * Server-only Beehiiv API helper.
 *
 * Do NOT import this from client components — it reads `BEEHIIV_API_KEY`.
 * (The client-side fetch wrapper lives in `lib/beehiiv-client.ts`.)
 *
 * Conventions per BEEHIIV_CURSOR_RULES.md:
 * - `form_id` goes in the request BODY, never the URL.
 * - Responses are ALWAYS read as text first, then `JSON.parse` is attempted,
 *   so empty bodies / HTML error pages never throw "Unexpected end of JSON".
 * - HTTP 409 ("already subscribed") is treated as success — re-enrolling an
 *   existing subscriber is a no-op in Beehiiv.
 */

const BEEHIIV_API_BASE = "https://api.beehiiv.com/v2";

export type BeehiivSubscribeParams = {
  email: string;
  firstName?: string;
  automationIds: string[];
  formId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referringSite?: string;
};

export type BeehiivSubscribeResult = {
  /** Raw HTTP status from the Beehiiv API. */
  status: number;
  /** True for 2xx and for 409 (already subscribed). */
  ok: boolean;
  /** Parsed JSON body when parseable; `{ raw: text }` otherwise. */
  data?: Record<string, unknown>;
};

function getPublicationId(): string {
  const id = process.env.BEEHIIV_PUBLICATION_ID;
  if (!id) throw new Error("BEEHIIV_PUBLICATION_ID not configured");
  return id;
}

function getApiKey(): string {
  const key = process.env.BEEHIIV_API_KEY;
  if (!key) throw new Error("BEEHIIV_API_KEY not configured");
  return key;
}

/** Read a Beehiiv response as text first, then attempt JSON.parse. */
async function parseBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

/**
 * POST a subscription to Beehiiv. Optionally routes into automations and a
 * form, mirroring the legacy `api/subscribe.js` / `api/ideas-subscribe.js` /
 * `api/stripe-webhook.js` request bodies.
 */
export async function beehiivSubscribe(
  params: BeehiivSubscribeParams,
): Promise<BeehiivSubscribeResult> {
  const endpoint = `${BEEHIIV_API_BASE}/publications/${getPublicationId()}/subscriptions`;

  const body: Record<string, unknown> = {
    email: params.email,
    reactivate_existing: true,
    send_welcome_email: false,
    automation_ids: params.automationIds,
    custom_fields: params.firstName
      ? [{ name: "first_name", value: params.firstName }]
      : [],
  };
  if (params.formId) body.form_id = params.formId;
  if (params.utmSource) body.utm_source = params.utmSource;
  if (params.utmMedium) body.utm_medium = params.utmMedium;
  if (params.utmCampaign) body.utm_campaign = params.utmCampaign;
  if (params.referringSite) body.referring_site = params.referringSite;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await parseBody(response);

  // 409 = already subscribed — a success for every caller we have.
  const ok = response.ok || response.status === 409;
  return { status: response.status, ok, data };
}

/**
 * Look up a subscriber by email. Returns the Beehiiv subscription status
 * string ('active', 'validating', 'pending', ...) or null when the email is
 * not subscribed / the lookup fails. Network errors propagate to the caller.
 */
export async function beehiivVerify(email: string): Promise<string | null> {
  const endpoint = `${BEEHIIV_API_BASE}/publications/${getPublicationId()}/subscriptions/by_email/${encodeURIComponent(email)}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404) return null;

  const data = await parseBody(response);

  if (!response.ok) {
    console.error("Beehiiv verify error", { status: response.status, body: data });
    return null;
  }

  const subscription = data.data as { status?: unknown } | undefined;
  return typeof subscription?.status === "string" ? subscription.status : null;
}
