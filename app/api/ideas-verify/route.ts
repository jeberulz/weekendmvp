/**
 * POST /api/ideas-verify — verify an email is an active Beehiiv subscriber
 * (App Router port of api/ideas-verify.js). Used by the idea-page gate when a
 * visitor arrives with ?e=<email>. Returns { ok: true } only when Beehiiv
 * reports the subscription with status 'active' or 'validating'. No HMAC —
 * worst-case abuse is a stranger reading a public-ish teardown, which is
 * net-positive for us.
 */

import { beehiivVerify } from "@/lib/beehiiv";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Invalid JSON in request body" });
  }

  const email =
    body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    return json(400, { ok: false, error: "Invalid email" });
  }

  if (!process.env.BEEHIIV_API_KEY) {
    return json(500, { error: "API key not configured" });
  }

  try {
    const status = await beehiivVerify(email);
    const ok = status === "active" || status === "validating";
    return json(200, { ok });
  } catch (error) {
    console.error("Verify error:", error);
    return json(200, { ok: false });
  }
}
