import type { SubmissionProducer } from "./submission";

/**
 * Principals are established by the adapter from server-side state (a
 * verified session, a signed service credential). No command accepts an actor
 * ID, role or capability from its caller.
 */
export type HumanPrincipal = {
  kind: "human";
  id: string;
  displayName: string;
  /** `null` is a signed-in account without the editorial capability. */
  capability: "editorial_admin" | null;
  /** Last strong (step-up) authentication, from the session — not the client. */
  strongAuthAt: string | null;
  session: "fixture" | "live";
};

export type IngestionPrincipal = {
  kind: "service";
  id: string;
  role: "ingestion";
  producer: SubmissionProducer;
};

export type ReleaseWorkerPrincipal = {
  kind: "service";
  id: string;
  role: "release_worker";
};

export type EditorialPrincipal = HumanPrincipal | IngestionPrincipal | ReleaseWorkerPrincipal;

/** How recent a strong authentication must be for publish/unpublish/rollback/trash. */
export const STRONG_AUTH_MAX_AGE_MS = 10 * 60 * 1000;

export function isEditorialAdmin(
  principal: EditorialPrincipal | null,
): principal is HumanPrincipal & { capability: "editorial_admin" } {
  return principal?.kind === "human" && principal.capability === "editorial_admin";
}

export function hasFreshStrongAuth(principal: HumanPrincipal, nowMs: number): boolean {
  if (principal.strongAuthAt === null) return false;
  const at = Date.parse(principal.strongAuthAt);
  return Number.isFinite(at) && at <= nowMs + 1000 && nowMs - at <= STRONG_AUTH_MAX_AGE_MS;
}

/** Display form used in activity and history. Never includes contact details. */
export type PrincipalView = {
  kind: "human" | "service" | "system";
  label: string;
};

/**
 * An opaque credential presented by an ingestion producer. The fixture
 * adapter issues its own; the live adapter (E5) verifies a signed one.
 */
export type IngestionCredential = { readonly token: string };
