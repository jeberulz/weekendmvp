/**
 * Synthetic contract v2 research record for the compiler and final-artifact
 * audit tests (WP46-S4). Built the way the pipeline builds a record:
 * synthetic source pages → acceptEvidence → a ResearchRecordV2 → JSON round
 * trip → parseResearchRecord. No evidence id is hard-coded (ruling R1
 * hashes the typed claim into the id), nothing touches the network or a paid
 * provider, and nothing is written to disk here.
 *
 * The editorial prose is long enough (about 2,700 words compiled) that a
 * clean compile passes the whole deep audit, including the 2,200-word floor.
 * Writer text is figure-free (rulings R6 and R10): no digits, number words or
 * double-quoted spans outside evidence tokens. Figures appear only in the
 * proposal slots (tier prices, unit-economics values, Year-One counts and
 * seats) and in evidence.
 */

import { createHash } from "node:crypto";

import { acceptEvidence, type SourceInput } from "../evidence/accept.ts";
import { canonicalSourceUrl } from "../evidence/citation.ts";
import type {
  AcceptedEvidence,
  CommunityQuoteEvidence,
  CompetitorPriceEvidence,
  EditorialFieldsV2,
  ExtractionCandidates,
  MarketStatEvidence,
  ResearchRecordV2,
  SourceAcquisition,
  SourceRole,
} from "../evidence/contract.ts";
import { parseResearchRecord } from "../research-record.ts";

export const FIXTURE_RETRIEVED_AT = "2026-09-30T12:00:00.000Z";
/** The page slug tests compile to (an engine draft, so it can never ship). */
export const FIXTURE_PAGE_SLUG = "engine-draft-signalpass";

export type FixturePage = { url: string; title: string; roles: SourceRole[]; text?: string };

export const FIXTURE_PAGES = {
  report: {
    url: "https://research.example.com/ai-code-review-market",
    title: "AI code review market report",
    roles: ["market"],
    text: "Market overview. The AI code review market was valued at $1.4 billion in 2025. Analysts expect the AI code review market to reach $10.8 billion by 2034.",
  },
  survey: {
    url: "https://survey.example.org/developer-tools-2025",
    title: "Developer tools survey 2025",
    roles: ["market"],
    text: "Developer survey results. In 2025, 62% of developers used AI code review assistants at work.",
  },
  coderabbit: {
    url: "https://www.coderabbit.ai/pricing",
    title: "CodeRabbit pricing",
    roles: ["competitors"],
    text: "Pricing\nLite\n$12/user/month, billed annually\nPull request summaries.\nPro\n$24/user/month, billed annually\nUnlimited reviews for private repositories.\nEnterprise\nCustom pricing",
  },
  graphite: {
    url: "https://graphite.dev/pricing",
    title: "Graphite pricing",
    roles: ["competitors"],
    text: "Graphite pricing\nTeam\n$40/user/month\nStacked pull requests with automated review.",
  },
  qodo: {
    url: "https://www.qodo.ai/pricing",
    title: "Qodo pricing",
    roles: ["competitors"],
    text: "Qodo plans\nTeams\n$30/user/month, billed annually\nCode review agents for growing teams.",
  },
  roundup: {
    url: "https://reviews.example.com/best-ai-code-review-tools",
    title: "Best AI code review tools",
    roles: ["competitors"],
    text: "Best AI code review tools this year. Sourcery costs $12/user/month for its Pro plan. Codacy costs $15/user/month on the Team plan.",
  },
  hn: {
    url: "https://news.ycombinator.com/item?id=27515468",
    title: "Ask HN: Is AI code review worth it?",
    roles: ["community"],
    text: "Comment: We review 12 pull requests a day and the bot comments on every single one of them. Reply: agreed, the rest is noise.",
  },
  forum: {
    url: "https://forum.example.com/t/ai-review-noise",
    title: "AI review noise",
    roles: ["community"],
    text: "Our bot leaves forty comments per PR\nand nobody reads any of them anymore. We switched the bot off for a week and nobody noticed the difference.",
  },
  lobsters: {
    url: "https://lobste.rs/s/abc123/review_noise",
    title: "Review noise",
    roles: ["community"],
    text: "Thread. Our CI posts *three* bot reviews per change and each one says the C# code looks fine, which helps nobody. More later.",
  },
  // Cited by the community search but never read (no text): unreadable.
  reddit: {
    url: "https://www.reddit.com/r/ExperiencedDevs/comments/abc123/review_load/",
    title: "r/ExperiencedDevs",
    roles: ["community"],
  },
} satisfies Record<string, FixturePage>;

