import { BUILD_ALONG } from "@/lib/live/config";

/**
 * Display price for the sprint cards. Tied to the live standard ticket, not a one-off string.
 * Kept out of `guide.spec.ts` so plain Node can load the spec (`config.ts` uses the `@/` alias).
 */
export const BUILD_ALONG_PRICE = `$${BUILD_ALONG.standardUsd}`;
