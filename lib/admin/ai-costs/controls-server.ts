import "server-only";

import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";
import {
  CONTROL_ERRORS,
  budgetAllowed,
  cleanReason,
  confirmMatches,
  isControlErrorCode,
  normalizeEmail,
  riskReasons,
  signedInRecently,
  type ControlErrorCode,
  type KillSwitches,
  type SpendControls,
} from "./controls";
import { CAP_OVERRIDE_LIVE, capOverrideRefusal, expiryFor, isActive, type CapOverride, type ExpiryChoice } from "./cap-override";
import { utcDayKeyOf } from "./ranges";
import type { ControlRoom, OwnerSummary } from "./types";

/**
 * WP93 Phase 2. The ops controls' data and writes, live or on local fixtures.
 *
 * Live: every call goes to `convex/admin/aiControls.ts` with the signed-in
 * session's token; Convex re-checks the super admin and every rule. Fixtures
 * (development with `EDITORIAL_FIXTURE_MODE=local-demo` only): an in-memory
 * store that applies the same rules, with a simulated sign-in step.
 */

export type CohortMember = { ownerId: string; email: string | null; verified: boolean; addedAt: number };
export type RecentChange = { id: string; action: string; subjectId: string; subjectEmail: string | null; metadata: string | null; createdAt: number };

export type ControlsView = {
  readonly mode: "fixture" | "live";
  readonly nowMs: number;
  readonly control: ControlRoom;
  readonly version: number | null;
  readonly cohort: readonly CohortMember[];
  readonly cohortTruncated: boolean;
  readonly recent: readonly RecentChange[];
  /** A full sign-in within the last 10 minutes. */
  readonly signedInRecently: boolean;
  readonly stepUp: { method: "google" | "email" | null; email: string | null } | null;
};

export type FoundAccount =
  | { status: "invalid" }
  | { status: "none" }
  | { status: "many"; count: number }
  | { status: "one"; account: { ownerId: string; email: string; verified: boolean; createdAt: number; inCohort: boolean } };

export type SpendInput = {
  expectedVersion: number | null;
  freeBudgetMicroUsd: number;
  paidBudgetMicroUsd: number;
  killSwitches: KillSwitches;
  confirm: string | null;
};

export type CapOverrideInput = {
  ownerId: string;
  capMicroUsd: number;
  expiry: ExpiryChoice;
  reason: string | null;
  confirm: string | null;
};

/** `available` is false until the meter reads overrides (Codex C2): the console then shows a note, not the form. */
export type CapOverrides = { available: boolean; overrides: readonly CapOverride[] };

export type ControlResult<T> = { ok: true; value: T } | { ok: false; code: ControlErrorCode; message: string };

export type StepUpState = Pick<ControlsView, "signedInRecently" | "stepUp">;

export type ControlsBackend = {
  readonly mode: "fixture" | "live";
  view(): Promise<ControlsView>;
  /** The sign-in facts a risky form needs, without the rest of the view. */
  stepUpState(): Promise<StepUpState>;
  findAccount(email: string): Promise<FoundAccount>;
  setCohort(ownerId: string, allowed: boolean, reason: string | null): Promise<ControlResult<{ changed: boolean }>>;
  updateSpend(input: SpendInput): Promise<ControlResult<{ risky: boolean }>>;
  /** Live overrides only (expired ones are left out). */
  capOverrides(): Promise<CapOverrides>;
  /** Always a risky change: a recent sign-in and the typed confirm. */
  setCapOverride(input: CapOverrideInput): Promise<ControlResult<{ override: CapOverride }>>;
  /** Ends an override early. One click, audited. */
  clearCapOverride(ownerId: string): Promise<ControlResult<{ changed: boolean }>>;
  /** Fixtures only: the simulated "confirm it's you". */
  simulateSignIn(): Promise<void>;
};

function refused<T>(code: ControlErrorCode): ControlResult<T> {
  return { ok: false, code, message: CONTROL_ERRORS[code] };
}

/** Convex refusals carry `{ code }`; anything else is "could not be saved". */
function fromError<T>(error: unknown): ControlResult<T> {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    const code = data && typeof data === "object" && "code" in data ? (data as { code: unknown }).code : null;
    if (isControlErrorCode(code)) return refused(code);
  }
  return refused("UNAVAILABLE");
}

/* Live ------------------------------------------------------------------- */

