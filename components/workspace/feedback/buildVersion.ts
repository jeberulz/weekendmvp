import { sanitizeBuildVersion } from "@/lib/feedback/contracts";

/**
 * The app version attached to feedback and errors: the short commit Vercel
 * builds from (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, inlined at build time), or
 * "dev" outside a Vercel build.
 */
export const BUILD_VERSION = sanitizeBuildVersion((process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 7));