export type FixturePages = { [K in keyof typeof FIXTURE_PAGES]: FixturePage };

/** The review's rejected claim (F1): not on the cited page, so never accepted. */
export const REJECTED_QUOTE = "We review 47 PRs a week on a team of 8 and it eats 60% of our time versus 25% coding.";

const VENDORS = ["CodeRabbit", "Graphite", "Qodo", "Sourcery", "Codacy"];

function candidatesFor(pages: FixturePages): ExtractionCandidates {
  return {
  quotes: [
    { sourceUrl: pages.hn.url, text: "We review 12 pull requests a day and the bot comments on every single one of them." },
    { sourceUrl: pages.forum.url, text: "Our bot leaves forty comments per PR and nobody reads any of them anymore." },
    {
      sourceUrl: pages.lobsters.url,
      text: "Our CI posts *three* bot reviews per change and each one says the C# code looks fine, which helps nobody.",
    },
    { sourceUrl: pages.forum.url, text: "We switched the bot off for a week and nobody noticed the difference." },
    { sourceUrl: pages.hn.url, text: REJECTED_QUOTE },
    {
      sourceUrl: pages.reddit.url,
      text: "Reviewing AI generated pull requests now takes longer than writing the code myself.",
    },
  ],
  marketStats: [
    {
      sourceUrl: pages.report.url,
      supportingText: "The AI code review market was valued at $1.4 billion in 2025.",
      subject: "AI code review market",
      metric: "market_size",
      amountText: "$1.4 billion",
      year: 2025,
      periodKind: "measured",
    },
    {
      sourceUrl: pages.report.url,
      supportingText: "Analysts expect the AI code review market to reach $10.8 billion by 2034.",
      subject: "AI code review market",
      metric: "market_size",
      amountText: "$10.8 billion",
      year: 2034,
      periodKind: "projected",
    },
    {
      sourceUrl: pages.survey.url,
      supportingText: "In 2025, 62% of developers used AI code review assistants at work.",
      subject: "developers using AI code review assistants",
      metric: "adoption",
      amountText: "62%",
      year: 2025,
      periodKind: "measured",
    },
  ],
  competitorPrices: [
    {
      vendor: "CodeRabbit",
      sourceUrl: pages.coderabbit.url,
      supportingText: "Lite\n$12/user/month, billed annually",
      plan: "Lite",
      priceText: "$12/user/month, billed annually",
    },
    {
      vendor: "CodeRabbit",
      sourceUrl: pages.coderabbit.url,
      supportingText: "Pro\n$24/user/month, billed annually",
      plan: "Pro",
      priceText: "$24/user/month, billed annually",
    },
    {
      vendor: "Graphite",
      sourceUrl: pages.graphite.url,
      supportingText: "Team\n$40/user/month",
      plan: "Team",
      priceText: "$40/user/month",
    },
    {
      vendor: "Qodo",
      sourceUrl: pages.qodo.url,
      supportingText: "Teams\n$30/user/month, billed annually",
      plan: "Teams",
      priceText: "$30/user/month, billed annually",
    },
    {
      vendor: "Sourcery",
      sourceUrl: pages.roundup.url,
      supportingText: "Sourcery costs $12/user/month for its Pro plan.",
      plan: "Pro",
      priceText: "$12/user/month",
    },
    {
      vendor: "Codacy",
      sourceUrl: pages.roundup.url,
      supportingText: "Codacy costs $15/user/month on the Team plan.",
      plan: "Team",
      priceText: "$15/user/month",
    },
  ],
};
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`fixture: missing ${label}`);
  return value;
}

function canonical(url: string): string {
  return must(canonicalSourceUrl(url), `canonical form of ${url}`);
}

