import { isValidTenantSlug } from "../../../lib/tenant-host";

export type CockpitSite = {
  status: string;
  hostname?: string;
  publishable: boolean;
  live: boolean;
};

export type PublishControl =
  | { kind: "hidden" }
  | { kind: "blocked"; reason: string }
  | { kind: "ready" }
  | {
      kind: "live";
      hostname: string;
      url: string;
    };

export function tenantHttpsUrl(hostname: string): string {
  return `https://${hostname}`;
}

export function suggestedTenantSlug(sourceSlug: string | undefined): string {
  if (!sourceSlug) return "";
  const slug = sourceSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return isValidTenantSlug(slug) ? slug : "";
}

export function ideaHref(sourceSlug: string | undefined): string | null {
  return sourceSlug ? `/ideas/${sourceSlug}` : null;
}

export function tenantUrlFromSite(site: CockpitSite | null): string | null {
  if (!site?.hostname) return null;
  return tenantHttpsUrl(site.hostname);
}

export function publishControl(args: {
  source: "repository_idea" | "own_idea";
  site: CockpitSite | null;
}): PublishControl {
  if (args.source !== "repository_idea") return { kind: "hidden" };
  if (args.site === null) {
    return {
      kind: "blocked",
      reason: "This project has no site to publish yet. Claim a preview first.",
    };
  }
  if (args.site.live && args.site.hostname) {
    return {
      kind: "live",
      hostname: args.site.hostname,
      url: tenantHttpsUrl(args.site.hostname),
    };
  }
  if (!args.site.publishable) {
    return {
      kind: "blocked",
      reason: "This project cannot be published yet. There is no site content.",
    };
  }
  return { kind: "ready" };
}

export function slugFieldError(slug: string): string | null {
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.length === 0) return "Enter a subdomain to publish.";
  if (!isValidTenantSlug(trimmed)) {
    return "Use 3–63 lowercase letters, numbers, or hyphens. Reserved names are not allowed.";
  }
  return null;
}

export function publishErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("SITE_SLUG_UNAVAILABLE")) {
    return "That address is not available. Try a different subdomain.";
  }
  if (message.includes("SITE_NOT_PUBLISHABLE")) {
    return "This project cannot be published yet.";
  }
  if (
    message.includes("RESOURCE_NOT_FOUND") ||
    message.includes("UNAUTHENTICATED")
  ) {
    return "This project is no longer available. Return to projects and choose another.";
  }
  return "Publish failed. Refresh and try again. Nothing was taken live.";
}
