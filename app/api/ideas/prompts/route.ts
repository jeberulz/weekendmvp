import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { memberClient, memberErrorCode } from "@/app/api/platform/_member-client";
import { getIdeaPrompts } from "@/lib/dashboard/idea-prompts";
import { isIdeaSlug } from "@/lib/pending-save";

/**
 * WP44-S9. Prompts for a weekend plan. Members only: the public idea page
 * shows the same prompts behind its email gate, and a member has already
 * given an email. Middleware refreshes the session before this runs.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!isIdeaSlug(slug)) {
    return Response.json({ code: "INVALID_SLUG" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const token = await convexAuthNextjsToken();
  if (!token) {
    return Response.json(
      { code: "AUTHENTICATION_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const convex = memberClient(token);
  if (!convex) return Response.json({ code: "UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    // Checks both the signed identity and the current session row. The package
    // isAuthenticated helper alone does not reject a revoked session's JWT.
    await convex.mutation(api.platform.dashboard.requireMember, {});
    const prompts = await getIdeaPrompts(slug, token);
    if (prompts === null) {
      return Response.json({ code: "RESOURCE_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ prompts }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    if (memberErrorCode(error) === "UNAUTHENTICATED") {
      return Response.json({ code: "AUTHENTICATION_REQUIRED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ code: "UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