function acquisitionInput(pages: ReadonlyArray<FixturePage>): Map<string, SourceInput> {
  return new Map(
    pages.map((p): [string, SourceInput] => [
      p.url,
      p.text === undefined
        ? { status: "unreadable" }
        : { status: "read", text: p.text, retrievedAt: FIXTURE_RETRIEVED_AT, textSha256: sha256(p.text) },
    ]),
  );
}

/** One acquisition entry per distinct canonical URL (roles merged). */
function sourceList(pages: ReadonlyArray<FixturePage>): SourceAcquisition[] {
  const byUrl = new Map<string, FixturePage & { roles: SourceRole[] }>();
  for (const page of pages) {
    const url = canonical(page.url);
    const seen = byUrl.get(url);
    if (seen) {
      for (const role of page.roles) if (!seen.roles.includes(role)) seen.roles.push(role);
    } else {
      byUrl.set(url, { ...page, roles: [...page.roles] });
    }
  }
  return [...byUrl.values()].map((p): SourceAcquisition =>
    p.text === undefined
      ? { url: canonical(p.url), roles: [...p.roles], status: "unreadable", detail: "HTTP 403 from www.reddit.com" }
      : {
          url: canonical(p.url),
          roles: [...p.roles],
          status: "read",
          retrievedAt: FIXTURE_RETRIEVED_AT,
          textSha256: sha256(p.text),
        },
  );
}

type Acceptance = ReturnType<typeof acceptEvidence>;

function acceptPages(pages: FixturePages, extra: Partial<ExtractionCandidates> = {}): Acceptance {
  const all = Object.values(pages);
  const base = candidatesFor(pages);
  return acceptEvidence({
    candidates: {
      quotes: [...base.quotes, ...(extra.quotes ?? [])],
      marketStats: [...base.marketStats, ...(extra.marketStats ?? [])],
      competitorPrices: [...base.competitorPrices, ...(extra.competitorPrices ?? [])],
    },
    citations: all.map((p) => ({ url: p.url, title: p.title })),
    sources: acquisitionInput(all),
    vendorHints: VENDORS,
  });
}

function isKind<K extends AcceptedEvidence["kind"]>(
  item: AcceptedEvidence,
  kind: K,
): item is Extract<AcceptedEvidence, { kind: K }> {
  return item.kind === kind;
}

function find<K extends AcceptedEvidence["kind"]>(
  acceptance: Acceptance,
  kind: K,
  predicate: (item: Extract<AcceptedEvidence, { kind: K }>) => boolean,
  label: string,
): Extract<AcceptedEvidence, { kind: K }> {
  for (const item of acceptance.accepted) {
    if (isKind(item, kind) && predicate(item)) return item;
  }
  throw new Error(`fixture: ${label} was not accepted`);
}

/** The accepted evidence the fixture selects, by role. */
export type FixtureEvidence = {
  statMeasured: MarketStatEvidence;
  statProjected: MarketStatEvidence;
  statAdoption: MarketStatEvidence;
  priceLite: CompetitorPriceEvidence;
  pricePro: CompetitorPriceEvidence;
  priceGraphite: CompetitorPriceEvidence;
  priceQodo: CompetitorPriceEvidence;
  priceSourcery: CompetitorPriceEvidence;
  priceCodacy: CompetitorPriceEvidence;
  quoteHn: CommunityQuoteEvidence;
  quoteForum: CommunityQuoteEvidence;
  quoteLobsters: CommunityQuoteEvidence;
  /** Accepted but not selected by community.quoteIds. */
  quoteUnselected: CommunityQuoteEvidence;
};

