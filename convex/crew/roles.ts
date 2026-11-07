/**
 * Crew role catalogue and hiring rules (WP69-S3; roster per idea, WP90).
 *
 * Plain TypeScript module of pure functions. It deliberately registers no
 * Convex functions and does no I/O; later Convex code calls `planRoster`.
 *
 * Who is hired (WP90, owner decision 2026-11-07):
 * - the core (`CORE_ROLE_KEYS`: Crew Lead, Brand, Email, Social) always;
 * - a paid push always hires Ads, and a course always hires Curriculum: the
 *   founder stated those facts, so no proposal can drop them;
 * - every other optional role follows the Crew Lead's proposal from the
 *   blueprint (`RosterInput.proposal`, already cleaned), with its reason;
 * - a role the proposal does not answer falls back to the WP69 rules, with the
 *   rule's reason. With no proposal at all the team is the WP69 one.
 */
import {
  CORE_ROLE_KEYS,
  isCoreRoleKey,
  rosterInputSchema,
  rosterPlanSchema,
  singleLineText,
  type CoreRoleKey,
  type EngineeringWeight,
  type GoalKind,
  type IdeaKind,
  type OptionalRoleKey,
  type RoleKey,
  type RosterInput,
  type RosterPlan,
  type TeamDecision,
} from "../../lib/workspace/contracts/roster";

export const ROSTER_RULES_VERSION = "2026-11-07.1";

export type RoleCatalogueEntry = {
  readonly key: RoleKey;
  readonly label: string;
  readonly employeeName: string;
  /** A core role (`CORE_ROLE_KEYS`), hired for every business. */
  readonly always: boolean;
  readonly does: string;
};

const CORE_SET: ReadonlySet<RoleKey> = new Set<RoleKey>(CORE_ROLE_KEYS);

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

const CATALOGUE_SOURCE: readonly Omit<RoleCatalogueEntry, "always">[] = [
  {
    key: "lead",
    label: "Crew Lead",
    employeeName: "Wren",
    does: "Routes approvals and is the only voice in chat.",
  },
  {
    key: "brand",
    label: "Brand",
    employeeName: "Iris",
    does: "Designs the logo, palette and voice.",
  },
  {
    key: "landing",
    label: "Landing",
    employeeName: "Leo",
    does: "Builds the site and the waitlist.",
  },
  {
    key: "seo",
    label: "SEO",
    employeeName: "Sana",
    does: "Targets the searches people make about the problem.",
  },
  {
    key: "marketing",
    label: "Marketing",
    employeeName: "Marco",
    does: "Owns the first goal and the plan to reach it.",
  },
  {
    key: "email",
    label: "Email",
    employeeName: "Elle",
    does: "Writes the email sequences.",
  },
  {
    key: "social",
    label: "Social",
    employeeName: "Theo",
    does: "Drafts launch posts and ongoing social content.",
  },
  {
    key: "engineering",
    label: "Engineering",
    employeeName: "Kai",
    does: "Scopes the product and writes the build prompts, or sets up checkout.",
  },
  {
    key: "ads",
    label: "Ads",
    employeeName: "Ada",
    does: "Plans and runs the paid test.",
  },
  {
    key: "curriculum",
    label: "Curriculum",
    employeeName: "Cora",
    does: "Outlines the lessons and course materials.",
  },
  {
    key: "community",
    label: "Community",
    employeeName: "Nia",
    does: "Runs the cohort or community space.",
  },
  {
    key: "merch",
    label: "Merch",
    employeeName: "Max",
    does: "Handles product listings, suppliers and fulfilment.",
  },
  {
    key: "outbound",
    label: "Outbound",
    employeeName: "Oli",
    does: "Finds and contacts business buyers directly.",
  },
];

export const ROLE_CATALOGUE: readonly RoleCatalogueEntry[] =
  CATALOGUE_SOURCE.map((entry) => ({
    ...entry,
    always: CORE_SET.has(entry.key),
  }));

/** Optional founder-chosen display name for the lead. */
export const leadNameSchema = singleLineText(24);

const KIND_ARTICLE_LABEL: Record<IdeaKind, string> = {
  app: "An app",
  course: "A course",
  physical_product: "A physical product",
  service: "A service",
  marketplace: "A marketplace",
  b2b_software: "A B2B tool",
};

const PRODUCT_NOUN: Record<IdeaKind, string> = {
  app: "an app",
  course: "a course",
  physical_product: "a physical product",
  service: "a service",
  marketplace: "a marketplace",
  b2b_software: "a B2B tool",
};

/** Order in which skipped roles are listed. */
const SKIPPED_ORDER: readonly RoleKey[] = [
  "landing",
  "seo",
  "marketing",
  "engineering",
  "ads",
  "merch",
  "outbound",
  "curriculum",
  "community",
];

const SALE_GOALS: readonly GoalKind[] = [
  "first_sale",
  "mrr_500",
  "replace_income",
];

/** Upper-cases the first letter only when the first word is all lowercase ("iOS" stays). */
function capitalise(text: string): string {
  const first = text.split(" ")[0] ?? "";
  if (text.length === 0 || first !== first.toLowerCase()) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2);
}

