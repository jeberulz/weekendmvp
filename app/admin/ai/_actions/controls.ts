"use server";

import { z } from "zod";

import { CAP_OVERRIDE_CEILING_MICRO_USD, EXPIRY_CHOICES, type CapOverride } from "@/lib/admin/ai-costs/cap-override";
import { CONTROL_ERRORS, POOL_BUDGET_CEILING_MICRO_USD, REASON_MAX } from "@/lib/admin/ai-costs/controls";
import { resolveControlsBackend, type ControlResult, type FoundAccount } from "@/lib/admin/ai-costs/controls-server";
import { assertEditorialRoutesEnabled } from "@/lib/editorial/runtime/route-guard";

/*
 * WP93 Phase 2. The console's writes. Each action validates its input,
 * resolves the backend for this request (refusing anyone the server cannot
 * vouch for) and passes the call on. Convex re-checks the super admin and
 * every rule; nothing here decides access.
 */

const FORBIDDEN = { ok: false as const, code: "FORBIDDEN" as const, message: CONTROL_ERRORS.FORBIDDEN };
const INVALID = { ok: false as const, code: "INVALID_BUDGET" as const, message: CONTROL_ERRORS.INVALID_BUDGET };

const ownerIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);
const budgetSchema = z.int().min(0).max(POOL_BUDGET_CEILING_MICRO_USD * 10);

const spendSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative().nullable(),
  freeBudgetMicroUsd: budgetSchema,
  paidBudgetMicroUsd: budgetSchema,
  killSwitches: z.strictObject({
    ai: z.boolean(),
    studioVideo: z.boolean(),
    publish: z.boolean(),
    email: z.boolean(),
    social: z.boolean(),
    ads: z.boolean(),
  }),
  confirm: z.string().max(40).nullable(),
});

export async function updateSpendControlsAction(input: z.input<typeof spendSchema>): Promise<ControlResult<{ risky: boolean }>> {
  assertEditorialRoutesEnabled();
  const parsed = spendSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const backend = await resolveControlsBackend();
  if (!backend) return FORBIDDEN;
  return await backend.updateSpend(parsed.data);
}

const cohortSchema = z.strictObject({
  ownerId: ownerIdSchema,
  allowed: z.boolean(),
  reason: z.string().max(REASON_MAX * 2).nullable(),
});

export async function setCohortAction(input: z.input<typeof cohortSchema>): Promise<ControlResult<{ changed: boolean }>> {
  assertEditorialRoutesEnabled();
  const parsed = cohortSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "RESOURCE_NOT_FOUND", message: CONTROL_ERRORS.RESOURCE_NOT_FOUND };
  const backend = await resolveControlsBackend();
  if (!backend) return FORBIDDEN;
  return await backend.setCohort(parsed.data.ownerId, parsed.data.allowed, parsed.data.reason);
}

const findSchema = z.strictObject({ email: z.string().max(320) });

export async function findAccountAction(input: z.input<typeof findSchema>): Promise<ControlResult<FoundAccount>> {
  assertEditorialRoutesEnabled();
  const parsed = findSchema.safeParse(input);
  if (!parsed.success) return { ok: true, value: { status: "invalid" } };
  const backend = await resolveControlsBackend();
  if (!backend) return FORBIDDEN;
  try {
    return { ok: true, value: await backend.findAccount(parsed.data.email) };
  } catch {
    return { ok: false, code: "UNAVAILABLE", message: CONTROL_ERRORS.UNAVAILABLE };
  }
}

const capSchema = z.strictObject({
  ownerId: ownerIdSchema,
  capMicroUsd: z.int().min(0).max(CAP_OVERRIDE_CEILING_MICRO_USD * 10),
  expiry: z.enum(EXPIRY_CHOICES),
  reason: z.string().max(REASON_MAX * 2).nullable(),
  confirm: z.string().max(40).nullable(),
});

export async function setCapOverrideAction(input: z.input<typeof capSchema>): Promise<ControlResult<{ override: CapOverride }>> {
  assertEditorialRoutesEnabled();
  const parsed = capSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const backend = await resolveControlsBackend();
  if (!backend) return FORBIDDEN;
  return await backend.setCapOverride(parsed.data);
}

const clearCapSchema = z.strictObject({ ownerId: ownerIdSchema });

export async function clearCapOverrideAction(input: z.input<typeof clearCapSchema>): Promise<ControlResult<{ changed: boolean }>> {
  assertEditorialRoutesEnabled();
  const parsed = clearCapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "RESOURCE_NOT_FOUND", message: CONTROL_ERRORS.RESOURCE_NOT_FOUND };
  const backend = await resolveControlsBackend();
  if (!backend) return FORBIDDEN;
  return await backend.clearCapOverride(parsed.data.ownerId);
}

/** Local fixtures only: the simulated sign-in. Production never resolves a fixture backend. */
export async function simulateSignInAction(): Promise<ControlResult<{ done: true }>> {
  assertEditorialRoutesEnabled();
  const backend = await resolveControlsBackend();
  if (!backend || backend.mode !== "fixture") return FORBIDDEN;
  await backend.simulateSignIn();
  return { ok: true, value: { done: true } };
}