function evidenceRoles(acceptance: Acceptance, pages: FixturePages): FixtureEvidence {
  const at = (page: FixturePage) => canonical(page.url);
  return {
    statMeasured: find(acceptance, "market_stat", (e) => e.amount.value === "1.4", "measured stat"),
    statProjected: find(acceptance, "market_stat", (e) => e.period.kind === "projected", "projected stat"),
    statAdoption: find(acceptance, "market_stat", (e) => e.metric === "adoption", "adoption stat"),
    priceLite: find(acceptance, "competitor_price", (e) => e.vendor === "CodeRabbit" && e.plan === "Lite", "CodeRabbit Lite"),
    pricePro: find(acceptance, "competitor_price", (e) => e.vendor === "CodeRabbit" && e.plan === "Pro", "CodeRabbit Pro"),
    priceGraphite: find(acceptance, "competitor_price", (e) => e.vendor === "Graphite", "Graphite price"),
    priceQodo: find(acceptance, "competitor_price", (e) => e.vendor === "Qodo", "Qodo price"),
    priceSourcery: find(acceptance, "competitor_price", (e) => e.vendor === "Sourcery", "Sourcery price"),
    priceCodacy: find(acceptance, "competitor_price", (e) => e.vendor === "Codacy", "Codacy price"),
    quoteHn: find(acceptance, "community_quote", (e) => e.sourceUrl === at(pages.hn), "HN quote"),
    quoteForum: find(
      acceptance,
      "community_quote",
      (e) => e.sourceUrl === at(pages.forum) && e.excerpt.startsWith("Our bot"),
      "forum quote",
    ),
    quoteLobsters: find(acceptance, "community_quote", (e) => e.sourceUrl === at(pages.lobsters), "lobste.rs quote"),
    quoteUnselected: find(
      acceptance,
      "community_quote",
      (e) => e.sourceUrl === at(pages.forum) && e.excerpt.startsWith("We switched"),
      "unselected forum quote",
    ),
  };
}

const DEFAULT_ACCEPTANCE = acceptPages(FIXTURE_PAGES);

/** The selected evidence of the default fixture. */
export const EV: FixtureEvidence = evidenceRoles(DEFAULT_ACCEPTANCE, FIXTURE_PAGES);

/** Rejections from acceptance (the 47-PR quote and the unreadable Reddit page). */
export const FIXTURE_REJECTED = DEFAULT_ACCEPTANCE.rejected;

/** `[[ev:<id>]]` for an accepted item. */
export function tok(item: AcceptedEvidence): string {
  return `[[ev:${item.id}]]`;
}

const PROBLEM = [
  "Indie developers and small engineering teams maintaining GitHub repositories are merging more AI-assisted code than ever, and review has quietly become the bottleneck. Authors can now produce a large change in an afternoon, but the person who has to approve it still reads every line by hand. On a small team that person is usually the most senior engineer, the one who also owns architecture decisions, production incidents and the onboarding of new contributors.",
  "The problem is not a lack of tools. Most of these teams already run an automated reviewer, and the result is a different kind of noise. Bots comment on formatting that the linter already handles, restate the diff in friendlier words, and flag speculative risks that turn out to be fine. Each comment has to be read, judged and dismissed, so the bot adds a step instead of removing one. Maintainers describe a slow drift: first they skim the bot's comments, then they skip them, and eventually the one comment that mattered is buried under a pile of suggestions nobody asked for.",
  "Generated code makes this worse in a specific way. A human reviewer normally leans on context about the author: their habits, the order of their commits, the mistakes they tend to make. Code written with an assistant arrives without those signals. It often looks polished while taking a needlessly general approach, ignoring a helper that already exists in the repository, or handling an edge case in a way that contradicts a decision the team made months ago. The reviewer has to reconstruct the intent before deciding whether the change is safe, and that reconstruction is the expensive part.",
  "The cost shows up in several places. Pull requests wait longer for a first human look, so authors switch context and lose momentum. Senior engineers spend their best hours reading diffs instead of designing the next feature. Junior contributors get terse, asynchronous corrections instead of the explanation that would help them learn the codebase. None of this appears on an invoice, which is why teams tolerate it for so long.",
  "What these teams want is not more comments. They want a short, trustworthy answer to a pair of questions on every pull request: what actually changed, and is there anything here a senior engineer must look at before merging. If a tool can answer those questions in the repository's own terms, and stay silent when there is nothing worth saying, it protects the scarcest resource on a small team: the attention of the people who know the system best.",
].join("\n\n");

