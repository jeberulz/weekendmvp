import type { AudienceSlug, BuildTimeValue, CategorySlug, RevenueGoalSlug, ToolSlug } from "../../contracts/taxonomy";
import type { ArticleSpec, SourceSpec } from "../spec";

/**
 * Live ideas that predate the editorial workspace (fictional). The legacy
 * importer records them as "Live — legacy evidence not reverified": no claim
 * ledger, sources unverified, no approval.
 */

type LegacySeed = {
  slug: string;
  title: string;
  category: CategorySlug;
  buildTime: BuildTimeValue;
  revenueGoal: RevenueGoalSlug;
  tools: ToolSlug[];
  audiences: AudienceSlug[];
  buyer: string;
  job: string;
  wedge: string;
  description: string;
  problem: string;
  solution: string;
  steps: [string, string, string];
  market: string;
  competitor: { name: string; price: string; positioning: string };
  price: string;
  stack: string;
  publisher: string;
  host: string;
  firstPublishedAt: string;
};

function legacySpec(seed: LegacySeed): ArticleSpec & { firstPublishedAt: string } {
  const sources: SourceSpec[] = [
    {
      id: `src-${seed.slug.slice(0, 40)}-a`,
      url: `https://${seed.host}/research`,
      publisher: seed.publisher,
      title: `${seed.title}: background`,
      sourceType: "research_report",
      publishedAt: null,
      retrievedDaysAgo: null,
      excerpt: null,
      context: null,
      verification: "unverified",
    },
    {
      id: `src-${seed.slug.slice(0, 40)}-b`,
      url: `https://${seed.competitor.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example/pricing`,
      publisher: seed.competitor.name,
      title: `${seed.competitor.name} pricing`,
      sourceType: "first_party_pricing",
      publishedAt: null,
      retrievedDaysAgo: null,
      excerpt: null,
      context: null,
      verification: "unverified",
    },
  ];
  return {
    slug: seed.slug,
    title: seed.title,
    buyer: seed.buyer,
    job: seed.job,
    wedge: seed.wedge,
    metadata: {
      description: seed.description,
      category: seed.category,
      buildTime: seed.buildTime,
      revenueGoal: seed.revenueGoal,
      tools: seed.tools,
      audiences: seed.audiences,
    },
    problem: [seed.problem],
    solution: [seed.solution],
    steps: [...seed.steps],
    market: [seed.market],
    competitors: [
      seed.competitor,
      { name: "Spreadsheet", price: "Free", positioning: "Manual workaround" },
      { name: "Doing nothing", price: "Free", positioning: "Accepting the loss" },
    ],
    competitionNotes: [`${seed.competitor.name} is the closest paid alternative.`],
    businessModel: [`A simple subscription at ${seed.price}.`],
    tiers: [{ name: "Standard", price: seed.price, includes: "Everything in the weekend build" }],
    stack: [seed.stack, "Convex for data", "Resend for email"],
    prompts: [
      {
        title: "First screen",
        body: `Build the first screen for "${seed.title}": the core list view with empty,\nloading and error states, keyboard navigable.`,
      },
    ],
    sources,
    claims: [],
    firstPublishedAt: seed.firstPublishedAt,
  };
}

/** Scenario: live legacy idea with no editorial record. */
export const menuCostCalculator = legacySpec({
  slug: "menu-cost-calculator-for-food-trucks",
  title: "Menu cost calculator for food trucks",
  category: "productivity",
  buildTime: "8",
  revenueGoal: "1k-month",
  tools: ["bolt", "claude"],
  audiences: ["small-business-owners", "non-technical"],
  buyer: "Food truck owners pricing a changing menu",
  job: "Price each dish so ingredient swings do not erase the margin",
  wedge: "Plate-cost tracking that updates when supplier prices change",
  description: "A plate-cost calculator for food trucks that reprices dishes when supplier prices move.",
  problem:
    "A food truck owner sets menu prices once and watches the margin vanish as avocado and brisket prices climb. Nobody recalculates plate costs mid-season because it means a spreadsheet evening after a twelve-hour shift.",
  solution:
    "Enter each recipe once. When a supplier invoice shows a new price, the calculator updates every affected dish and flags those below the target margin.",
  steps: ["Add recipes with quantities.", "Snap supplier invoices as prices change.", "See which dishes fell below your margin."],
  market: "Food trucks run on thin margins and few tools are built for a menu that changes weekly.",
  competitor: { name: "PlateMath", price: "$25/mo", positioning: "Restaurant costing for fixed menus" },
  price: "$12/month",
  stack: "Bolt for the recipe screens",
  publisher: "Street Food Weekly",
  host: "streetfood-weekly.example",
  firstPublishedAt: "2026-02-11",
});

