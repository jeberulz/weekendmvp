/**
 * Roster per idea (WP91). The Crew Lead's team proposal, as the blueprint
 * call wrote it, made safe to store and to plan from.
 *
 * The model proposes; code decides what counts. An entry is kept only when:
 * - its role is an optional role (`OPTIONAL_ROLE_KEYS`): core roles are always
 *   hired, and an unknown key is dropped;
 * - its role is answered once (a role answered twice is dropped: it is ambiguous);
 * - its reason is one clean line of at most 160 characters;
 * - its reason passes the checks the blueprint itself must pass: no invented
 *   proof (never fake it), no link, and for an own idea no market number (D15).
 * A dropped entry leaves its role to the rules in `planRoster`, with the
 * rule's reason, so a bad reason never blocks the blueprint or the launch.
 *
 * Pure: no Convex, no I/O, no model call; relative imports only (the Convex
 * bundler loads this file).
 */
import type { BlueprintTeamEntry } from "../contracts/artifacts";
import { normaliseTeamProposal, type TeamDecision } from "../contracts/roster";
import { findLinkLike } from "./checks/emailLinks";
import { carriesMarketNumber } from "./checks/marketNumbers";
import { checkNeverFake } from "./checks/neverFake";

export type TeamProposalContext = {
  /** The idea is the founder's own: no market numbers in a reason (D15). */
  readonly ownIdea: boolean;
  /** The business's own name, for the same exemptions the blueprint check gives it. */
  readonly brandName?: string;
};

/** Whether a (structurally clean) reason passes the blueprint's own content checks. */
function reasonPassesChecks(reason: string, context: TeamProposalContext): boolean {
  if (findLinkLike(reason) !== null) return false;
  const options = context.brandName === undefined ? {} : { brandName: context.brandName };
  if (checkNeverFake(reason, options).some((found) => found.severity === "hard")) return false;
  return !(context.ownIdea && carriesMarketNumber(reason, options));
}

/**
 * The clean decisions of a proposal, in `OPTIONAL_ROLE_KEYS` order. Undefined
 * in, undefined out: a blueprint without a team block keeps the rules.
 */
export function cleanTeamProposal(
  team: readonly BlueprintTeamEntry[] | undefined,
  context: TeamProposalContext,
): TeamDecision[] | undefined {
  return normaliseTeamProposal(team, (reason) => reasonPassesChecks(reason, context));
}
