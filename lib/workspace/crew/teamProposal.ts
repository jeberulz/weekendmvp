/**
 * Roster per idea (WP90). The Crew Lead's team proposal, as the blueprint
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
import {
  OPTIONAL_ROLE_KEYS,
  TEAM_REASON_MAX,
  isOptionalRoleKey,
  singleLineText,
  type TeamDecision,
} from "../contracts/roster";
import { findLinkLike } from "./checks/emailLinks";
import { carriesMarketNumber } from "./checks/marketNumbers";
import { checkNeverFake } from "./checks/neverFake";

export type TeamProposalContext = {
  /** The idea is the founder's own: no market numbers in a reason (D15). */
  readonly ownIdea: boolean;
  /** The business's own name, for the same exemptions the blueprint check gives it. */
  readonly brandName?: string;
};

const reasonSchema = singleLineText(TEAM_REASON_MAX);

/** The cleaned reason, or null when it must not be stored. */
function cleanReason(raw: string, context: TeamProposalContext): string | null {
  const parsed = reasonSchema.safeParse(raw);
  if (!parsed.success) return null;
  const reason = parsed.data;
  if (findLinkLike(reason) !== null) return null;
  const options = context.brandName === undefined ? {} : { brandName: context.brandName };
  if (checkNeverFake(reason, options).some((found) => found.severity === "hard")) return null;
  if (context.ownIdea && carriesMarketNumber(reason, options)) return null;
  return reason;
}

/**
 * The clean decisions of a proposal, in `OPTIONAL_ROLE_KEYS` order. Undefined
 * in, undefined out: a blueprint without a team block keeps the rules.
 */
export function cleanTeamProposal(
  team: readonly BlueprintTeamEntry[] | undefined,
  context: TeamProposalContext,
): TeamDecision[] | undefined {
  if (team === undefined) return undefined;
  const byRole = new Map<string, TeamDecision>();
  const seen = new Set<string>();
  for (const entry of team) {
    const key = entry.roleKey.trim();
    if (seen.has(key)) {
      // A role answered twice is ambiguous: neither answer counts.
      byRole.delete(key);
      continue;
    }
    seen.add(key);
    if (!isOptionalRoleKey(key)) continue;
    const reason = cleanReason(entry.reason, context);
    if (reason === null) continue;
    byRole.set(key, { roleKey: key, hire: entry.hire, reason });
  }
  return OPTIONAL_ROLE_KEYS.flatMap((key) => {
    const decision = byRole.get(key);
    return decision === undefined ? [] : [decision];
  });
}
