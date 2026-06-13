/**
 * POST /api/revalidate?tag=<tag>&secret=<REVALIDATE_SECRET>
 *
 * Convex → Next.js cache invalidation. Called by the Convex internal action
 * `convex/revalidate.ts` after content upserts (e.g. tags `idea:<slug>`,
 * `ideas`). Requires REVALIDATE_SECRET to match; when the env var is unset
 * the endpoint always returns 401 (fail closed).
 */

import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");
  const secret = searchParams.get("secret");

  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || !secret || secret !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!tag) {
    return Response.json({ error: "Missing tag" }, { status: 400 });
  }

  // Next 16 Cache Components signature: revalidateTag(tag, profile).
  // 'max' expires the tag immediately for all readers.
  revalidateTag(tag, "max");

  return Response.json({ revalidated: true, tag });
}
