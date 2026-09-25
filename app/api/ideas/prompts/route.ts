import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
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
  if (!(await convexAuthNextjsToken())) {
    return Response.json(
      { code: "AUTHENTICATION_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const prompts = await getIdeaPrompts(slug);
  return Response.json({ prompts }, { headers: { "Cache-Control": "private, max-age=300" } });
}
