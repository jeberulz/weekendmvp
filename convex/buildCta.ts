import { v } from "convex/values";
import { query } from "./_generated/server";
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
 * - cohort `allowlist`: only a signed-in owner on the allowlist sees it. An
 *   anonymous visitor cannot be matched to the list, so they see nothing until
 *   they sign in.
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
    try {
      await assertFeatureEnabled(ctx, "workspace");
      return true;
    } catch {
      return false;
    }
  },
});
