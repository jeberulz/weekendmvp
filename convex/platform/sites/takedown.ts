"use node";

import { createClient } from "@vercel/global-config";
import { ConvexError, v } from "convex/values";
import { classifyHost } from "../../../lib/tenant-host";
import { tenantTakedownKey } from "../../../lib/tenant-takedown";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";

/**
 * The single public takedown entry point. Internal state writes cannot be
 * called by clients. The Global Config write is deliberately before the
 * Convex commit; a failed commit leaves a safe deny entry for retry.
 */
export const takeDown = action({
  args: { siteConfigId: v.id("site_configs"), reason: v.string() },
  returns: v.object({ changed: v.boolean() }),
  handler: async (ctx, args): Promise<{ changed: boolean }> => {
    const prepared = await ctx.runMutation(internal.platform.sites.takedownState.prepare, args);
    const hostname = prepared.hostname;
    const host = classifyHost(hostname);
    if (host.kind !== "tenant") {
      throw new ConvexError({ code: "INVALID_TENANT_HOST" });
    }

    const id = process.env.TENANT_GLOBAL_CONFIG_ID;
    const token = process.env.TENANT_GLOBAL_CONFIG_WRITE_TOKEN;
    const connection = process.env.TENANT_GLOBAL_CONFIG;
    if (!id || !token || !connection || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      throw new ConvexError({ code: "TAKEDOWN_DENYLIST_UNAVAILABLE" });
    }
    const key = tenantTakedownKey(host.slug);
    const url = new URL(`/v1/edge-config/${id}/items`, "https://api.vercel.com");
    if (process.env.TENANT_GLOBAL_CONFIG_TEAM_ID) {
      url.searchParams.set("teamId", process.env.TENANT_GLOBAL_CONFIG_TEAM_ID);
    }
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ items: [{ operation: "upsert", key, value: true }] }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error("Global Config write refused");
      const client = createClient(connection, {
        staleIfError: false,
        disableDevelopmentCache: true,
        cache: "no-store",
      });
      if (await client.get(key, { consistentRead: true }) !== true) {
        throw new Error("Global Config deny entry not visible yet");
      }
    } catch {
      // An accepted but unverified write may have left an extra deny entry.
      // Retrying this idempotent upsert is safe; a false success is not.
      throw new ConvexError({ code: "TAKEDOWN_DENYLIST_UNAVAILABLE" });
    }

    return await ctx.runMutation(internal.platform.sites.takedownState.commit, {
      ...args,
      expectedHostname: hostname,
    });
  },
});