/**
 * Scenario: legacy page containing an old MDX component. The importer
 * quarantines it: shown as text, never rendered or executed.
 */
export const podcastShowNotes: ArticleSpec & { firstPublishedAt: string } = (() => {
  const spec = legacySpec({
    slug: "podcast-show-notes-generator",
    title: "Show notes generator for indie podcasters",
    category: "creator-tools",
    buildTime: "8",
    revenueGoal: "1k-month",
    tools: ["claude", "v0"],
    audiences: ["creators", "solo-founders"],
    buyer: "Independent podcasters publishing weekly",
    job: "Publish show notes and chapters without an hour of editing",
    wedge: "Timestamped chapters and links drafted from the episode transcript",
    description: "Draft show notes, chapters and links from a podcast transcript in minutes.",
    problem:
      "An indie podcaster finishes editing audio at midnight and still has to write show notes, chapters and a list of every link mentioned. The notes are what listeners search for, and they are the first thing skipped.",
    solution:
      "Upload the transcript; the generator drafts show notes, timestamped chapters and a link list for the host to edit and publish.",
    steps: ["Upload the episode transcript.", "Edit the drafted notes and chapters.", "Publish to your podcast host."],
    market: "Weekly indie shows publish more notes than any other creator format and rarely have help.",
    competitor: { name: "CastNotes", price: "$15/mo", positioning: "Transcription with basic summaries" },
    price: "$10/month",
    stack: "v0 for the editor screen",
    publisher: "Indie Audio Report",
    host: "indie-audio.example",
    firstPublishedAt: "2026-03-04",
  });
  // A component left over from an older page template.
  spec.solution.push('<Callout type="tip">Chapters help listeners jump to the part they came for.</Callout>');
  return spec;
})();

/** Scenario: live legacy idea that gets unpublished. */
export const listingCaptionWriter = legacySpec({
  slug: "listing-caption-writer-for-real-estate-agents",
  title: "Listing caption writer for real-estate agents",
  category: "ai-tools",
  buildTime: "8",
  revenueGoal: "5k-month",
  tools: ["claude", "lovable"],
  audiences: ["marketers", "small-business-owners"],
  buyer: "Independent real-estate agents writing their own listings",
  job: "Write listing captions that follow advertising rules",
  wedge: "Captions checked against fair-advertising wording rules",
  description: "Listing captions for independent agents, checked against advertising wording rules.",
  problem:
    "An agent writes captions for a dozen listings a week and worries that a phrase like 'perfect for young families' breaks advertising rules.",
  solution: "Enter the property facts; the writer drafts captions and flags wording that advertising rules may prohibit.",
  steps: ["Enter the property facts.", "Pick a caption style.", "Review flagged wording before posting."],
  market: "Independent agents write most of their own marketing copy.",
  competitor: { name: "ListWise", price: "$29/mo", positioning: "Listing marketing suite" },
  price: "$19/month",
  stack: "Lovable for the caption editor",
  publisher: "Agent Insider",
  host: "agent-insider.example",
  firstPublishedAt: "2026-01-19",
});

type Filler = Pick<
  LegacySeed,
  "slug" | "title" | "category" | "buyer" | "job" | "problem" | "solution" | "competitor" | "price" | "firstPublishedAt"
>;

