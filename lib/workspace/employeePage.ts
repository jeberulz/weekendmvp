import { ROLE_CATALOGUE } from "@/convex/crew/roles";
import { LAUNCH_STEPS, type LaunchStep, type LaunchStepInput, type LaunchStepKey } from "@/convex/crew/steps";
import type { EmployeeActivity } from "@/convex/workspace/employees";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import type { LaunchView } from "@/lib/workspace/crew/launch";
import { isSpecialistRoleKey, type SpecialistRoleKey } from "@/lib/workspace/employees";
import { workspacePath } from "@/lib/workspace/routes";
import type { TeamHired, TeamSkipped, TeamStep } from "@/lib/workspace/teamHq";

/**
 * WP67 employee pages — the pure rules behind `/dashboard/b/{id}/team/{role}`
 * (`docs/wp/employee-pages/BRIEF.md`). The static profile comes from the role
 * catalogue, the launch DAG and the artifact contracts; the live parts from the
 * queries Team HQ reads plus `employeeActivity`. Nothing here invents activity:
 * every trail line maps one stored fact. Unit-tested in
 * `tests/platform/workspace-employee-page.test.tsx`.
 */

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** The employee page for a specialist; null for the Crew Lead (no page) and anything unknown. */
export function employeeHref(projectId: string, role: string): string | null {
  return isSpecialistRoleKey(role) ? workspacePath(projectId, `team/${role}`) : null;
}

// ---------------------------------------------------------------------------
// Static profile
// ---------------------------------------------------------------------------

export type EmployeeProfile = {
  readonly role: SpecialistRoleKey;
  readonly name: string;
  readonly roleLabel: string;
  readonly does: string;
  /** What they own, in full. Grounded in the artifact each one drafts (`lib/workspace/contracts/artifacts.ts`). */
  readonly responsibilities: readonly string[];
  /** What they will not do. */
  readonly wontDo: readonly string[];
  /** Writes in the brand kit's voice (the kit's own author included). */
  readonly usesBrandVoice: boolean;
};

const ALWAYS_WONT = "Message you directly. Their work reaches you as a review card that Wren routes.";

const PROFILES: Readonly<Record<SpecialistRoleKey, { responsibilities: readonly string[]; wontDo: readonly string[]; usesBrandVoice: boolean }>> = {
  brand: {
    responsibilities: [
      "Names the brand, with a few alternatives, and writes the tagline.",
      "Picks a five-colour palette (primary, secondary, accent, ground and ink), graded for contrast.",
      "Chooses the visual system: an art direction, a type pair and a type scale.",
      "Sets the voice everyone else writes in: three to five traits, a line to say and a line not to say, with why.",
      "Describes the logo mark and the hero art. Drawing the logo marks comes in a later update.",
    ],
    wontDo: ["Change the kit after you approve it, unless you ask for changes."],
    usesBrandVoice: true,
  },
  email: {
    responsibilities: [
      "Writes the four-email waitlist sequence: a welcome sent as soon as someone confirms, then a value email, an offer and a follow-up.",
      "Writes each email's subject, preview line, plain-text body and one call to action.",
      "Picks the sender name and writes in the brand kit's voice. The only merge tag is the subscriber's first name.",
    ],
    wontDo: ["Send anything. Sending is off in the beta, and no email goes out without your OK."],
    usesBrandVoice: true,
  },
  social: {
    responsibilities: [
      "Drafts seven launch posts, one a day from launch day (Friday) to the next Thursday.",
      "Gives every post a hook, a full caption, a short caption for platforms with tight limits, the card text and hashtags.",
      "Writes alt text for every image or carousel post, in the brand kit's voice.",
    ],
    wontDo: ["Post anything. Posting is off in the beta, and nothing posts without your OK."],
    usesBrandVoice: true,
  },
  landing: {
    responsibilities: [
      "Writes the landing page: the promise, how it works and the waitlist form.",
      "Lays each section out within the brand kit's visual system.",
    ],
    wontDo: ["Publish the site. Publishing is off in the beta, and nothing goes live without your OK."],
    usesBrandVoice: true,
  },
  seo: {
    responsibilities: [
      "Picks the search phrases people use about the problem. They are phrases only, with no volume or price figures.",
      "Writes each page's title and meta description, plus one article with its outline.",
    ],
    wontDo: ["Publish anything without your OK."],
    usesBrandVoice: false,
  },
  marketing: {
    responsibilities: [
      "Owns the first goal and the plan to reach it.",
      "Writes the launch plan: the items for each day from Thursday to Monday, each with an owner.",
    ],
    wontDo: ["Spend money or contact anyone on your behalf."],
    usesBrandVoice: false,
  },
  engineering: {
    responsibilities: [
      "Scopes the product for the weekend.",
      "For an app, writes the build pack: a PRD slice and the build prompts you run in your own coding tool. For other ideas, sets up checkout instead.",
    ],
    wontDo: ["Build or deploy code for you. You run the prompts yourself."],
    usesBrandVoice: false,
  },
  ads: {
    responsibilities: [
      "Plans a small paid test on Facebook or Instagram: the campaign, the audience and the ad copy.",
    ],
    wontDo: ["Spend money. No ad launches without your OK."],
    usesBrandVoice: true,
  },
  curriculum: { responsibilities: ["Outlines the lessons and course materials."], wontDo: [], usesBrandVoice: false },
  community: { responsibilities: ["Runs the cohort or community space."], wontDo: [], usesBrandVoice: false },
  merch: { responsibilities: ["Handles product listings, suppliers and fulfilment."], wontDo: [], usesBrandVoice: false },
  outbound: { responsibilities: ["Finds and contacts business buyers directly."], wontDo: ["Contact anyone without your OK."], usesBrandVoice: false },
};

