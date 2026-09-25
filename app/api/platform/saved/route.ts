import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { NO_STORE, isSameOriginWrite, parseSaveBody, parseSlugParam } from "./_server";

/**
 * WP44-S6. Save state for the static `/ideas/{slug}` page. The page never
 * reads cookies, so it stays prerendered. Its client island asks here, and
 * this route reads the httpOnly session on the server. Middleware refreshes
 * the session before the route runs, as it does for every matched path.
 */

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

function convexFor(token: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  return client;
}

export async function GET(request: Request) {
  const slug = parseSlugParam(request.url);
  if (slug === null) return json({ code: "INVALID_SLUG" }, 400);
  const token = await convexAuthNextjsToken();
  if (!token) return json({ signedIn: false, saved: false });
  const convex = convexFor(token);
  if (convex === null) return json({ code: "UNAVAILABLE" }, 503);
  try {
    const state = await convex.query(api.platform.dashboard.savedState, { slug });
    // null: published but not in Convex yet, so there is nothing to save.
    return json({ signedIn: true, saved: state === null ? null : state.saved });
  } catch {
    // An expired or revoked session reads as signed out.
    return json({ signedIn: false, saved: false });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginWrite(request)) return json({ code: "FORBIDDEN" }, 403);
  let input: ReturnType<typeof parseSaveBody> = null;
  try {
    input = parseSaveBody(await request.json());
  } catch {
    input = null;
  }
  if (input === null) return json({ code: "INVALID_REQUEST" }, 400);
  const token = await convexAuthNextjsToken();
  if (!token) return json({ code: "AUTHENTICATION_REQUIRED" }, 401);
  const convex = convexFor(token);
  if (convex === null) return json({ code: "UNAVAILABLE" }, 503);
  try {
    const result = await convex.mutation(api.platform.dashboard.setSaved, input);
    return json({ saved: result.saved });
  } catch {
    return json({ code: "UNAVAILABLE" }, 503);
  }
}
