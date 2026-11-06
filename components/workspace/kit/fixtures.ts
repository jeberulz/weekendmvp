/**
 * HydroTrail fixtures for the workspace kit (data from the S0 canvas extract).
 * Employee names, times and idea facts are sample data, not product copy.
 * Brief bullets are authored placeholders: the extract records their count only.
 */
import type { EmployeeCardData } from "./EmployeeCard";
import type { WorkstreamData } from "./WorkstreamPanel";
import type { BuildPackPromptCardProps } from "./BuildPackPromptCard";
import type { RoleKey } from "@/lib/workspace/contracts/roster";
import type { ApprovalCost, EmployeeIdentity } from "./types";

export const hydrotrailEmployees: readonly EmployeeCardData[] = [
  { id: "iris", name: "Iris", role: "brand", specialty: "Logo, palette, type and voice", status: "needs_you", statusDetail: "Brand kit ready for your OK", autopilot: false },
  { id: "leo", name: "Leo", role: "landing", specialty: "Site, waitlist form and early-access section", status: "done", statusDetail: "Landing and waitlist are live", autopilot: false },
  { id: "sana", name: "Sana", role: "seo", specialty: "Search terms, page titles, first article", status: "working", statusDetail: "Drafting the first article", autopilot: false },
  { id: "marco", name: "Marco", role: "marketing", specialty: "Positioning, weekend launch plan, first-share plan", status: "done", statusDetail: "Launch plan written", autopilot: false },
  { id: "elle", name: "Elle", role: "email", specialty: "4-email waitlist sequence", status: "needs_you", statusDetail: "4 emails ready for your OK", autopilot: false },
  { id: "theo", name: "Theo", role: "social", specialty: "7 launch posts and posting calendar", status: "needs_you", statusDetail: "7 posts ready for your OK", autopilot: false },
  { id: "kai", name: "Kai", role: "engineering", specialty: "PRD slice and phased build pack", status: "needs_you", statusDetail: "Build pack ready for your OK", autopilot: true },
  {
    id: "ada",
    name: "Ada",
    role: "ads",
    specialty: "One $7/day waitlist test",
    status: "queued",
    statusDetail: "Waiting for the approved logo",
    autopilot: false,
    blocker: { waitingOn: "brand", detail: "the creative needs the approved logo" },
  },
];

export const hydrotrailSkippedRoles: readonly { role: RoleKey; reason: string }[] = [
  { role: "merch", reason: "nothing physical to sell" },
  { role: "outbound", reason: "no cold outreach before the waitlist exists" },
  { role: "curriculum", reason: "HydroTrail is an app, not a course" },
  { role: "community", reason: "too early for a community" },
];

export const wrenIdentity: EmployeeIdentity = { name: "Wren", role: "lead" };
export const irisIdentity: EmployeeIdentity = { name: "Iris", role: "brand" };

export const freeCost: ApprovalCost = { kind: "free" };
export const paidCost: ApprovalCost = { kind: "credits", credits: 2, balance: 48 };
export const shortCost: ApprovalCost = { kind: "credits", credits: 4, balance: 2 };

export const hydrotrailCreditStates = {
  normal: { balance: 48, max: 50, plan: "free" },
  low: { balance: 8, max: 50, plan: "free" },
  zero: { balance: 0, max: 50, plan: "free" },
  paid: { balance: 500, max: 500, plan: "builders_hub" },
} as const;

const base = (id: string, name: string, specialty: string, status: EmployeeCardData["status"], statusDetail: string) => ({
  id,
  name,
  specialty,
  status,
  statusDetail,
});

