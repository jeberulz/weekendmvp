import type { ProviderRole } from "./providers/types";

/**
 * WP26-S3. What a resumed step is allowed to do about a paid call that was
 * already accepted by a provider but never settled on our side.
 *
 * The crash window is real: we issue a call, the provider accepts and bills it,
 * and the process dies before we persist the result. On resume the step has a
 * durable "attempt started" record and no result, and must decide between
 * resending (risking a second charge) and giving up (wasting the first one).
 *
 * The story's rule offers two safe answers — reuse the provider's own
 * idempotency key, or look the result up under that key. A third case exists
 * and the story does not name it: **a provider that offers neither**. Perplexity
 * chat completions and DataForSEO's synchronous `live` endpoints have no
 * documented idempotency-key header and no "fetch the result of the call I made
 * under key K" lookup. For those, both named strategies are unavailable, and
 * resending anyway is the one thing that is definitely wrong — it is an
 * unbounded second charge on a call we already paid for.
 *
 * So the third branch is: **fail the step closed and do not resend.** That costs
 * us one already-spent call and routes the run to `S4`'s refund path, which is
 * the outcome the program's "money changes only from server-verified,
 * idempotent events" boundary demands.
 */

export type ReplaySafety =
  /** Provider dedupes on a submitted key; resending under the same key is safe. */
  | "idempotency-key"
  /** Provider can be asked for the prior result under the key before resending. */
  | "lookup"
  /** Neither. An unsettled attempt can never be safely resent. */
  | "none";

/**
 * **Every role is `"none"` until its replay behaviour is verified against live
 * provider documentation with credentials in hand.**
 *
 * This is not a placeholder to be optimistically filled in. It is the fail-safe
 * default, chosen because the two error directions are not symmetric: wrongly
 * assuming a provider dedupes double-charges a customer on every crash, while
 * wrongly assuming it does not costs us one call and refunds the customer. The
 * second is recoverable; the first is a money bug.
 *
 * OpenAI is the strongest candidate to be promoted to `"idempotency-key"` — the
 * step executor already submits a stable key for it (see
 * `providers/openai.ts`), so promotion is this one line plus the evidence. That
 * verification belongs to the credential-backed activation gate described in
 * `docs/wp/wp26-stories.md`, not to a fixture-mode story that cannot reach the
 * network to confirm it.
 */
export const PROVIDER_REPLAY_SAFETY: Readonly<Record<ProviderRole, ReplaySafety>> =
  {
    synthesis: "none",
    search: "none",
    keywordData: "none",
  };

export function replaySafetyFor(role: ProviderRole): ReplaySafety {
  return PROVIDER_REPLAY_SAFETY[role];
}

/**
 * Decides what a resumed step may do, given that a previous attempt was
 * recorded as started and never settled.
 */
export type ReconcileDecision =
  | { readonly action: "resend"; readonly reason: "provider-dedupes" }
  | { readonly action: "lookup"; readonly reason: "provider-lookup" }
  | { readonly action: "fail-closed"; readonly reason: "unsettled-unreplayable" };

/**
 * Takes the safety level rather than the role so the caller states which policy
 * it is applying, and so all three branches are reachable in tests while
 * production stays pinned to whatever `PROVIDER_REPLAY_SAFETY` declares.
 */
export function decideReconcile(safety: ReplaySafety): ReconcileDecision {
  switch (safety) {
    case "idempotency-key":
      return { action: "resend", reason: "provider-dedupes" };
    case "lookup":
      return { action: "lookup", reason: "provider-lookup" };
    case "none":
      return { action: "fail-closed", reason: "unsettled-unreplayable" };
  }
}
