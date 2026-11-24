/**
 * Step 5's live consequence line (owner decision 4A, 2026-11-24): one
 * sentence saying what the selected goal makes the crew do, recomputed on
 * every change. Pure, and in the roster's own words (`landingReason` /
 * `emailReason` / `forcedHire("ads")` in `convex/crew/roles.ts`), so it never
 * promises work the roster does not plan. The crew rail stays the saved view.
 */
import type { GoalKind } from "../contracts/roster";
import { GOAL_TARGETS } from "../contracts/wizard";
import { PAID_PUSH_DAILY_USD } from "./labels";

/** The hired crew from the preview, by role; null when the idea has no profile yet. */
export type GoalLineCrew = {
  readonly hired: readonly { readonly roleKey: string; readonly employeeName: string }[];
} | null;

/** The line in three parts, so the target can be emphasised. */
export type GoalLine = { readonly lead: string; readonly target: string; readonly rest: string };

const SALE_GOALS: readonly GoalKind[] = ["first_sale", "mrr_500", "replace_income"];

function landingWork(kind: GoalKind): string {
  return SALE_GOALS.includes(kind) ? "a sales page and early-bird list" : "a site and waitlist";
}

function emailWork(kind: GoalKind): string {
  if (kind === "waitlist") return "the waitlist emails";
  if (kind === "just_testing") return "a short welcome sequence";
  return "the pre-launch and launch-day emails";
}

function targetPhrase(kind: GoalKind): string {
  const target = GOAL_TARGETS[kind];
  if (target !== null) return kind === "mrr_500" ? "$500 a month" : `${target.count} ${target.unit}`;
  return kind === "replace_income" ? "replacing your income" : "no target";
}

export function goalLine(kind: GoalKind, paidPush: boolean, crew: GoalLineCrew): GoalLine {
  const lead = kind === "just_testing" ? "Your crew will test the idea with " : "Your crew will aim at ";
  const target = targetPhrase(kind);
  const paid = paidPush ? ` Ads joins for a $${PAID_PUSH_DAILY_USD} a day test.` : "";
  if (crew === null) {
    return { lead, target, rest: `: ${landingWork(kind)}, and ${emailWork(kind)}.${paid}` };
  }
  const name = (roleKey: string) => crew.hired.find((entry) => entry.roleKey === roleKey)?.employeeName;
  const landing = name("landing");
  const email = name("email");
  const parts = [
    landing ? `${landing} builds ${landingWork(kind)}` : null,
    email ? `${email} writes ${emailWork(kind)}` : null,
  ].filter((part): part is string => part !== null);
  const work = parts.length > 0 ? ` ${parts.join("; ")}.` : "";
  return { lead, target, rest: `.${work}${paid}` };
}
