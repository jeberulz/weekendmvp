/**
 * WP67 employee pages — the pure contract shared by the Convex read
 * (`convex/workspace/employees.ts`) and the page. Relative imports only: the
 * Convex bundler loads this file, so it cannot use the `@/` alias.
 *
 * Specialists only. The Crew Lead (Wren) has no employee page: the lead's
 * place is Team HQ's lead card and the chat.
 */
import type { ArtifactKind } from "./contracts/artifacts";
import { ROLE_KEYS, type RoleKey } from "./contracts/roster";

export type SpecialistRoleKey = Exclude<RoleKey, "lead">;

export const SPECIALIST_ROLE_KEYS: readonly SpecialistRoleKey[] = Object.freeze(
  ROLE_KEYS.filter((key): key is SpecialistRoleKey => key !== "lead"),
);

export function isSpecialistRoleKey(value: string): value is SpecialistRoleKey {
  return (SPECIALIST_ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * The artifact each specialist drafts (the inverse of `REVIEW_OWNER` in
 * `lib/workspace/teamHq.ts`; a test keeps the two equal). Roles with no crew
 * artifact yet (curriculum, community, merch, outbound) own none.
 */
export const EMPLOYEE_ARTIFACT_KINDS: Readonly<Record<SpecialistRoleKey, readonly ArtifactKind[]>> = Object.freeze({
  brand: ["brand_kit"],
  landing: ["landing_spec"],
  seo: ["seo_pack"],
  marketing: ["launch_plan"],
  email: ["email_sequence"],
  social: ["social_pack"],
  engineering: ["build_pack"],
  ads: ["ads_drafts"],
  curriculum: [],
  community: [],
  merch: [],
  outbound: [],
});

/** Newest tasks of the business read to find one employee's (no `employeeKey` index yet; BRIEF gap 1). */
export const EMPLOYEE_TASK_SCAN_MAX = 200;
/** Newest jobs kept for one employee's activity trail. */
export const EMPLOYEE_TASKS_MAX = 25;
/** Runs (tries) read per job. */
export const EMPLOYEE_RUNS_PER_TASK_MAX = 10;
/** Documents read per job. */
export const EMPLOYEE_DOCUMENTS_PER_TASK_MAX = 3;
/** Review cards read per document. */
export const EMPLOYEE_CARDS_PER_DOCUMENT_MAX = 5;
/** Drafts listed per artifact kind. */
export const EMPLOYEE_DELIVERABLES_MAX = 10;
/** Newest ledger rows read to find a costed job's charge and refund (only when a job had a cost; BRIEF gap 4). */
export const EMPLOYEE_LEDGER_SCAN_MAX = 200;
