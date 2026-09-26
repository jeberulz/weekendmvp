import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexError } from "convex/values";
import { memberClient } from "@/app/api/platform/_member-client";
import { api } from "@/convex/_generated/api";
import { getIdeaPackContent } from "@/lib/dashboard/idea-prompts";
import { isIdeaSlug } from "@/lib/pending-save";
import { buildPromptPack, isPackFormat } from "@/lib/prompt-pack/build";
import { SITE } from "@/lib/seo";

/**
 * WP44-S11 prompt pack download (Builder's Hub). The entitlement check runs
 * in Convex with the member's own session before anything is built, so a
 * direct request from a Free member gets UPGRADE_REQUIRED, never the files.
 */

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug");
  const format = params.get("format") ?? "all";
  if (!isIdeaSlug(slug) || !isPackFormat(format)) return json({ code: "INVALID_REQUEST" }, 400);

  const token = await convexAuthNextjsToken();
  if (!token) return json({ code: "AUTHENTICATION_REQUIRED" }, 401);
  const convex = memberClient(token);
  if (!convex) return json({ code: "UNAVAILABLE" }, 503);

  let idea;
  try {
    await convex.mutation(api.platform.dashboard.requireMember, {});
    idea = await convex.query(api.platform.promptPack.source, { slug });
  } catch (error) {
    const data = error instanceof ConvexError ? (error.data as { code?: string; feature?: string }) : null;
    if (data?.code === "UPGRADE_REQUIRED") return json({ code: data.code, feature: data.feature }, 403);
    if (data?.code === "RESOURCE_NOT_FOUND") return json({ code: data.code }, 404);
    if (data?.code === "UNAUTHENTICATED") return json({ code: "AUTHENTICATION_REQUIRED" }, 401);
    return json({ code: "UNAVAILABLE" }, 503);
  }

  let content;
  try {
    content = await getIdeaPackContent(slug);
  } catch {
    return json({ code: "UNAVAILABLE" }, 503);
  }
  if (!content) return json({ code: "RESOURCE_NOT_FOUND" }, 404);
  if (content.prompts.length === 0) return json({ code: "PROMPTS_UNAVAILABLE" }, 422);
  const pack = buildPromptPack(
    { slug, title: idea.title, description: idea.description, siteUrl: SITE, ...content },
    format,
  );
  return new Response(pack.body, {
    headers: {
      ...NO_STORE,
      "Content-Type": pack.contentType,
      "Content-Disposition": `attachment; filename="${pack.filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