const SOLUTION = [
  "SignalPass is a quiet reviewer for small GitHub teams. It installs as a GitHub App, reads the repository's merged history and conventions, and posts a single review on each pull request: a plain-language summary of what changed and a short list of the risks that deserve a human look. Everything else stays out of the thread.",
  "The summary is written for the reviewer, not the author. It groups changed files by behavior instead of by path, names the functions and data flows that moved, and points out where the change departs from patterns the repository already uses. A reviewer can read it quickly and decide where to spend attention, instead of rebuilding the story of the change from a long diff.",
  "The risk list is deliberately short. A finding only appears when SignalPass can tie it to a specific line, a specific reason and something concrete in the repository, such as a test that no longer covers a branch or a helper that the new code duplicates. Findings that cannot meet that bar are dropped rather than posted as maybes, because a speculative comment costs a reviewer the same time as a real one.",
  "Teams stay in control of the volume. Every finding carries a pair of buttons, useful and noise, and SignalPass learns from both. If a team keeps dismissing a category of finding, SignalPass stops raising it for that repository; if a reviewer confirms a finding, similar issues rank higher next time. The goal is a reviewer that becomes quieter and more precise the longer a team uses it, which is the opposite of how most bots age.",
].join("\n\n");

function competitiveNarrative(ev: FixtureEvidence): string {
  return [
    `The category is crowded with capable products, which is useful evidence that teams pay for automated review. CodeRabbit sells broad per-seat review at ${tok(ev.pricePro)}. Graphite bundles review into a stacked pull request workflow, which suits teams that already work that way. Qodo focuses on review agents for growing teams, and roundup sites list Sourcery and Codacy as cheaper options with a narrower scope.`,
    "What these products share is breadth: they try to comment on everything, and they price for teams that want coverage across many repositories. SignalPass competes on the opposite axis. It is built for teams that want fewer, better comments, and it measures success by how little a reviewer has to read. That focus is easy to explain on a landing page and hard for a broad platform to copy without upsetting customers who pay for coverage. It also means SignalPass does not need feature parity to win its first customers; it needs to be visibly quieter and more accurate on their own repositories.",
  ].join("\n\n");
}

const STACK_NOTES =
  "Build SignalPass as a GitHub App backed by a small Next.js service. Webhooks for pull request and review events land in a queue, so a burst of pushes never blocks the app, and a worker fetches only the changed files plus the repository context it needs. Keep the repository profile in Postgres as plain rows (conventions, helpers, dismissed finding types) so the review step can load it in one query and the team can inspect what SignalPass believes about their code. Call a hosted model for the summary and for checking candidate findings, and keep every prompt, model version and finding outcome in the database so a bad review can be traced and fixed. Use Stripe Billing for the team plan and count active developers from pull request authors rather than seats, which matches how the pricing is explained on the landing page.";

const BRAND_BRIEF =
  "SignalPass should feel like a calm senior colleague, not a robot. Use a restrained palette of ink, off-white and one signal green reserved for the single most important finding. Typography should be compact and readable next to GitHub's own interface. The voice is plain and specific, admits uncertainty, and never uses alarm language. Avoid mascots, neon gradients, sparkles and any claim that SignalPass replaces human reviewers.";