export function employeeProfile(role: SpecialistRoleKey): EmployeeProfile {
  const entry = ROLE_CATALOGUE.find((candidate) => candidate.key === role);
  if (entry === undefined) throw new Error(`Unknown role ${role}`);
  const profile = PROFILES[role];
  return {
    role,
    name: entry.employeeName,
    roleLabel: entry.label,
    does: entry.does,
    responsibilities: profile.responsibilities,
    wontDo: [ALWAYS_WONT, ...profile.wontDo],
    usesBrandVoice: profile.usesBrandVoice,
  };
}

// ---------------------------------------------------------------------------
// The launch DAG, as it concerns one employee
// ---------------------------------------------------------------------------

export function stepsOwnedBy(role: RoleKey): readonly LaunchStep[] {
  return LAUNCH_STEPS.filter((step) => step.employee === role);
}

export type Availability =
  /** At least one of their steps has a generator. */
  | { readonly kind: "available"; readonly later: readonly string[] }
  /** Their steps exist but none is built yet. */
  | { readonly kind: "coming_soon"; readonly steps: readonly string[] }
  /** No launch step at all. */
  | { readonly kind: "not_in_beta" };

export function availability(role: SpecialistRoleKey): Availability {
  const steps = stepsOwnedBy(role);
  if (steps.length === 0) return { kind: "not_in_beta" };
  const built = steps.filter((step) => step.status === "built");
  const later = steps.filter((step) => step.status !== "built").map((step) => step.title);
  return built.length > 0 ? { kind: "available", later } : { kind: "coming_soon", steps: later };
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "Leo starts when the landing page ships in a later update." */
export function startsWhenCopy(name: string, a: Availability): string {
  switch (a.kind) {
    case "available":
      return a.later.length === 0 ? "" : `${joinList(a.later)} ${a.later.length === 1 ? "comes" : "come"} in a later update.`;
    case "coming_soon":
      return `${name} starts when the ${joinList(a.steps.map((title) => title.toLowerCase()))} ${a.steps.length === 1 ? "ships" : "ship"} in a later update. Until then there is no work to show.`;
    case "not_in_beta":
      return `${name}'s work is not part of this beta yet, so there is no work to show.`;
  }
}

const SOURCE_WORDS: Readonly<Record<Extract<LaunchStepInput, { source: string }>["source"], string>> = {
  wizard_answers: "Your answers from the build wizard",
  idea_seed: "The idea's starting research",
  pro_max: "A design reference library",
  landing_icons: "An icon set",
  idea_prompts: "The idea's build prompts",
  stack: "Your chosen stack",
};

export type Person = { readonly role: RoleKey; readonly name: string };

function ownerOf(key: LaunchStepKey): RoleKey {
  return LAUNCH_STEPS.find((step) => step.key === key)?.employee ?? "lead";
}

function nameFor(role: RoleKey, roster: readonly Pick<TeamHired, "role" | "name">[], lead: string): string {
  if (role === "lead") return lead;
  return roster.find((entry) => entry.role === role)?.name ?? ROLE_CATALOGUE.find((entry) => entry.key === role)?.employeeName ?? role;
}

/** What the employee's steps read, in words, each once; another employee's artifact is credited to them. */
export function worksFrom(role: RoleKey, roster: readonly Pick<TeamHired, "role" | "name">[], lead: string): string[] {
  const lines: string[] = [];
  for (const step of stepsOwnedBy(role)) {
    for (const input of step.inputs) {
      let line: string;
      if ("source" in input) {
        line = SOURCE_WORDS[input.source];
      } else {
        const owner = ownerOf(input.step);
        if (owner === role) continue;
        const title = input.step === "roster" ? "team plan" : (LAUNCH_STEPS.find((s) => s.key === input.step)?.title ?? input.step).toLowerCase();
        line = `The ${title} from ${nameFor(owner, roster, lead)}`;
      }
      if (!lines.includes(line)) lines.push(line);
    }
  }
  return lines;
}

/**
 * Who starts after this employee: each child step owned by someone else on
 * this team (`hired`), with its title. A child step whose owner the roster
 * skipped, or whose step is not built yet, is left out: it will not run.
 */
export function handsOffTo(role: RoleKey, hired: readonly Pick<TeamHired, "role" | "name">[]): (Person & { readonly title: string })[] {
  const own = new Set(stepsOwnedBy(role).map((step) => step.key));
  const out: (Person & { readonly title: string })[] = [];
  for (const step of LAUNCH_STEPS) {
    // Only steps that run today: a not-built step would "start" nothing.
    if (step.employee === role || step.status !== "built" || !step.parents.some((parent) => own.has(parent))) continue;
    const person = hired.find((entry) => entry.role === step.employee);
    if (person !== undefined) out.push({ role: person.role, name: person.name, title: step.title });
  }
  return out;
}

/** This employee's launch steps as `launchProgress` returns them, in DAG order. */
export function myLaunchSteps(role: RoleKey, steps: readonly TeamStep[]): TeamStep[] {
  return steps.filter((step) => step.employee === role);
}

/** Parent steps owned by someone else that one of this employee's steps waits on (not done yet). */
export function waitingOn(role: RoleKey, steps: readonly TeamStep[], roster: readonly Pick<TeamHired, "role" | "name">[], lead: string): { title: string; who: string; state: TeamStep["state"] }[] {
  const mine = myLaunchSteps(role, steps).filter((step) => step.state === "waiting");
  const out: { title: string; who: string; state: TeamStep["state"] }[] = [];
  for (const step of mine) {
    const definition = LAUNCH_STEPS.find((entry) => entry.key === step.key);
    for (const parent of definition?.parents ?? []) {
      const parentStep = steps.find((entry) => entry.key === parent);
      if (parentStep === undefined || parentStep.employee === role || parentStep.state === "succeeded") continue;
      if (out.some((entry) => entry.title === parentStep.title)) continue;
      out.push({ title: parentStep.title, who: nameFor(parentStep.employee, roster, lead), state: parentStep.state });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Page state
// ---------------------------------------------------------------------------

export type EmployeePageState =
  | { readonly kind: "team_pending"; readonly launch: Exclude<LaunchView["state"], "ready"> }
  | { readonly kind: "not_hired"; readonly reason: string }
  | { readonly kind: "hired"; readonly reason: string };

/** Whether the roster hired this role for this business, skipped it (with the roster's reason), or has not run yet. */
export function employeePageState(role: SpecialistRoleKey, launch: LaunchView, hired: readonly TeamHired[], skipped: readonly TeamSkipped[]): EmployeePageState {
  if (launch.state !== "ready") return { kind: "team_pending", launch: launch.state };
  const h = hired.find((entry) => entry.role === role);
  if (h !== undefined) return { kind: "hired", reason: h.reason };
  const s = skipped.find((entry) => entry.role === role);
  return { kind: "not_hired", reason: s?.reason ?? "This team does not include this role." };
}

export function teamPendingCopy(state: Exclude<LaunchView["state"], "ready">, lead: string): string {
  switch (state) {
    case "not_started":
      return `Your team is not written yet. Once ${lead} puts it together, this page shows whether this role was hired and what they are working on.`;
    case "assembling":
      return `${lead} is putting your team together. This page fills in once the team is written.`;
    case "failed":
      return `${lead} couldn't put your team together yet. Team HQ has the details and Try again.`;
  }
}

// ---------------------------------------------------------------------------
// Activity trail
// ---------------------------------------------------------------------------

type ActivityTask = EmployeeActivity["tasks"][number];
type Decision = ActivityTask["decisions"][number];

export type TrailEntry = {
  readonly key: string;
  readonly at: number;
  /** "Drafted the Brand kit", "Revised the Brand kit (change round 1)". */
  readonly headline: string;
  /** The job's outcome, e.g. "Finished", "Didn't finish". */
  readonly outcome: string;
  readonly tone: "done" | "working" | "paused" | "failed" | "stopped";
  /** Further facts, each one sentence, in order. */
  readonly details: readonly string[];
};

const OUTCOME: Readonly<Record<ActivityTask["status"], { label: string; tone: TrailEntry["tone"] }>> = {
  queued: { label: "Queued", tone: "working" },
  running: { label: "Working on it", tone: "working" },
  blocked: { label: "Paused", tone: "paused" },
  succeeded: { label: "Finished", tone: "done" },
  failed: { label: "Didn't finish", tone: "failed" },
  cancelled: { label: "Stopped", tone: "stopped" },
};

/** "Brand kit, change round 1" → "Brand kit". */
function baseTitle(title: string): string {
  return title.replace(/, change round \d+$/u, "");
}

export function decisionSentence(decision: Decision): string {
  switch (decision.status) {
    case "pending":
      return "Waiting on your review.";
    case "approved":
      return "You approved it.";
    case "changes_requested":
      return decision.note === undefined || decision.note.trim() === ""
        ? "You asked for changes."
        : `You asked for changes: “${decision.note.trim()}”`;
    case "expired":
      return "The review closed with no decision.";
    case "cancelled":
      return "The review was withdrawn.";
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count.toString()} ${count === 1 ? one : many}`;
}

export function trailEntry(task: ActivityTask, index: number): TrailEntry {
  const round = Number(task.changeRound);
  const title = baseTitle(task.title);
  const headline = task.revision
    ? `Revised the ${title}${round > 0 ? ` (change round ${round.toString()})` : ""}`
    : `Drafted the ${title}`;
  const outcome = OUTCOME[task.status];
  const details: string[] = [];
  if (task.attempts > 1) {
    const failed = task.failedAttempts;
    details.push(
      task.status === "succeeded"
        ? `Took ${plural(task.attempts, "try", "tries")}${failed > 0 ? ` (${plural(failed, "failed try", "failed tries")} retried automatically)` : ""}.`
        : `Tried ${plural(task.attempts, "time", "times")}.`,
    );
  }
  if (task.creditCost > 0n) {
    const cost = Number(task.creditCost);
    const charged = Number(task.charged);
    const refunded = Number(task.refunded);
    if (charged === 0) details.push(`Priced at ${plural(cost, "credit", "credits")}; nothing was charged.`);
    else if (refunded >= charged) details.push(`${plural(charged, "credit", "credits")} charged, then refunded.`);
    else if (refunded > 0) details.push(`${plural(charged, "credit", "credits")} charged, ${refunded.toString()} refunded.`);
    else details.push(`${plural(charged, "credit", "credits")} charged.`);
  } else if (task.status === "failed" || task.status === "cancelled") {
    details.push("Nothing was charged.");
  }
  for (const decision of task.decisions) details.push(decisionSentence(decision));
  return { key: `${task.createdAt.toString()}-${index.toString()}`, at: task.createdAt, headline, outcome: outcome.label, tone: outcome.tone, details };
}

export function trailEntries(tasks: readonly ActivityTask[]): TrailEntry[] {
  return tasks.map(trailEntry);
}

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------

type Deliverable = EmployeeActivity["deliverables"][number];

export type DeliverableRow = {
  readonly key: string;
  readonly title: string;
  readonly label: "Latest draft" | "Earlier draft";
  readonly at: number;
  readonly review: string;
  readonly reviewTone: "ready" | "approved" | "changes_requested" | "draft";
};

export function deliverableRows(deliverables: readonly Deliverable[]): DeliverableRow[] {
  const seen = new Set<string>();
  return deliverables.map((entry, index) => {
    const latest = !seen.has(entry.kind);
    seen.add(entry.kind);
    const review = entry.review;
    const tone: DeliverableRow["reviewTone"] =
      review === null ? "draft"
        : review.status === "pending" ? "ready"
          : review.status === "approved" ? "approved"
            : review.status === "changes_requested" ? "changes_requested" : "draft";
    return {
      key: `${entry.kind}-${entry.createdAt.toString()}-${index.toString()}`,
      title: entry.title,
      label: latest ? "Latest draft" : "Earlier draft",
      at: entry.createdAt,
      review: review === null ? "No review card." : decisionSentence(review),
      reviewTone: tone,
    };
  });
}

export function deliverableCounts(deliverables: readonly Deliverable[]): { drafts: number; approved: number } {
  return {
    drafts: deliverables.length,
    approved: deliverables.filter((entry) => entry.review?.status === "approved").length,
  };
}

// ---------------------------------------------------------------------------
// Ask Wren
// ---------------------------------------------------------------------------

/** The question the "Ask Wren" button puts in the composer. The founder edits or sends it. */
export function askLeadPrompt(name: string, roleLabel: string): string {
  return `What is ${name} (${roleLabel}) working on for us right now, and what do you need from me?`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DATE = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** A short local date and time ("7 Nov, 14:05"). Only client-rendered sections call it, so there is no SSR mismatch. */
export function formatWhen(at: number): string {
  return DATE.format(new Date(at));
}
