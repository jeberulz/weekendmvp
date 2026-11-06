import { createClient } from "@vercel/global-config";

/** Per-slug keys avoid lost updates when two takedowns happen at once. */
export const TENANT_TAKEDOWN_READY_KEY = "tenant_takedown_ready";
export const tenantTakedownKey = (slug: string) => `tenant_takedown_${slug}`;

export type TenantTakedownState = "blocked" | "clear" | "unavailable";

/**
 * The denylist is authoritative even when Convex is unreachable. An absent or
 * unreadable Global Config refuses tenant traffic rather than risking a
 * taken-down page being served through the Convex fail-open path.
 */
export async function tenantTakedownState(slug: string): Promise<TenantTakedownState> {
  const connection = process.env.TENANT_GLOBAL_CONFIG;
  if (!connection) return "unavailable";

  try {
    const client = createClient(connection, {
      staleIfError: false,
      disableDevelopmentCache: true,
      cache: "no-store",
    });
    const [ready, entry] = await Promise.all([
      client.get(TENANT_TAKEDOWN_READY_KEY),
      client.get(tenantTakedownKey(slug)),
    ]);
    if (ready !== true) return "unavailable";
    if (entry === undefined) return "clear";
    return entry === true ? "blocked" : "unavailable";
  } catch {
    return "unavailable";
  }
}
