/**
 * Audience and tool chips on idea pages must only link to hubs that exist.
 * Free-text / retired tags stay as plain text so they never mint 404s for
 * Googlebot (GSC 2026-10-24: /ideas-for/pregnant-women et al.).
 */
import { AUDIENCE_SLUGS, TOOL_SLUGS } from "./editorial/contracts/taxonomy";

/** Route-backed /build-with hubs — taxonomy tools plus claude-code. */
const TOOL_HUB_SLUGS: ReadonlySet<string> = new Set([...TOOL_SLUGS, "claude-code"]);

const AUDIENCE_HUB_SLUGS: ReadonlySet<string> = new Set(AUDIENCE_SLUGS);

export function toolHubHref(slug: string): string | null {
  return TOOL_HUB_SLUGS.has(slug) ? `/build-with/${slug}` : null;
}

export function audienceHubHref(slug: string): string | null {
  return AUDIENCE_HUB_SLUGS.has(slug) ? `/ideas-for/${slug}` : null;
}
