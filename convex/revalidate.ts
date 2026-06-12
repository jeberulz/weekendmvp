import { v } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * Internal action that asks the Next.js app to revalidate cache tags.
 *
 * Scheduled (runAfter(0)) from the content upsert mutations in ideas.ts,
 * articles.ts, and newsletter.ts. POSTs to
 * `${SITE_URL}/api/revalidate?tag=<tag>&secret=<REVALIDATE_SECRET>` for each
 * tag.
 *
 * Failure policy: revalidation must never fail the originating mutation, so
 * every fetch is wrapped in try/catch and errors are only logged. If
 * REVALIDATE_SECRET is unset (e.g. local dev), the action no-ops.
 */
export const run = internalAction({
  args: { tags: v.array(v.string()) },
  returns: v.null(),
  handler: async (_ctx, { tags }) => {
    const secret = process.env.REVALIDATE_SECRET;
    if (!secret) {
      // No secret configured — nothing to do (local dev / preview).
      return null;
    }
    const base = process.env.SITE_URL ?? "https://weekendmvp.app";
    for (const tag of tags) {
      const url = `${base}/api/revalidate?tag=${encodeURIComponent(tag)}&secret=${encodeURIComponent(secret)}`;
      try {
        const res = await fetch(url, { method: "POST" });
        if (!res.ok) {
          console.warn(`revalidate: ${tag} -> HTTP ${res.status}`);
        }
      } catch (err) {
        console.warn(`revalidate: ${tag} failed`, err);
      }
    }
    return null;
  },
});