/** The base record before validation; tests may change it through `adjust`. */
function baseRecord(pages: FixturePages, acceptance: Acceptance, ev: FixtureEvidence): ResearchRecordV2 {
  const editorial: EditorialFieldsV2 = {
    productName: "SignalPass",
    dontBuildYet:
      "Do not build IDE plugins, self-hosted runners or automatic merge approval in the first month; the weekend version only reviews pull requests on GitHub and explains its reasoning.",
    problemNarrative: PROBLEM,
    solutionNarrative: SOLUTION,
    competitiveNarrative: competitiveNarrative(ev),
    pricingTiers: [
      { name: "Open Source", price: "Free", includes: "Unlimited public repositories, the full review summary and community support." },
      { name: "Solo", price: "$12/month", includes: "One private repository for an individual developer, with learning from dismissed findings." },
      {
        name: "Crew",
        price: "$20/developer/month",
        includes: "Unlimited private repositories, shared team rules, finding analytics and priority processing.",
      },
    ],
    unitEconomics: [
      { label: "Model cost per reviewed pull request", value: "$0.04 per pull request" },
      { label: "Gross margin target on Crew after prompt caching", value: "80% gross margin" },
      { label: "Paid developers in an average Crew account", value: "5 developers" },
    ],
    stackNotes: STACK_NOTES,
    audienceShort: "small GitHub teams",
    brandBrief: BRAND_BRIEF,
    yearOne: {
      funnel: [
        { stage: "GitHub Marketplace and outreach visitors", count: 1200 },
        { stage: "Private-repository trials", count: 120 },
        { stage: "Paying Crew accounts", count: 45 },
      ],
      tier: "Crew",
      payingAccounts: 45,
      seatsPerAccount: 5,
      assumptions:
        "A typical Crew account pays for a small team of developers; trials convert after a short evaluation on one private repository.",
    },
    dataModel: [
      { table: "repositories", columns: "id uuid pk, workspace_id uuid fk, github_repo_id bigint unique, full_name text, default_branch text" },
      { table: "pull_requests", columns: "id uuid pk, repository_id uuid fk, number int, head_sha text, author_login text, opened_at timestamptz" },
      { table: "reviews", columns: "id uuid pk, pull_request_id uuid fk, summary text, model_version text, created_at timestamptz" },
      {
        table: "findings",
        columns: "id uuid pk, review_id uuid fk, file_path text, line int, reason text, outcome text check (outcome in ('useful','noise','pending'))",
      },
    ],
  };
  return {
    contractVersion: 2,
    pipelineVersion: 2,
    mode: "fixture",
    brief: {
      title: "AI Code Reviewer for Small Teams",
      slug: "signalpass",
      oneLiner: "A quiet, repository-aware sanity check for every pull request on small GitHub teams.",
      targetCustomer: "Indie developers and small engineering teams maintaining GitHub repositories",
    },
    evidence: {
      contractVersion: 1,
      accepted: acceptance.accepted,
      rejected: acceptance.rejected,
      sources: sourceList(Object.values(pages)),
    },
    market: {
      summary: `AI code review is an established and growing category. One market report sizes it at ${tok(ev.statMeasured)} and expects ${tok(ev.statProjected)}, and a developer survey puts adoption at ${tok(ev.statAdoption)} of developers. Those figures describe the whole category rather than small teams, so they show that buyers exist, not how many of them a new product can reach. The more useful signal for a small product is qualitative: teams already pay for review tools and still complain about noise, which is the gap SignalPass is designed to fill.`,
      statIds: [ev.statMeasured.id, ev.statProjected.id, ev.statAdoption.id],
    },
    competitors: [
      {
        name: "CodeRabbit",
        priceIds: [ev.priceLite.id, ev.pricePro.id],
        notes: "Broad per-seat review across every repository, with summaries on the cheaper plan and unlimited reviews on Pro.",
      },
      {
        name: "Graphite",
        priceIds: [ev.priceGraphite.id],
        notes: "Bundles review with stacked pull requests, which suits teams already living in its workflow.",
      },
      { name: "Qodo", priceIds: [ev.priceQodo.id] },
      {
        name: "Sourcery",
        priceIds: [ev.priceSourcery.id],
        notes: "Refactoring suggestions first and review second, a reasonable fit for Python-heavy teams.",
      },
      {
        name: "Codacy",
        priceIds: [ev.priceCodacy.id],
        notes: "Static analysis dashboards with review attached, aimed at teams that already track code quality.",
      },
    ],
    community: {
      summary: `Small teams describe review fatigue rather than a lack of tooling. One maintainer summed up the daily load as ${tok(ev.quoteHn)}, and others say the volume of bot comments has taught everyone to stop reading them.`,
      quoteIds: [ev.quoteHn.id, ev.quoteForum.id, ev.quoteLobsters.id],
    },
    keywords: [
      { term: "ai code review", volume: 2400, competition: 0.42, cpc: 6.5, source: "provider" },
      { term: "automated pull request review", volume: 320, competition: 0.31, cpc: 4.1, source: "provider" },
    ],
    goToMarket: {
      positioning:
        "SignalPass is the quiet reviewer for small GitHub teams: one clear summary per pull request and only the risks a senior engineer should see, explained in the repository's own terms.",
      channels: [
        "GitHub Marketplace listing aimed at small private repositories",
        "Free reviews for open-source maintainers whose public pull requests show SignalPass at work",
        "Founder-led outreach to engineering leads already using AI coding assistants",
        "Short write-ups comparing noisy bot output with SignalPass reviews on real pull requests",
      ],
      pricingNotes: `Price below per-seat incumbents such as ${tok(ev.pricePro)} with one simple team plan, keep public repositories free as a distribution channel, and charge only for developers who open pull requests.`,
    },
    whyNow:
      "AI-generated code is increasing review load faster than small teams can add reviewers, and noisy bots have taught developers to ignore automated comments entirely.",
    howItWorks: [
      "Connect — Install the GitHub App on one repository and choose the branches SignalPass should watch; setup takes a few minutes.",
      "Learn — SignalPass reads merged pull requests, tests and past review comments to build a short profile of the repository's conventions and helpers.",
      "Review — Each new pull request gets one summary of what changed and a short list of risks, each tied to a line, a reason and evidence from the repository.",
      "Tune — Reviewers mark each finding as useful or noise, and SignalPass lowers the volume of anything the team keeps dismissing.",
    ],
    scores: { opportunity: 7.5, pain: 8, timing: 8, builderConfidence: 7, execution: 7.5 },
    editorial,
    provenance: {
      providerCalls: [
        { provider: "fixture", operation: "synthesis:fixture-synthesis", costUsd: 0 },
        { provider: "fixture", operation: "search:fixture-search", costUsd: 0 },
      ],
      costUsd: 0,
      ranAt: "2026-09-30T12:05:00.000Z",
      models: { synthesis: "fixture-synthesis", search: "fixture-search", keywordData: "fixture-keywords" },
      attempts: {
        brief_normalization: 1,
        market_stats: 1,
        competitors: 1,
        community_signals: 2,
        evidence_extraction: 1,
        keywords_demand: 1,
        editorial_synthesis: 1,
      },
    },
  };
}

