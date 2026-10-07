/**
 * POST /api/revalidate?tag=<tag>
 *
 * Convex → Next.js cache invalidation. Called by the Convex internal action
 * `convex/revalidate.ts` after content upserts (e.g. tags `idea:<slug>`,
 * `ideas`). Requires the shared secret in x-weekendmvp-revalidate-secret;
 * when the env var is unset the endpoint always returns 401 (fail closed).
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

function matchesSecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const suppliedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(suppliedHash, expectedHash);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");
  if (!matchesSecret(
    request.headers.get("x-weekendmvp-revalidate-secret"),
    process.env.REVALIDATE_SECRET,
  )) {
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
