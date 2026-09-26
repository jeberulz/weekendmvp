import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexError } from "convex/values";
import { memberClient, memberErrorCode } from "../_member-client";
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

export async function GET(request: Request) {
  const slug = parseSlugParam(request.url);
  if (slug === null) return json({ code: "INVALID_SLUG" }, 400);
  const token = await convexAuthNextjsToken();
  if (!token) return json({ signedIn: false, saved: false });
  const convex = memberClient(token);
  if (convex === null) return json({ code: "UNAVAILABLE" }, 503);
  try {
    const state = await convex.query(api.platform.dashboard.savedState, { slug });
    // null: published but not in Convex yet, so there is nothing to save.
    return json({ signedIn: true, saved: state === null ? null : state.saved, version: state?.version ?? 0 });
  } catch (error) {
    // Only a verified auth rejection means signed out. An outage must not
    // erase the member's Save state or send them back through signup.
    const code = memberErrorCode(error);
    if (code === "UNAUTHENTICATED") return json({ signedIn: false, saved: false });
    return json({ code: "UNAVAILABLE" }, 503);
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
  const convex = memberClient(token);
  if (convex === null) return json({ code: "UNAVAILABLE" }, 503);
  try {
    const result = await convex.mutation(api.platform.dashboard.setSaved, input);
    return json({ saved: result.saved, version: result.version });
  } catch (error) {
    // A revoked session must read as signed out, so the island offers sign-up.
    const code = memberErrorCode(error);
    if (code === "SAVE_CONFLICT" && error instanceof ConvexError) {
      const data = error.data as { saved: boolean; version: number };
      return json({ code, saved: data.saved, version: data.version }, 409);
    }
    if (code === "UNAUTHENTICATED") return json({ code: "AUTHENTICATION_REQUIRED" }, 401);
    if (code === "RESOURCE_NOT_FOUND") return json({ code: "RESOURCE_NOT_FOUND" }, 404);
    return json({ code: "UNAVAILABLE" }, 503);
  }
}