export const hydrotrailWorkstreams: Record<WorkstreamData["kind"], WorkstreamData> = {
  brand: {
    kind: "brand",
    employee: base("iris", "Iris", "Logo, palette, type and voice", "needs_you", "Brand kit ready for your OK"),
    whyHired: "every launch needs a brand the site, emails and posts can share",
    brief: ["Calm, practical, trail-tested", "Palette from glacier and basalt", "One-line voice rules", "Logo lockup on three grounds"],
    outputs: [
      { id: "brand-kit", title: "Brand kit 3x3 board", kindLabel: "Board", status: "ready" },
      { id: "logo", title: "Logo lockup", kindLabel: "Lockup", status: "approved" },
      { id: "voice", title: "Voice & tagline", kindLabel: "Voice", status: "draft" },
    ],
    files: [{ name: "BRAND.md" }, { name: "brand-kit.png" }, { name: "mark.svg" }, { name: "offer images", meta: "2 of 3" }],
    blockers: [],
    holds: [{ holder: "ads" }, { holder: "you", detail: "final logo upload" }],
  },
  landing: {
    kind: "landing",
    employee: base("leo", "Leo", "Site, waitlist form and early-access section", "done", "Landing and waitlist are live"),
    whyHired: "the first 50 signups need somewhere to land",
    brief: ["One-screen hero with the waitlist form", "Early-access app preview", "Privacy page"],
    outputs: [
      { id: "landing-page", title: "Landing page", kindLabel: "Page", status: "approved" },
      { id: "waitlist-form", title: "Waitlist form", kindLabel: "Form", status: "approved" },
      { id: "early-access", title: "Early-access section", kindLabel: "Section", status: "approved" },
    ],
    files: [{ name: "LANDING.md" }, { name: "hero-ridge.svg" }, { name: "waitlist-signups.csv" }],
    blockers: [{ waitingOn: "engineering", detail: "product screenshots for the preview", severity: "soft" }],
    holds: [],
  },
  seo: {
    kind: "seo",
    employee: base("sana", "Sana", "Search terms, page titles, first article", "working", "Drafting the first article"),
    whyHired: "search is a slow, free channel worth starting early",
    brief: ["Terms hikers actually search", "A title for every page", "One article that earns links"],
    outputs: [
      { id: "terms", title: "Search terms", kindLabel: "List", status: "approved" },
      { id: "titles", title: "12 page titles", kindLabel: "List", status: "approved" },
      { id: "article", title: "First article", kindLabel: "Article", status: "draft" },
    ],
    files: [{ name: "SEARCH_TERMS.md" }, { name: "page-titles.csv" }, { name: "article.md" }],
    blockers: [],
    holds: [],
  },
  marketing: {
    kind: "marketing",
    employee: base("marco", "Marco", "Positioning, weekend launch plan, first-share plan", "done", "Launch plan written"),
    whyHired: "someone has to turn the idea into a weekend plan",
    brief: ["One-liner a hiker repeats", "Fri to Sun launch checklist", "A first-share message you can send", "Where to post", "What to skip"],
    outputs: [
      { id: "positioning", title: "Positioning one-liner", kindLabel: "Copy", status: "approved" },
      { id: "launch-plan", title: "Weekend launch plan", kindLabel: "Plan", status: "approved" },
      { id: "first-share", title: "First-share message", kindLabel: "Copy", status: "ready" },
      { id: "channels", title: "Channel plan", kindLabel: "Plan", status: "approved" },
    ],
    files: [{ name: "POSITIONING.md" }, { name: "LAUNCH_PLAN.md" }, { name: "share message" }, { name: "CHANNEL_PLAN.md" }],
    blockers: [{ waitingOn: "social", detail: "posts to schedule around", severity: "soft" }],
    holds: [{ holder: "you", detail: "first share" }],
  },
  email: {
    kind: "email",
    employee: base("elle", "Elle", "4-email waitlist sequence", "needs_you", "4 emails ready for your OK"),
    whyHired: "a waitlist only works if the first emails land well",
    brief: ["Welcome, then three value emails", "Sent from your business address", "No hard sell"],
    outputs: [
      { id: "sequence", title: "4-email sequence", kindLabel: "Sequence", status: "ready" },
      { id: "welcome", title: "Welcome email", kindLabel: "Email", status: "ready" },
    ],
    files: [{ name: "EMAIL_SEQUENCE.md" }, { name: "welcome-email.html" }],
    blockers: [{ waitingOn: "brand", detail: "the approved brand kit", severity: "soft" }],
    holds: [],
  },
  social: {
    kind: "social",
    employee: base("theo", "Theo", "7 launch posts and posting calendar", "needs_you", "7 posts ready for your OK"),
    whyHired: "launch weekend needs posts ready to copy",
    brief: ["One post a day from Friday", "Copy-ready for personal accounts", "A posting calendar"],
    outputs: [
      { id: "posts", title: "7 launch posts", kindLabel: "Posts", status: "ready" },
      { id: "calendar", title: "Posting calendar", kindLabel: "Calendar", status: "draft" },
    ],
    files: [{ name: "SOCIAL_POSTS.md" }, { name: "posting-calendar.csv" }],
    blockers: [{ waitingOn: "you", detail: "connect an account to schedule", severity: "blocking" }],
    holds: [],
  },
  engineering: {
    kind: "engineering",
    employee: base("kai", "Kai", "PRD slice and phased build pack", "needs_you", "Build pack ready for your OK"),
    whyHired: "an app idea needs a product build, not just a page",
    brief: ["Lock the one loop", "Mobile web, installable", "One login, offline-first", "Four phases, eight prompts", "Do not build billing"],
    outputs: [
      { id: "prd", title: "PRD slice", kindLabel: "PRD", status: "approved" },
      { id: "build-pack", title: "Phased build pack (8 prompts)", kindLabel: "Pack", status: "ready" },
    ],
    files: [{ name: "PRD.md" }, { name: "PRODUCT_PROMPTS.md" }, { name: "carry-checks.csv" }],
    blockers: [{ waitingOn: "brand", detail: "the approved brand kit", severity: "soft" }],
    holds: [{ holder: "landing" }],
  },
  ads: {
    kind: "ads",
    employee: base("ada", "Ada", "One $7/day waitlist test", "queued", "Waiting for the approved logo"),
    whyHired: "a small paid test helps the 50-signup goal",
    brief: ["One campaign at $7 a day", "14-day learning window", "$98 cap"],
    outputs: [
      { id: "campaign", title: "Waitlist test $7/day", kindLabel: "Campaign", status: "draft" },
      { id: "readiness", title: "Readiness checks", kindLabel: "Checks", status: "draft" },
      { id: "log", title: "Decision log", kindLabel: "Log", status: "draft" },
    ],
    files: [{ name: "ADS_DECISION_LOG.md" }, { name: "ad-creative-draft.png" }],
    blockers: [{ waitingOn: "brand", detail: "the creative needs the approved logo", severity: "blocking" }],
    holds: [],
  },
};

export const hydrotrailPrompt: BuildPackPromptCardProps = {
  index: 2,
  duration: "30 MIN",
  title: "Data model + carry formula",
  tool: "Claude Code",
  body: "Define the Plan and Hike types.\nWrite carryLitres(distanceKm, heatC, climbM).\nAdd unit tests for three routes.",
  doNotBuild: "accounts beyond one login, billing, or a map screen.",
  doneWhen: "carryLitres passes its tests and the types compile.",
};
