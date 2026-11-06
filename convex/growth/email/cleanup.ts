import { v } from "convex/values";
import { components } from "../../_generated/api";
import { internalMutation } from "../../_generated/server";

// Owner-approved retention cleanup runs while workspace/email are off. These
// wrappers only delete component records; neither can enqueue or send mail.
export const finalized = internalMutation({
  args: { olderThan: v.number() },
  handler: async (ctx, { olderThan }) => {
    await ctx.runMutation(components.resend.lib.cleanupOldEmails, { olderThan });
  },
});

export const abandoned = internalMutation({
  args: { olderThan: v.number() },
  handler: async (ctx, { olderThan }) => {
    await ctx.runMutation(components.resend.lib.cleanupAbandonedEmails, { olderThan });
  },
});
