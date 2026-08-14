import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action, internalQuery } from "../../_generated/server";
import { resolveCapability } from "./capabilities";
import { serializeSiteRenderSpec } from "./renderSpec";

/**
 * WP27-S4. The read path behind `/preview/{token}`.
 *
 * Split into an action plus an internal query for one reason: the clock.
 *
 * The Convex guidelines forbid reading the wall clock inside a query —
 * queries are not rerun as time advances, so a `Date.now()` there goes stale
 * and poisons the query cache. The obvious fix, accepting `now` as an
 * argument to a *public* query, is worse: expiry is the entire authorization
 * boundary for an anonymous capability, so a caller who supplies `now`
 * chooses their own expiry and can revive a preview they held a week ago by
 * calling Convex directly with `now: 0`.
 *
 * Reading the clock in an action and passing it to an `internalQuery`
 * satisfies both. `Date.now()` is explicitly fine in actions, and the query
 * that trusts `now` is not callable from outside the deployment.
 */

/**
 * Written out rather than inferred. `view` calls a function in its own
 * module, so TypeScript would otherwise chase the reference back into the
 * action's own initializer and give up with an implicit `any` — which would
 * quietly erase the return type at every call site, including the route.
 */
export type PreviewView = {
  renderSpec: string;
  expiresAt: number;
  claimed: boolean;
};

const previewViewValidator = v.object({
  /**
   * The serialized `SiteRenderSpec`, not a pre-destructured object. The
   * caller re-parses it through `parseSiteRenderSpec`, so the contract is
   * enforced again at the render boundary rather than the renderer trusting
   * whatever shape happened to come back over the wire.
   */
  renderSpec: v.string(),
  expiresAt: v.number(),
  /** Whether S5 has already converted this into an owned project. */
  claimed: v.boolean(),
});

export const resolveForView = internalQuery({
  args: { token: v.string(), now: v.number() },
  returns: v.union(v.null(), previewViewValidator),
  handler: async (ctx, args) => {
    // Malformed, unknown, and expired all return null with no reason
    // channel. Callers must not reconstruct the distinction.
    const capability = await resolveCapability(ctx, args.token, args.now);
    if (capability === null) return null;
    return {
      // Round-trips through the serializer so a row that somehow parsed but
      // would not re-serialize cannot reach a renderer.
      renderSpec: serializeSiteRenderSpec(capability.renderSpec),
      expiresAt: capability.expiresAt,
      claimed: capability.claimedByUserId !== undefined,
    };
  },
});

/**
 * Public because an anonymous visitor's page render must reach it. Holding
 * the token is the entire authorization; there is no identity to check.
 */
export const view = action({
  args: { token: v.string() },
  returns: v.union(v.null(), previewViewValidator),
  handler: async (ctx, args): Promise<PreviewView | null> =>
    await ctx.runQuery(internal.platform.preview.read.resolveForView, {
      token: args.token,
      // Server clock. Never an argument to this action: see the note above.
      now: Date.now(),
    }),
});