function liveBackend(token: string): ControlsBackend {
  return {
    mode: "live",
    async view() {
      const nowMs = Date.now();
      const [control, state, session] = await Promise.all([
        fetchQuery(api.admin.aiCosts.controlRoom, { dayKey: utcDayKeyOf(nowMs) }, { token }),
        fetchQuery(api.admin.aiControls.controlsState, {}, { token }),
        fetchQuery(api.editorial.reads.session, { nowMs }, { token }),
      ]);
      return {
        mode: "live",
        nowMs,
        control,
        version: state.version,
        cohort: state.cohort,
        cohortTruncated: state.cohortTruncated,
        recent: state.recent,
        signedInRecently: signedInRecently(state.sessionCreatedAt, nowMs),
        stepUp: session.editor ? { method: session.editor.signInMethod, email: session.editor.email } : null,
      };
    },
    async stepUpState() {
      const nowMs = Date.now();
      const [state, session] = await Promise.all([
        fetchQuery(api.admin.aiControls.controlsState, {}, { token }),
        fetchQuery(api.editorial.reads.session, { nowMs }, { token }),
      ]);
      return {
        signedInRecently: signedInRecently(state.sessionCreatedAt, nowMs),
        stepUp: session.editor ? { method: session.editor.signInMethod, email: session.editor.email } : null,
      };
    },
    async findAccount(email) {
      return await fetchQuery(api.admin.aiControls.findAccount, { email }, { token });
    },
    async setCohort(ownerId, allowed, reason) {
      try {
        const result = await fetchMutation(
          api.admin.aiControls.setCohort,
          { ownerId: ownerId as Id<"users">, allowed, ...(reason === null ? {} : { reason }) },
          { token },
        );
        return { ok: true, value: { changed: result.changed } };
      } catch (error) {
        return fromError(error);
      }
    },
    async updateSpend(input) {
      try {
        const result = await fetchMutation(api.admin.aiControls.updateSpendControls, {
          expectedVersion: input.expectedVersion,
          freeBudgetMicroUsd: BigInt(input.freeBudgetMicroUsd),
          paidBudgetMicroUsd: BigInt(input.paidBudgetMicroUsd),
          killSwitches: { ...input.killSwitches },
          ...(input.confirm === null ? {} : { confirm: input.confirm }),
        }, { token });
        return { ok: true, value: { risky: result.risky } };
      } catch (error) {
        return fromError(error);
      }
    },
    async capOverrides() {
      // Codex C2 (schema field + meter) is not on main yet: nothing to read or write.
      return { available: CAP_OVERRIDE_LIVE, overrides: [] };
    },
    async setCapOverride() {
      return refused("NOT_AVAILABLE");
    },
    async clearCapOverride() {
      return refused("NOT_AVAILABLE");
    },
    async simulateSignIn() {
      // Live sign-in is a real Convex Auth sign-in, started in the browser.
    },
  };
}

/* Fixtures --------------------------------------------------------------- */

type FixtureControls = {
  version: number;
  settings: SpendControls;
  cohort: Map<string, CohortMember>;
  accounts: Map<string, { ownerId: string; email: string; verified: boolean; createdAt: number }>;
  recent: RecentChange[];
  signedInAt: number;
  sequence: number;
  /** Optional so a store made by an older dev-server build still loads. */
  overrides?: Map<string, CapOverride>;
};

const STORE_KEY = Symbol.for("weekendmvp.wp93.fixtureControls");
type StoreHolder = { [STORE_KEY]?: FixtureControls };

async function fixtureStore(nowMs: number): Promise<{ store: FixtureControls; control: ControlRoom; summaries: readonly OwnerSummary[] }> {
  const { fixtureData } = await import("./fixtures");
  const data = fixtureData(nowMs);
  const holder = globalThis as StoreHolder;
  if (!holder[STORE_KEY]) {
    const accounts = new Map<string, { ownerId: string; email: string; verified: boolean; createdAt: number }>();
    const cohort = new Map<string, CohortMember>();
    for (const summary of data.summaries) {
      if (summary.email === null) continue;
      const createdAt = nowMs - 40 * 24 * 60 * 60 * 1000;
      accounts.set(summary.email.toLowerCase(), { ownerId: summary.ownerId, email: summary.email, verified: true, createdAt });
      if (summary.inCohort) cohort.set(summary.ownerId, { ownerId: summary.ownerId, email: summary.email, verified: true, addedAt: createdAt });
    }
    // One fictional account that never verified its email, to show the refusal.
    accounts.set("unverified@example.test", { ownerId: "fixture-unverified", email: "unverified@example.test", verified: false, createdAt: nowMs });
    holder[STORE_KEY] = {
      version: nowMs - 60 * 60 * 1000,
      settings: {
        freeBudgetMicroUsd: data.controlRoom.freeBudgetMicroUsd,
        paidBudgetMicroUsd: data.controlRoom.paidBudgetMicroUsd,
        killSwitches: { ...data.controlRoom.killSwitches },
      },
      cohort,
      accounts,
      recent: [],
      signedInAt: nowMs - 60 * 60 * 1000,
      sequence: 0,
    };
  }
  const store = holder[STORE_KEY];
  store.overrides ??= new Map();
  return {
    store,
    summaries: data.summaries,
    control: {
      ...data.controlRoom,
      freeBudgetMicroUsd: store.settings.freeBudgetMicroUsd,
      paidBudgetMicroUsd: store.settings.paidBudgetMicroUsd,
      killSwitches: { ...store.settings.killSwitches },
      cohortSize: store.cohort.size,
      cohortSizeTruncated: false,
    },
  };
}