type PagePatches = Partial<{ [K in keyof FixturePages]: Partial<FixturePage> }>;

function patchPages(overrides: PagePatches): FixturePages {
  const page = <K extends keyof FixturePages>(key: K): FixturePage => ({ ...FIXTURE_PAGES[key], ...overrides[key] });
  return {
    report: page("report"),
    survey: page("survey"),
    coderabbit: page("coderabbit"),
    graphite: page("graphite"),
    qodo: page("qodo"),
    roundup: page("roundup"),
    hn: page("hn"),
    forum: page("forum"),
    lobsters: page("lobsters"),
    reddit: page("reddit"),
  };
}

/**
 * A validated fixture record. `adjust` edits the plain object first (for a
 * variant such as another year-one plan) and receives the selected evidence;
 * the result is JSON round-tripped and parsed with parseResearchRecord,
 * exactly as a CLI would read it. `pages` replaces source pages (URL, title,
 * text) and `extraCandidates` adds extraction candidates; either re-runs
 * acceptance, so every id follows from the sources (find extra items in
 * record.evidence.accepted inside `adjust`).
 */
export function buildFixtureRecord(
  adjust?: (record: ResearchRecordV2, ev: FixtureEvidence) => void,
  options: { pages?: PagePatches; extraCandidates?: Partial<ExtractionCandidates> } = {},
): ResearchRecordV2 {
  let pages: FixturePages = FIXTURE_PAGES;
  let acceptance = DEFAULT_ACCEPTANCE;
  let ev = EV;
  if (options.pages || options.extraCandidates) {
    pages = options.pages ? patchPages(options.pages) : FIXTURE_PAGES;
    acceptance = acceptPages(pages, options.extraCandidates);
    ev = evidenceRoles(acceptance, pages);
  }
  const record = baseRecord(pages, acceptance, ev);
  adjust?.(record, ev);
  const json: unknown = JSON.parse(JSON.stringify(record));
  return parseResearchRecord(json);
}

/** Replace the editorial fields (merged over the base) of a fixture record. */
export function withEditorial(patch: Partial<EditorialFieldsV2>): (record: ResearchRecordV2) => void {
  return (record) => {
    record.editorial = { ...record.editorial, ...patch };
  };
}
