import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { parseSiteRenderSpec, type SiteRenderSpec } from "./renderSpec";

/**
 * WP27-S1. Capability lifecycle for anonymous previews.
 *
 * The capability token is the entire authorization for an anonymous preview:
 * there is no owner to check against before signup. That makes three
 * properties load-bearing rather than optional.
 *
 * 1. The token is stored hashed. WP21 applied the same discipline to
 *    magic-link tokens; a database read must not yield a working URL.
 * 2. Expiry is evaluated server-side against a caller-supplied `now`, never
 *    a wall-clock read inside a query (Convex guideline) and never a
 *    client-side comparison. Nothing depends on a cleanup job having run.
 * 3. Resolution is constant-*shape*: malformed, unknown, and expired tokens
 *    all return `null` with no reason channel, so a caller cannot learn that
 *    a token was once valid.
 *
 * On (3), the precise claim is constant shape, not constant time. The paths
 * do differ in work — malformed returns before any read, unknown costs an
 * index miss, and a live hit additionally parses its stored spec. That is an
 * accepted residual: exploiting the difference requires already holding a
 * 256-bit token, at which point enumeration has already succeeded. Surfaces
 * built on this (S4) carry the real obligation: they must not vary status
 * code, body, or cache headers across the three cases.
 */

/** Owner ruling 2026-08-06: 7 days, reusable within the window. */
export const CAPABILITY_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** 32 bytes of CSPRNG output, hex-encoded: 64 URL-safe characters. */
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateCapabilityToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashCapabilityToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return toHex(new Uint8Array(digest));
}

/**
 * Shape-checks a caller-supplied token before it is hashed or looked up.
 * Returns null rather than throwing so a malformed token collapses into the
 * same generic not-found as an unknown one.
 */
export function normalizeCapabilityToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim().toLowerCase();
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function capabilityExpiresAt(now: number): number {
  return now + CAPABILITY_LIFETIME_MS;
}

/**
 * Fails closed on a non-finite `now`. Convex `v.number()` is a float64 and
 * admits `NaN`, and `expiresAt <= NaN` is `false` — so a naive comparison
 * would report every expired capability as live. Any caller that sourced
 * `now` from client input could then revive expired previews by sending
 * `NaN`. Treat anything non-finite as expired rather than trusting it.
 *
 * `now` must still be server-supplied: read `Date.now()` in a mutation or
 * action and pass it down. The Convex guideline against wall-clock reads
 * inside queries is about cache correctness, not an invitation to accept a
 * client-controlled timestamp on a security boundary.
 */
export function isCapabilityExpired(
  capability: Pick<Doc<"preview_capabilities">, "expiresAt">,
  now: number,
): boolean {
  if (!Number.isFinite(now)) return true;
  return capability.expiresAt <= now;
}

export type ResolvedCapability = {
  capabilityId: Doc<"preview_capabilities">["_id"];
  sourceIdeaId: Doc<"preview_capabilities">["sourceIdeaId"];
  templateId: Doc<"preview_capabilities">["templateId"];
  renderSpec: SiteRenderSpec;
  expiresAt: number;
  claimedByUserId?: Doc<"preview_capabilities">["claimedByUserId"];
  claimedProjectId?: Doc<"preview_capabilities">["claimedProjectId"];
};

/** Matches the `Pick<QueryCtx, ...>` convention used by `platform/authz.ts`. */
type CapabilityReadCtx = Pick<QueryCtx, "db">;

/**
 * Resolves a plaintext token to its capability, or null.
 *
 * Returns null identically for a malformed token, an unknown token, and an
 * expired one. Callers must not branch on the reason, and the surfaces built
 * on this in S4 must render one generic page for all three — distinguishing
 * "expired" from "never existed" would confirm to an attacker that a token
 * was once valid.
 *
 * A *claimed* capability still resolves while unexpired: the visitor who
 * claimed it may legitimately reload the preview. `claimedByUserId` is
 * returned so S4/S5 can decide what to show, rather than being decided here.
 */
export async function resolveCapability(
  ctx: CapabilityReadCtx,
  rawToken: unknown,
  now: number,
): Promise<ResolvedCapability | null> {
  const token = normalizeCapabilityToken(rawToken);
  if (token === null) return null;
  // Checked before the lookup so a non-finite clock can never reach the
  // comparison via a row that does exist.
  if (!Number.isFinite(now)) return null;

  const tokenHash = await hashCapabilityToken(token);

  let capability: Doc<"preview_capabilities"> | null;
  try {
    capability = await ctx.db
      .query("preview_capabilities")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
  } catch {
    // `.unique()` throws when two rows share a hash. Convex indexes carry no
    // uniqueness constraint, so a duplicate-insert bug upstream would
    // otherwise turn into a permanent 500 on that token for an anonymous
    // visitor — a louder signal than not-found, and a worse outcome.
    return null;
  }

  if (capability === null) return null;
  if (isCapabilityExpired(capability, now)) return null;

  let renderSpec: SiteRenderSpec;
  try {
    renderSpec = parseSiteRenderSpec(capability.renderSpec);
  } catch {
    // A stored spec that no longer parses is a data-integrity fault, not a
    // rendering problem. Caught broadly and deliberately: splitting on error
    // class would mean one future refactor throwing a TypeError turns a
    // corrupt row into a 500 that an anonymous caller can distinguish from
    // not-found. Nothing anonymous-facing should be able to tell those apart.
    return null;
  }

  return {
    capabilityId: capability._id,
    sourceIdeaId: capability.sourceIdeaId,
    templateId: capability.templateId,
    renderSpec,
    expiresAt: capability.expiresAt,
    ...(capability.claimedByUserId
      ? { claimedByUserId: capability.claimedByUserId }
      : {}),
    ...(capability.claimedProjectId
      ? { claimedProjectId: capability.claimedProjectId }
      : {}),
  };
}
