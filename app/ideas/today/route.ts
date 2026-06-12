/**
 * GET /ideas/today — redirect to the most recently published idea
 * (App Router port of api/ideas-today.js + the vercel.json rewrite).
 *
 * The public URL is /ideas/today (used in welcome emails), so this route
 * lives directly under app/ideas/today — NOT under /api. The legacy
 * manifest.json read is replaced by the Convex `api.ideas.latest` query.
 * Any failure (Convex unavailable, no ideas yet) falls back to a 302 to
 * /startup-ideas, matching the legacy fallback.
 */

import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function GET(request: Request) {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      const idea = await convex.query(api.ideas.latest, {});
      if (idea) {
        return NextResponse.redirect(new URL(`/ideas/${idea.slug}`, request.url), 302);
      }
    }
  } catch (error) {
    console.error("Error in ideas-today redirect:", error);
  }

  // Fallback when Convex is unavailable or there are no ideas yet.
  return NextResponse.redirect(new URL("/startup-ideas", request.url), 302);
}
