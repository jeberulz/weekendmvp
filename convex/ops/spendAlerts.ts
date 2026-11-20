import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { soleActiveSuperAdminUserId } from "../admin/superAdmin";
import { platformResendFromAddress } from "../resendMagicLink";
import { formatUsd } from "../../lib/admin/ai-costs/money";

const alertArgs = {
  alarmId: v.id("audit_events"),
  dayKey: v.string(),
  pool: v.union(v.literal("free"), v.literal("paid")),
  threshold: v.union(v.literal(80), v.literal(100)),
  spentTodayMicroUsd: v.number(),
  inFlightMicroUsd: v.number(),
  budgetMicroUsd: v.int64(),
  retry: v.optional(v.boolean()),
};

export const send = internalAction({
  args: alertArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.ops.spendAlerts.enqueue, args);
    return null;
  },
});

/** Read the current binding and enqueue in the same transaction as the outcome audit. */
export const enqueue = internalMutation({
  args: alertArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const alarm = await ctx.db.get("audit_events", args.alarmId);
    if (alarm?.action !== "ops.spend.threshold") throw new Error("Spend alarm missing");
    const ownerId = await soleActiveSuperAdminUserId(ctx);
    const user = ownerId && await ctx.db.get("users", ownerId);
    const recipient = user?.email?.trim();
    let outcome = ownerId ? "missing_owner_email" : "no_single_active_binding";
    let emailId;
    if (recipient && !user?.isAnonymous) {
      try {
        const from = platformResendFromAddress(process.env);
        const mailer = new Resend(components.ownerSpendResend, {
          apiKey: process.env.AUTH_RESEND_KEY?.trim() ?? "",
          testMode: false,
          // The component passes retryAttempts to the workpool as maxAttempts.
          retryAttempts: 2,
        });
        const subject = `Weekend MVP: ${args.pool} AI pool reached ${args.threshold}%`;
        emailId = await mailer.sendEmail(ctx, {
          from, to: recipient, subject, idempotencyKey: args.alarmId,
          text: [
            `The ${args.pool} AI pool reached its ${args.threshold}% threshold for ${args.dayKey} UTC.`,
            `Spent: ${formatUsd(args.spentTodayMicroUsd)}`,
            `In flight: ${formatUsd(args.inFlightMicroUsd)}`,
            `Daily budget: ${formatUsd(Number(args.budgetMicroUsd))}`,
            "https://www.weekendmvp.app/admin/ai",
          ].join("\n"),
        });
        outcome = "queued";
      } catch {
        // Component mutations roll back on failure. Only a failed enqueue is retried here.
        outcome = args.retry ? "enqueue_failed" : "enqueue_retry_scheduled";
        if (!args.retry) await ctx.scheduler.runAfter(30_000, internal.ops.spendAlerts.send, { ...args, retry: true });
      }
    }
    // Threshold audits are append-only. Link the outcome without retaining recipient details.
    await ctx.db.insert("audit_events", {
      ownerId: alarm.ownerId, actorType: "system", action: "ops.spend.notification",
      subjectType: "audit_event", subjectId: alarm._id, createdAt: Date.now(),
      metadata: JSON.stringify({ outcome, emailId, dayKey: args.dayKey, threshold: `${args.pool}${args.threshold}` }),
    });
    return null;
  },
});
