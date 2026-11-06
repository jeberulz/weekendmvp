import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { cacheLife } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

/** The CTA is decoration: a slow backend must never slow the page. */
const CTA_LOOKUP_TIMEOUT_MS = 300;

/**
 * The answer for a request with no session. It is the same for every
 * anonymous visitor, so it is cached for about a minute and most page loads
 * never wait on Convex. A failure throws so it is not cached; the caller
 * reads it as off.
 */
async function anonymousBuildCtaVisible(): Promise<boolean> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });
  return await fetchQuery(api.buildCta.buildCtaVisible, {});
}

/**
 * Whether the public pages show the "Build this idea, free" CTAs to this
 * request (WP74-S5). It reads the same runtime C-OPS flag and cohort the wizard
 * gate reads, through `buildCta:buildCtaVisible`. A signed-in request is
 * asked live with its session (the cohort is per owner); an anonymous one uses
 * the shared 60 s cache.
 *
 * Fails closed: no backend, a token read that fails, a backend error or a
 * 300 ms timeout all answer `false`, and the page renders exactly as it did
 * before the CTAs existed. Callers must be dynamic already (`connection()`
 * first) and should start the call before their own data fetch and await it
 * after, so it runs in parallel. Cached per request. Showing a CTA grants
 * nothing; `/start` re-checks.
 */
export const buildCtaVisible = cache(async (): Promise<boolean> => {
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await convexAuthNextjsToken();
    const lookup = token
      ? fetchQuery(api.buildCta.buildCtaVisible, {}, { token })
      : anonymousBuildCtaVisible();
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), CTA_LOOKUP_TIMEOUT_MS);
    });
    return (await Promise.race([lookup, timeout])) === true;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
});
