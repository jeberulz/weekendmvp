import { RateLimiter, HOUR } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";

import type { HumanPrincipal } from "../../lib/editorial/contracts/principal";
import { liveEnvironment } from "../../lib/editorial/core/live";
import { createSequentialIds } from "../../lib/editorial/core/state";
import { PartitionedEditorialRepository } from "../../lib/editorial/core/partitioned";
import { components } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentAccount, type Account } from "../admin/superAdmin";
import { randomKey } from "./ids";
import { ConvexWorkingSetStore } from "./store";

/**
 * Who is calling an editorial function, established on the server from the
 * verified session (WP46-E4c). Nothing here reads an identity, role or
 * capability from arguments.
 */
export type EditorialSession = {
  account: Account | null;
  principal: HumanPrincipal | null;
  /** When the super-admin capability was bound (ISO), for the capability holder only. */
  boundAt: string | null;
};

/** How the editorial UI names the account. Never its email. */
export function displayNameFor(user: Doc<"users">): string {
  return user.name?.trim() || "Super-admin account";
}

/**
 * Pass `now` from mutations so an expired stored session is refused; queries
 * cannot read the clock and rely on Convex Auth's token expiry.
 *
 * Strong authentication is the session's creation time: Convex Auth creates
 * a session only on a full sign-in and keeps it across token refreshes, so a
 * recent session means the account proved its sign-in method recently.
 */
export async function editorialSession(ctx: Pick<QueryCtx, "auth" | "db">, now?: number): Promise<EditorialSession> {
  const account = await currentAccount(ctx, now);
  if (account === null) return { account: null, principal: null, boundAt: null };
  const admin = account.binding !== null;
  return {
    account,
    boundAt: account.binding ? new Date(account.binding.boundAt).toISOString() : null,
    principal: {
      kind: "human",
      id: account.user._id,
      displayName: admin ? displayNameFor(account.user) : "Account without editorial access",
      capability: admin ? "editorial_admin" : null,
      strongAuthAt: admin ? new Date(account.session._creationTime).toISOString() : null,
      session: "live",
    },
  };
}

const EARLIEST = Date.parse("2024-01-01T00:00:00Z");
const LATEST = Date.parse("2100-01-01T00:00:00Z");

/** Queries take the request time as an argument; it only affects displayed freshness. */
export function requestTime(nowMs: number): number {
  if (!Number.isFinite(nowMs) || nowMs < EARLIEST || nowMs > LATEST) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid request time." });
  }
  return nowMs;
}

const limiter = new RateLimiter(components.rateLimiter, {
  // A signed-in account without the capability gets its refusals recorded up
  // to this rate; beyond it they are still refused, just not written again.
  editorialDeniedRecords: { kind: "fixed window", rate: 20, period: HOUR },
});

type RepositoryOptions = { nowMs: number; recordDenials?: boolean };

function repository(
  db: QueryCtx["db"],
  writer: MutationCtx["db"] | null,
  session: EditorialSession,
  options: RepositoryOptions,
): PartitionedEditorialRepository {
  return new PartitionedEditorialRepository(new ConvexWorkingSetStore(db, writer), {
    env: liveEnvironment(),
    clock: { now: () => options.nowMs },
    // Reads persist nothing, so they need no random keys (and draw no randomness).
    ids: writer ? { next: (prefix) => randomKey(prefix) } : createSequentialIds(),
    principal: session.principal,
    settings: { boundAt: session.boundAt },
    recordDenials: options.recordDenials,
  });
}

/** For public queries: read-only, nothing written (not even a denial). */
export async function readRepository(ctx: QueryCtx, nowMs: number): Promise<PartitionedEditorialRepository> {
  const session = await editorialSession(ctx);
  return repository(ctx.db, null, session, { nowMs: requestTime(nowMs) });
}

/** For public mutations: the server's clock, an unexpired session, rate-limited denial records. */
export async function commandRepository(ctx: MutationCtx): Promise<PartitionedEditorialRepository> {
  const nowMs = Date.now();
  const session = await editorialSession(ctx, nowMs);
  let recordDenials = true;
  if (session.principal && session.principal.capability === null) {
    const { ok } = await limiter.limit(ctx, "editorialDeniedRecords", { key: session.principal.id });
    recordDenials = ok;
  }
  return repository(ctx.db, ctx.db, session, { nowMs, recordDenials });
}

/** For internal service functions: trusted backend callers only. */
export function serviceRepository(ctx: MutationCtx): PartitionedEditorialRepository {
  return repository(ctx.db, ctx.db, { account: null, principal: null, boundAt: null }, { nowMs: Date.now() });
}