function engineeringWeight(kind: IdeaKind): EngineeringWeight {
  return kind === "app" || kind === "marketplace" || kind === "b2b_software"
    ? "full"
    : "light";
}

function goalPhrase(input: RosterInput): string | null {
  const target = input.goal.target;
  return target ? `${target.count} ${target.unit}` : null;
}

function engineeringReason(kind: IdeaKind, weight: EngineeringWeight): string {
  if (weight === "full") {
    return `PRD slice and 8-prompt build pack. The product is ${PRODUCT_NOUN[kind]}.`;
  }
  if (kind === "course") {
    return "Checkout and course hosting setup only. No product build pack.";
  }
  if (kind === "service") {
    return "Booking and checkout setup only. No product build pack.";
  }
  return "Checkout and storefront setup only. No product build pack.";
}

function emailReason(goal: GoalKind): string {
  switch (goal) {
    case "waitlist":
      return "Waitlist email sequence";
    case "first_sale":
    case "mrr_500":
    case "replace_income":
      return "Pre-launch and launch-day emails";
    case "just_testing":
      return "A short welcome sequence";
    default:
      return assertNever(goal);
  }
}

function landingReason(goal: GoalKind): string {
  return SALE_GOALS.includes(goal)
    ? "Sales page and early-bird list"
    : "Site and waitlist";
}

function coreReason(key: CoreRoleKey, input: RosterInput): string {
  switch (key) {
    case "lead":
      return "Routes approvals; the only voice in chat";
    case "brand":
      return "Logo, palette, voice";
    case "email":
      return emailReason(input.goal.kind);
    case "social":
      return "Launch posts";
    default:
      return assertNever(key);
  }
}

function merchSkipReason(kind: IdeaKind): string {
  // Canvas wording for the course example is "Nothing physical", not the template.
  if (kind === "course") return "Nothing physical";
  return `${KIND_ARTICLE_LABEL[kind]}; nothing physical to sell`;
}

function outboundSkipReason(input: RosterInput): string {
  // Canvas wording: consumer self-serve products are found via communities and search.
  if (input.buyer === "consumer" && input.deliveryFormat === "self_serve") {
    return `${capitalise(input.audiencePlural)} come via communities and search`;
  }
  return "Not a B2B buyer";
}

function communitySkipReason(input: RosterInput): string {
  const phrase = goalPhrase(input);
  return phrase
    ? `Not before the first ${phrase}`
    : "No course or cohort to run yet";
}

function communityHireReason(input: RosterInput): string {
  return input.deliveryFormat === "cohort"
    ? "Cohort format"
    : "Courses run better with a community";
}

/** The founder-stated facts no proposal can override (owner decision Q2): a paid push hires Ads, a course hires Curriculum. */
function forcedHire(key: OptionalRoleKey, input: RosterInput): boolean {
  if (key === "ads") return input.goal.paidPush !== null;
  if (key === "curriculum") return input.ideaKind === "course";
  return false;
}

/** The WP69 rule for an optional role, used when the proposal does not answer it. */
function ruleHires(key: OptionalRoleKey, input: RosterInput): boolean {
  switch (key) {
    case "landing":
    case "seo":
    case "marketing":
    case "engineering":
      return true;
    case "ads":
      return input.goal.paidPush !== null;
    case "curriculum":
      return input.ideaKind === "course";
    case "community":
      return input.ideaKind === "course" || input.deliveryFormat === "cohort";
    case "merch":
      return input.ideaKind === "physical_product";
    case "outbound":
      return input.buyer === "business";
    default:
      return assertNever(key);
  }
}

function ruleHireReason(key: OptionalRoleKey, input: RosterInput): string {
  switch (key) {
    case "landing":
      return landingReason(input.goal.kind);
    case "seo":
      return "People search for this problem";
    case "marketing": {
      const phrase = goalPhrase(input);
      return phrase ? `Owns ${phrase}` : "Owns the first goal";
    }
    case "engineering":
      return engineeringReason(input.ideaKind, engineeringWeight(input.ideaKind));
    case "ads":
      return `Goal has a paid push: $${formatUsd(input.goal.paidPush?.dailyBudgetUsd ?? 0)}/day test`;
    case "curriculum":
      return "Idea kind is course";
    case "community":
      return communityHireReason(input);
    case "merch":
      return "Idea kind is physical product";
    case "outbound":
      return "Buyer is a business";
    default:
      return assertNever(key);
  }
}

function ruleSkipReason(key: OptionalRoleKey, input: RosterInput): string {
  switch (key) {
    case "landing":
    case "seo":
    case "marketing":
    case "engineering":
      // The rules always hire these; only a proposal skips them, with its own reason.
      return "Not needed for this idea yet";
    case "ads":
      return "No paid goal yet";
    case "curriculum":
      return "No course content";
    case "community":
      return communitySkipReason(input);
    case "merch":
      return merchSkipReason(input.ideaKind);
    case "outbound":
      return outboundSkipReason(input);
    default:
      return assertNever(key);
  }
}

type Decision = { readonly hire: boolean; readonly reason: string; readonly byLead: boolean };