const FILLERS: Filler[] = [
  { slug: "chore-rota-for-shared-houses", title: "Chore rota for shared houses", category: "productivity", buyer: "Housemates in shared rentals", job: "Split chores fairly without a whiteboard feud", problem: "Shared houses argue about bins and dishes because nobody remembers whose turn it is.", solution: "A rota that rotates fairly, reminds by text and swaps turns on request.", competitor: { name: "ChoreChart", price: "$3/mo", positioning: "Family chore charts" }, price: "$2/month", firstPublishedAt: "2025-12-02" },
  { slug: "plant-watering-log-for-cafes", title: "Plant watering log for cafés", category: "productivity", buyer: "Café owners with indoor plants", job: "Keep plants alive across shift changes", problem: "Café plants die because every shift assumes the last one watered them.", solution: "A QR code on each pot logs watering and reminds the next shift.", competitor: { name: "LeafLog", price: "$5/mo", positioning: "Home plant care" }, price: "$6/month", firstPublishedAt: "2025-12-09" },
  { slug: "sponsor-tracker-for-newsletters", title: "Sponsor tracker for small newsletters", category: "creator-tools", buyer: "Writers selling newsletter sponsorships", job: "Track sponsor slots, invoices and deliverables", problem: "Small newsletters lose sponsor revenue to forgotten follow-ups and double-booked slots.", solution: "A sponsor calendar with invoices and proof-of-placement links.", competitor: { name: "AdSlot", price: "$20/mo", positioning: "Media kit builder" }, price: "$12/month", firstPublishedAt: "2025-12-16" },
  { slug: "tip-pool-calculator-for-restaurants", title: "Tip pool calculator for restaurants", category: "fintech", buyer: "Restaurant managers splitting tips", job: "Split pooled tips by hours and role without disputes", problem: "Managers split tip pools on paper and staff dispute the maths every week.", solution: "Enter hours and roles; the calculator shows each share and the rule behind it.", competitor: { name: "TipShare", price: "$15/mo", positioning: "Payroll add-on" }, price: "$9/month", firstPublishedAt: "2025-12-23" },
  { slug: "reading-log-for-book-clubs", title: "Reading log for book clubs", category: "education", buyer: "Book club organisers", job: "Pick books and keep everyone on pace", problem: "Book clubs stall when half the group has not finished and nobody knows who has.", solution: "A shared reading log with pace nudges and a vote for the next book.", competitor: { name: "ShelfPal", price: "$4/mo", positioning: "Personal reading tracker" }, price: "$3/month", firstPublishedAt: "2026-01-05" },
  { slug: "equipment-checkout-for-makerspaces", title: "Equipment checkout for makerspaces", category: "b2b", buyer: "Makerspace coordinators", job: "Know who has the laser cutter key", problem: "Makerspaces lose tools and access keys to informal sign-out sheets.", solution: "QR-code checkout with training checks before a member can borrow a tool.", competitor: { name: "LendDesk", price: "$30/mo", positioning: "Library-style lending" }, price: "$19/month", firstPublishedAt: "2026-01-12" },
  { slug: "quote-builder-for-mobile-mechanics", title: "Quote builder for mobile mechanics", category: "b2b", buyer: "Mobile mechanics quoting on site", job: "Send an accurate quote before leaving the driveway", problem: "Mobile mechanics quote from memory and undercharge for parts they forgot.", solution: "A quote builder with parts prices, labour rates and a signature link.", competitor: { name: "GarageQuote", price: "$35/mo", positioning: "Workshop software" }, price: "$14/month", firstPublishedAt: "2026-01-26" },
  { slug: "class-waitlist-for-yoga-studios", title: "Class waitlist for yoga studios", category: "health", buyer: "Small yoga studio owners", job: "Refill cancelled class spots automatically", problem: "Yoga classes run half empty after late cancellations while waitlisted students never hear about the spot.", solution: "Automatic waitlist offers with a claim window and a late-cancel policy.", competitor: { name: "StudioFlow", price: "$49/mo", positioning: "Full studio management" }, price: "$15/month", firstPublishedAt: "2026-02-02" },
  { slug: "release-notes-writer-for-indie-apps", title: "Release notes writer for indie apps", category: "developer-tools", buyer: "Indie app developers", job: "Turn commits into readable release notes", problem: "Indie developers skip release notes because rewriting commit messages for users is tedious.", solution: "Draft user-facing notes from merged pull requests, grouped by feature and fix.", competitor: { name: "ChangeCraft", price: "$12/mo", positioning: "Changelog hosting" }, price: "$8/month", firstPublishedAt: "2026-02-16" },
  { slug: "inventory-alerts-for-etsy-sellers", title: "Inventory alerts for Etsy sellers", category: "ecommerce", buyer: "Etsy sellers making items to order", job: "Stop selling items they have run out of materials for", problem: "Makers oversell because materials run out quietly while listings stay live.", solution: "Link listings to materials and pause them when stock runs low.", competitor: { name: "StockSync", price: "$19/mo", positioning: "Multi-channel inventory" }, price: "$7/month", firstPublishedAt: "2026-02-23" },
  { slug: "meeting-cost-timer-for-small-teams", title: "Meeting cost timer for small teams", category: "productivity", buyer: "Founders of small teams", job: "Make meeting costs visible", problem: "Small teams drift into long meetings because nobody sees what an hour of six people costs.", solution: "A timer that shows the running cost of a meeting from salary bands.", competitor: { name: "MeetMeter", price: "$6/mo", positioning: "Calendar analytics" }, price: "$4/month", firstPublishedAt: "2026-03-09" },
  { slug: "lesson-plan-library-for-tutors", title: "Lesson plan library for tutors", category: "education", buyer: "Independent tutors", job: "Reuse lesson plans across students", problem: "Tutors rebuild the same lesson plans for each student and lose the good ones in email.", solution: "A tagged library of lesson plans with per-student progress notes.", competitor: { name: "TutorDesk", price: "$18/mo", positioning: "Scheduling and billing" }, price: "$8/month", firstPublishedAt: "2026-03-16" },
  { slug: "photo-release-forms-for-event-photographers", title: "Photo release forms for event photographers", category: "creator-tools", buyer: "Event photographers", job: "Collect model releases on the day", problem: "Event photographers chase signed releases for weeks after the shoot.", solution: "A QR-code release form that links each signature to the photos taken.", competitor: { name: "ReleaseKit", price: "$10/mo", positioning: "Generic e-signature" }, price: "$9/month", firstPublishedAt: "2026-03-23" },
  { slug: "rent-reminder-bot-for-landlords", title: "Rent reminder bot for landlords", category: "fintech", buyer: "Landlords collecting rent themselves", job: "Collect rent on time without awkward calls", problem: "Self-managing landlords feel awkward chasing rent and let late payments slide.", solution: "Polite rent reminders by text with a payment link and a record of each message.", competitor: { name: "RentPing", price: "$9/mo", positioning: "Rent collection" }, price: "$6/month", firstPublishedAt: "2026-04-06" },
  { slug: "api-changelog-monitor", title: "API changelog monitor for small teams", category: "developer-tools", buyer: "Small development teams", job: "Notice breaking changes in the APIs they depend on", problem: "Small teams learn about breaking API changes from their error logs.", solution: "Watch the changelogs of the APIs a team uses and alert on breaking changes.", competitor: { name: "DepWatch", price: "$25/mo", positioning: "Package vulnerability alerts" }, price: "$12/month", firstPublishedAt: "2026-04-13" },
  { slug: "volunteer-shift-signup-for-food-banks", title: "Volunteer shift sign-up for food banks", category: "productivity", buyer: "Food bank volunteer coordinators", job: "Fill volunteer shifts without a spreadsheet", problem: "Food banks run short on key shifts because sign-ups live in a shared spreadsheet nobody checks.", solution: "A sign-up page with reminders and a shortfall alert for the coordinator.", competitor: { name: "ShiftBoard", price: "$20/mo", positioning: "General volunteer management" }, price: "$0 for charities", firstPublishedAt: "2026-04-27" },
  { slug: "brand-kit-generator-for-side-projects", title: "Brand kit generator for side projects", category: "ai-tools", buyer: "Side-project builders", job: "Get a usable logo and palette in an evening", problem: "Side projects launch with a default font and no palette because design takes longer than the build.", solution: "Generate a small brand kit: palette, type pairing and a simple mark.", competitor: { name: "LogoLab", price: "$15 once", positioning: "Logo generator" }, price: "$9 once", firstPublishedAt: "2026-05-04" },
  { slug: "returns-portal-for-small-shops", title: "Returns portal for small online shops", category: "ecommerce", buyer: "Small online shop owners", job: "Handle returns without email back-and-forth", problem: "Small shops handle returns by email and lose track of who has sent what back.", solution: "A returns page with labels, reasons and a status the customer can check.", competitor: { name: "ReturnDesk", price: "$29/mo", positioning: "Returns for larger stores" }, price: "$11/month", firstPublishedAt: "2026-05-18" },
  { slug: "habit-tracker-for-physiotherapy-patients", title: "Exercise tracker for physiotherapy patients", category: "health", buyer: "Physiotherapists with home-exercise patients", job: "See whether patients do their exercises", problem: "Patients forget home exercises and physiotherapists only find out at the next appointment.", solution: "A simple daily check-in that shows the physiotherapist adherence before each visit.", competitor: { name: "RehabPal", price: "$25/mo", positioning: "Clinic exercise library" }, price: "$15/month", firstPublishedAt: "2026-06-01" },
  { slug: "cold-email-warmup-checker", title: "Cold email deliverability checker", category: "automation", buyer: "Founders doing their own outreach", job: "Know whether outreach lands in spam before sending", problem: "Founders send outreach from a fresh domain and never learn most of it went to spam.", solution: "A pre-send check of authentication records, content and a seed-inbox test.", competitor: { name: "InboxProbe", price: "$29/mo", positioning: "Deliverability suite" }, price: "$10/month", firstPublishedAt: "2026-06-15" },
];

export const legacyFillers = FILLERS.map((filler) =>
  legacySpec({
    ...filler,
    buildTime: "8",
    revenueGoal: "1k-month",
    tools: ["cursor", "claude"],
    audiences: ["weekend-builders", "side-hustlers"],
    wedge: filler.solution,
    description: `${filler.title}: ${filler.solution}`.slice(0, 300),
    steps: ["Sign up and connect your data.", "Set up the core workflow.", "Review results each week."],
    market: `Weekend builders can reach this buyer where they already gather online.`,
    stack: "Next.js for the web app",
    publisher: "Weekend MVP archive (demo)",
    host: `${filler.slug.split("-")[0]}-notes.example`,
  }),
);
