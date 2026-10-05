/**
 * The release worker normally verifies the canonical production reader. A
 * cloud restore drill can instead use one immutable, protected Vercel build,
 * but only from a non-serving Convex deployment with an exact backend match.
 */
const PRODUCTION_CONVEX_URL = "https://first-squirrel-244.eu-west-1.convex.cloud";
const CANONICAL_HOST = "www.weekendmvp.app";
const STAGING_DEPLOYMENT_HOST = /^weekendmvp-[a-z0-9]{8,}-john-iseghohis-projects\.vercel\.app$/u;

export type ReaderTarget = {
  site: URL;
  headers: Record<string, string>;
  expectedBackend: string | null;
};

export function matchesReaderHealth(body: unknown, commit: string, target: ReaderTarget): boolean {
  if (!body || typeof body !== "object") return false;
  const health = body as Record<string, unknown>;
  return health.protocol === 1 && health.commit === commit &&
    (target.expectedBackend === null || health.backend === target.expectedBackend);
}

export function readerTarget(env: Record<string, string | undefined>): ReaderTarget {
  if (!env.EDITORIAL_PUBLIC_SITE_URL) throw new Error("EDITORIAL_PUBLIC_SITE_URL is missing.");
  const site = new URL(env.EDITORIAL_PUBLIC_SITE_URL);
  if (site.username || site.password || site.search || site.hash || site.pathname !== "/") {
    throw new Error("Editorial public site must be a bare origin.");
  }

  const local = site.protocol === "http:" && ["localhost", "127.0.0.1"].includes(site.hostname);
  const canonical = site.protocol === "https:" && !site.port && site.hostname === CANONICAL_HOST;
  if (local || canonical) {
    if (env.EDITORIAL_STAGING_BACKEND_URL || env.EDITORIAL_STAGING_BYPASS_SECRET) {
      throw new Error("Staging reader configuration requires an immutable staging deployment URL.");
    }
    return { site, headers: {}, expectedBackend: null };
  }

  if (site.protocol !== "https:" || site.port || !STAGING_DEPLOYMENT_HOST.test(site.hostname)) {
    throw new Error("Editorial public site must be the canonical HTTPS host, local loopback, or an approved staging deployment.");
  }
  const backend = env.CONVEX_CLOUD_URL;
  if (!backend || backend === PRODUCTION_CONVEX_URL || env.EDITORIAL_STAGING_BACKEND_URL !== backend) {
    throw new Error("Staging reader requires the exact non-serving Convex backend URL.");
  }
  const bypass = env.EDITORIAL_STAGING_BYPASS_SECRET;
  if (!bypass || bypass.trim() !== bypass) {
    throw new Error("Staging reader requires a protected-deployment bypass secret.");
  }
  return {
    site,
    headers: { "x-vercel-protection-bypass": bypass },
    expectedBackend: backend,
  };
}