/** Who decides an optional role: a forced rule, else the lead's proposal, else the WP69 rule. */
function decide(key: OptionalRoleKey, input: RosterInput, proposal: ReadonlyMap<RoleKey, TeamDecision>): Decision {
  if (forcedHire(key, input)) return { hire: true, reason: ruleHireReason(key, input), byLead: false };
  const proposed = proposal.get(key);
  if (proposed !== undefined) return { hire: proposed.hire, reason: proposed.reason, byLead: true };
  const hire = ruleHires(key, input);
  return { hire, reason: hire ? ruleHireReason(key, input) : ruleSkipReason(key, input), byLead: false };
}

export function planRoster(
  rawInput: RosterInput,
  options?: { leadName?: string },
): RosterPlan {
  const input = rosterInputSchema.parse(rawInput);
  const rawLead = options?.leadName?.trim();
  const leadName = rawLead ? leadNameSchema.parse(rawLead) : undefined;
  const proposal = new Map<RoleKey, TeamDecision>((input.proposal ?? []).map((entry) => [entry.roleKey, entry]));

  const hired: RosterPlan["hired"] = [];
  const skipped: RosterPlan["skipped"] = [];

  for (const entry of ROLE_CATALOGUE) {
    const key = entry.key;
    const employeeName =
      key === "lead" && leadName ? leadName : entry.employeeName;
    if (isCoreRoleKey(key)) {
      hired.push({
        roleKey: key,
        employeeName,
        roleLabel: entry.label,
        hiredBy: "rule",
        always: true,
        reason: coreReason(key, input),
      });
      continue;
    }
    const decision = decide(key, input, proposal);
    const byLead = decision.byLead ? { decidedBy: "lead" as const } : {};
    if (decision.hire) {
      hired.push({
        roleKey: key,
        employeeName,
        roleLabel: entry.label,
        hiredBy: "rule",
        always: false,
        ...(key === "engineering"
          ? { weight: engineeringWeight(input.ideaKind) }
          : {}),
        reason: decision.reason,
        ...byLead,
      });
    } else {
      skipped.push({
        roleKey: key,
        roleLabel: entry.label,
        reason: decision.reason,
        ...byLead,
      });
    }
  }

  skipped.sort(
    (a, b) =>
      SKIPPED_ORDER.indexOf(a.roleKey) - SKIPPED_ORDER.indexOf(b.roleKey),
  );

  return rosterPlanSchema.parse({
    schemaVersion: 1,
    rulesVersion: ROSTER_RULES_VERSION,
    ideaKind: input.ideaKind,
    hired,
    skipped,
  });
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function summariseRoster(plan: RosterPlan): {
  hiredCount: number;
  skippedCount: number;
  line: string;
} {
  const hiredCount = plan.hired.length;
  const skippedCount = plan.skipped.length;
  const alwaysCount = plan.hired.filter((h) => h.always).length;
  const extras = plan.hired.filter((h) => !h.always).map((h) => h.roleLabel);
  const hiredPart =
    extras.length === 0
      ? `${hiredCount} hired: the ${alwaysCount} core roles.`
      : `${hiredCount} hired: the ${alwaysCount} core roles plus ${joinNames(extras)}.`;
  const skippedPart =
    skippedCount === 0
      ? "0 skipped."
      : `${skippedCount} skipped: ${plan.skipped.map((s) => s.roleLabel).join(", ")}.`;
  return { hiredCount, skippedCount, line: `${hiredPart} ${skippedPart}` };
}

function lowerFirst(text: string): string {
  if (text.length < 2) return text.toLowerCase();
  const second = text.charAt(1);
  // Keep acronyms such as "PRD" intact.
  if (second === second.toUpperCase() && second !== second.toLowerCase()) {
    return text;
  }
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Collapses whitespace and newlines so a value can never add lines to TEAM.md. */
function flat(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function renderTeamMd(
  plan: RosterPlan,
  meta: { businessName: string; planLabel: string; goalLabel: string },
): string {
  const hiredLines = plan.hired.map((h) => {
    const tags: string[] = [
      h.always ? "core" : h.hiredBy === "founder" ? "founder" : h.decidedBy === "lead" ? "lead's call" : "added",
    ];
    if (h.weight) tags.push(`weight: ${h.weight}`);
    return `- ${h.roleKey}: ${flat(h.employeeName)} (${tags.join(", ")}) — ${lowerFirst(flat(h.reason))}`;
  });
  const skippedLines = plan.skipped.map(
    (s) => `- ${s.roleKey}${s.decidedBy === "lead" ? " (lead's call)" : ""} — ${lowerFirst(flat(s.reason))}`,
  );
  return [
    `# TEAM.md — ${flat(meta.businessName)}`,
    "",
    `ideaKind: ${plan.ideaKind}`,
    `plan: ${flat(meta.planLabel)}`,
    `goal: ${flat(meta.goalLabel)}`,
    "",
    "## Hired",
    ...hiredLines,
    "",
    "## Skipped",
    ...(skippedLines.length > 0 ? skippedLines : ["- none"]),
    "",
    "autopilot: off for everyone",
    "",
  ].join("\n");
}