function record(
  store: FixtureControls,
  nowMs: number,
  action: string,
  subjectId: string,
  subjectEmail: string | null,
  metadata: Record<string, unknown>,
): void {
  store.sequence += 1;
  store.recent.unshift({ id: `fixture-audit-${store.sequence}`, action, subjectId, subjectEmail, metadata: JSON.stringify(metadata), createdAt: nowMs });
  store.recent.length = Math.min(store.recent.length, 20);
}

function fixtureBackend(): ControlsBackend {
  return {
    mode: "fixture",
    async view() {
      const nowMs = Date.now();
      const { store, control } = await fixtureStore(nowMs);
      return {
        mode: "fixture",
        nowMs,
        control,
        version: store.version,
        cohort: [...store.cohort.values()].sort((a, b) => b.addedAt - a.addedAt),
        cohortTruncated: false,
        recent: [...store.recent],
        signedInRecently: signedInRecently(store.signedInAt, nowMs),
        stepUp: null,
      };
    },
    async stepUpState() {
      const nowMs = Date.now();
      const { store } = await fixtureStore(nowMs);
      return { signedInRecently: signedInRecently(store.signedInAt, nowMs), stepUp: null };
    },
    async findAccount(email) {
      const { store } = await fixtureStore(Date.now());
      const normalized = normalizeEmail(email);
      if (normalized === null) return { status: "invalid" };
      const account = store.accounts.get(normalized);
      if (!account) return { status: "none" };
      return { status: "one", account: { ...account, inCohort: store.cohort.has(account.ownerId) } };
    },
    async setCohort(ownerId, allowed, reasonInput) {
      const nowMs = Date.now();
      const { store } = await fixtureStore(nowMs);
      const reason = cleanReason(reasonInput);
      if (!allowed && reason === null) return refused("REASON_REQUIRED");
      const account = [...store.accounts.values()].find((candidate) => candidate.ownerId === ownerId);
      if (!account) return refused("RESOURCE_NOT_FOUND");
      if (allowed && !account.verified) return refused("NOT_VERIFIED");
      if (allowed === store.cohort.has(ownerId)) return { ok: true, value: { changed: false } };
      if (allowed) store.cohort.set(ownerId, { ownerId, email: account.email, verified: account.verified, addedAt: nowMs });
      else store.cohort.delete(ownerId);
      record(store, nowMs, allowed ? "ops.cohort.added" : "ops.cohort.removed", ownerId, account.email, reason === null ? { allowed } : { allowed, reason });
      return { ok: true, value: { changed: true } };
    },
    async updateSpend(input) {
      const nowMs = Date.now();
      const { store, control } = await fixtureStore(nowMs);
      if (input.expectedVersion !== store.version) return refused("STALE");
      if (!budgetAllowed(input.freeBudgetMicroUsd) || !budgetAllowed(input.paidBudgetMicroUsd)) return refused("BUDGET_TOO_HIGH");
      const next: SpendControls = {
        freeBudgetMicroUsd: input.freeBudgetMicroUsd,
        paidBudgetMicroUsd: input.paidBudgetMicroUsd,
        killSwitches: { ...input.killSwitches },
      };
      const current = store.settings;
      const unchanged = next.freeBudgetMicroUsd === current.freeBudgetMicroUsd && next.paidBudgetMicroUsd === current.paidBudgetMicroUsd &&
        (Object.keys(next.killSwitches) as (keyof KillSwitches)[]).every((key) => next.killSwitches[key] === current.killSwitches[key]);
      if (unchanged) return refused("NO_CHANGE");
      const risks = riskReasons(current, next, { free: control.free.spentMicroUsd, paid: control.paid.spentMicroUsd });
      if (risks.length > 0) {
        if (!signedInRecently(store.signedInAt, nowMs)) return refused("REAUTH_REQUIRED");
        if (!confirmMatches(input.confirm)) return refused("CONFIRM_REQUIRED");
      }
      store.settings = next;
      store.version = nowMs;
      record(store, nowMs, "ops.settings.changed", "ops_settings", null, {
        globalDailyBudgetMicroUsd: String(next.freeBudgetMicroUsd),
        paidGlobalDailyBudgetMicroUsd: String(next.paidBudgetMicroUsd),
        killSwitches: next.killSwitches,
        via: "ai-console",
        risky: risks.length > 0,
      });
      return { ok: true, value: { risky: risks.length > 0 } };
    },
    async capOverrides() {
      const nowMs = Date.now();
      const { store } = await fixtureStore(nowMs);
      const overrides = [...(store.overrides?.values() ?? [])].filter((override) => isActive(override, nowMs));
      return { available: true, overrides };
    },
    async setCapOverride(input) {
      const nowMs = Date.now();
      const { store, summaries } = await fixtureStore(nowMs);
      const summary = summaries.find((candidate) => candidate.ownerId === input.ownerId);
      if (!summary) return refused("RESOURCE_NOT_FOUND");
      const reason = cleanReason(input.reason);
      if (reason === null) return refused("CAP_REASON_REQUIRED");
      const refusal = capOverrideRefusal(input.capMicroUsd, summary.dayCapMicroUsd);
      if (refusal !== null) return refused(refusal);
      // Raising a cap spends more: always the step-up and the typed confirm.
      if (!signedInRecently(store.signedInAt, nowMs)) return refused("REAUTH_REQUIRED");
      if (!confirmMatches(input.confirm)) return refused("CONFIRM_REQUIRED");
      const override: CapOverride = {
        ownerId: input.ownerId,
        capMicroUsd: input.capMicroUsd,
        expiresAt: expiryFor(input.expiry, nowMs),
        setAt: nowMs,
        reason,
      };
      store.overrides?.set(input.ownerId, override);
      record(store, nowMs, "ops.cap_override.set", input.ownerId, summary.email, {
        capMicroUsd: String(override.capMicroUsd),
        planCapMicroUsd: String(summary.dayCapMicroUsd),
        expiresAt: override.expiresAt,
        reason,
        via: "ai-console",
        risky: true,
      });
      return { ok: true, value: { override } };
    },
    async clearCapOverride(ownerId) {
      const nowMs = Date.now();
      const { store, summaries } = await fixtureStore(nowMs);
      const current = store.overrides?.get(ownerId);
      if (!current || !isActive(current, nowMs)) return { ok: true, value: { changed: false } };
      store.overrides?.delete(ownerId);
      const email = summaries.find((candidate) => candidate.ownerId === ownerId)?.email ?? null;
      record(store, nowMs, "ops.cap_override.cleared", ownerId, email, { capMicroUsd: String(current.capMicroUsd), via: "ai-console" });
      return { ok: true, value: { changed: true } };
    },
    async simulateSignIn() {
      const { store } = await fixtureStore(Date.now());
      store.signedInAt = Date.now();
    },
  };
}

/* Resolution ------------------------------------------------------------- */

/** The backend for this request, or null for anyone the server cannot vouch for. */
export async function resolveControlsBackend(): Promise<ControlsBackend | null> {
  if (process.env.NODE_ENV !== "production" && process.env.EDITORIAL_FIXTURE_MODE === "local-demo") {
    return fixtureBackend();
  }
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) return null;
  const token = await convexAuthNextjsToken();
  if (!token) return null;
  const backend = liveBackend(token);
  try {
    await fetchQuery(api.admin.aiControls.controlsState, {}, { token });
  } catch {
    return null;
  }
  return backend;
}

/**
 * Live raises for the founder pages. While the meter cannot read overrides
 * (`CAP_OVERRIDE_LIVE` false), live mode skips the extra Convex reads.
 */
export async function readCapOverrides(mode: "fixture" | "live"): Promise<{ caps: CapOverrides; backend: ControlsBackend | null }> {
  const none: CapOverrides = { available: false, overrides: [] };
  if (mode === "live" && !CAP_OVERRIDE_LIVE) return { caps: none, backend: null };
  const backend = await resolveControlsBackend();
  if (!backend) return { caps: none, backend: null };
  return { caps: await backend.capOverrides(), backend };
}
