import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  founderSignalsSchema,
  WIZARD_LIMITS,
  type WizardAnswersProgress,
  type WizardStep,
} from "../../lib/workspace/contracts/wizard";
import { signalNote, truncateText, type FounderSignalAction } from "../../lib/workspace/wizard/labels";

/**
 * WP74-S2 founder signals: one insert-only `founder_signals` row per wizard
 * step decision (`kept` / `changed` / `skipped` / `rewrote`), written in the
 * same transaction as the step it describes. No public functions here: the
 * wizard mutations in `wizard.ts` are the only writers, after their own
 * feature, auth and ownership checks.
 *
 * `before` is the suggested default and `after` what the founder ended up
 * with, both short summaries bounded to `WIZARD_LIMITS.signalNote`.
 */

/** How far back in the owner's signals the duplicate check looks. */
const DEDUPE_WINDOW = 200;

export type FounderSignalInput = {
  readonly ownerId: Id<"users">;
  readonly session: Doc<"wizard_sessions">;
  readonly step: WizardStep;
  readonly action: FounderSignalAction;
  readonly before: string | undefined;
  readonly after: string | undefined;
  readonly now: number;
};

function bounded(value: string | undefined): string | undefined {
  return value === undefined ? undefined : truncateText(value, WIZARD_LIMITS.signalNote);
}

/**
 * Inserts the signal unless the same (session, step, action) is already
 * logged, so a repeated decision (a double click, or Back then the same
 * choice) is recorded once. Returns whether a row was written.
 *
 * The owner-first index is the only one that reaches a session's rows, so the
 * check reads the owner's latest `DEDUPE_WINDOW` signals (a wizard writes at
 * most a handful per session).
 */
export async function recordFounderSignal(ctx: MutationCtx, input: FounderSignalInput): Promise<boolean> {
  const recent = await ctx.db
    .query("founder_signals")
    .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", input.ownerId))
    .order("desc")
    .take(DEDUPE_WINDOW);
  const duplicate = recent.some(
    (row) =>
      row.wizardSessionId === input.session._id && row.step === input.step && row.action === input.action,
  );
  if (duplicate) return false;
  await ctx.db.insert("founder_signals", {
    ownerId: input.ownerId,
    wizardSessionId: input.session._id,
    ...(input.session.projectId === undefined ? {} : { projectId: input.session.projectId }),
    step: input.step,
    action: input.action,
    ...(input.before === undefined ? {} : { before: bounded(input.before) }),
    ...(input.after === undefined ? {} : { after: bounded(input.after) }),
    createdAt: input.now,
  });
  return true;
}

/**
 * The `answers.signals` mirror. C-WIZARD only allows `kept` / `edited` with a
 * note, so `changed` and `rewrote` become `edited`, and `skipped` becomes
 * `kept` (the suggested default was applied) with a note that says it was
 * skipped. The result is parsed through `founderSignalsSchema`.
 */
export function mirrorSignal(
  signals: WizardAnswersProgress["signals"],
  step: WizardStep,
  action: FounderSignalAction,
  before: string | undefined,
  after: string | undefined,
): NonNullable<WizardAnswersProgress["signals"]> {
  return founderSignalsSchema.parse({
    ...(signals ?? {}),
    [step]: {
      signal: action === "changed" || action === "rewrote" ? "edited" : "kept",
      note: signalNote(step, action, before, after),
    },
  });
}
