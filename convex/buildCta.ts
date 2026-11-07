import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireCurrentPlatformUser } from "./platform/authz";
import { assertFeatureEnabled, getOpsSettings } from "./ops/settings";

/**
 * WP74-S5: may the public pages show the "Build this idea, free" CTAs?
 *
 * The CTAs sit on pages an anonymous visitor reads, so this cannot be a
 * `workspace/*` function: those all require a signed-in owner. It answers a
 * single boolean and nothing else, and it uses the same C-OPS settings the
 * wizard route gate uses (`ops_settings.workspaceEnabled` + cohort):
 *
 * - workspace off: no one sees a CTA;
 * - cohort `open`: everyone sees it, signed in or not;
 * - cohort `allowlist`: a signed-in owner sees it only when on the allowlist.
 *   An anonymous visitor cannot be matched to the list, so they see it too
 *   (L1-C9, owner's call 2026-11-07): the CTA goes through sign-up, and a
 *   new account that is not on the list gets a "not in the beta yet" page at
 *   `/start` (`awaitingInvite`) instead of a 404.
 *
 * Any failure reads as `false`: a missing row, a bad session, an error. It
 * reveals no idea, no owner and no cohort member. The wizard itself re-checks
 * everything (`workspace/wizard:getWizardAccess`), so showing a CTA never grants
 * access.
 *
 * Lives outside the directories the WP68 workspace scanner covers on purpose:
 * it is the one public, anonymous workspace read. Needs from Codex: confirm.
 */
export const buildCtaVisible = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const settings = await getOpsSettings(ctx);
    if (!settings.workspaceEnabled) return false;
    if (settings.cohortMode === "open") return true;
    if ((await ctx.auth.getUserIdentity()) === null) return true;
    try {
      await assertFeatureEnabled(ctx, "workspace");
      return true;
    } catch {
      return false;
    }
  },
});

/**
 * L1-C9: is this caller signed in but not yet invited? True only when the
 * workspace is on, the cohort is `allowlist`, the caller is a signed-in
 * platform user, and they have no `workspace_cohort` row. `/start` asks it
 * only after `getWizardAccess` refused, to show "not in the beta yet" instead
 * of a 404. It reveals nothing about anyone but the caller, and any failure
 * reads as `false` (the 404 stays).
 */
export const awaitingInvite = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const settings = await getOpsSettings(ctx);
    if (!settings.workspaceEnabled || settings.cohortMode !== "allowlist") return false;
    if ((await ctx.auth.getUserIdentity()) === null) return false;
    try {
      const user = await requireCurrentPlatformUser(ctx);
      const row = await ctx.db
        .query("workspace_cohort")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
        .unique();
      return row === null;
    } catch {
      return false;
    }
  },
});
