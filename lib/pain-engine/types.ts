/**
 * Pain Engine (Phase 1) — shared types.
 *
 * This is a NEW engine, separate from the old idea engine in `lib/engine/`.
 * It does not read or write `engine/records/`, does not use the Source Critic
 * gate, and nothing here can publish an idea on its own: drafts land in the
 * single-approval review queue under `engine/pain/review/` and wait for one
 * human approve/reject.
 *
 * Evidence rule (hard): every fact in a draft must trace to a PainFinding
 * below. If a field cannot be filled from real evidence it is omitted or
 * flagged in the draft's `gaps` list — never invented.
 */

/** One raw pain signal from one source. */
export interface PainFinding {
  /** Listener that produced this finding, e.g. "hacker-news". */
  source: string;
  /** Canonical URL of the post / issue / review / request. */
  url: string;
  /** Short title of the source item. */
  title: string;
  /** The pain text itself (post body, comment, review, issue body). */
  text: string;
  /** Who said it, where — e.g. "r/SaaS", "HN user dang", "App Store review". */
  context: string;
  /** ISO date of the source item (empty string when the source gives none). */
  date: string;
  /** How many people agreed: upvotes, comment count, reactions, votes. */
  agreementCount: number;
  /** The most quotable sentence, verbatim, or "" when none is quotable. */
  quote: string;
}

/** Result of running one listener. A listener never throws the batch. */
export interface ListenerReport {
  source: string;
  status: "ok" | "skipped" | "failed";
  findings: PainFinding[];
  /** Human-readable reason when skipped/failed (missing key, 403, timeout…). */
  reason?: string;
  /** True when the findings came from the on-disk cache, not the network. */
  fromCache?: boolean;
}

/** A listener: one source, isolated from the others. */
export interface PainListener {
  source: string;
  listen: (ctx: ListenerContext) => Promise<PainFinding[]>;
}

/** What a listener gets: a cached fetch, its own config, and a logger. */
export interface ListenerContext {
  /** GET with retries + on-disk cache. Throws only after all retries fail. */
  fetchJson: <T>(url: string, opts?: FetchOptions) => Promise<T>;
  fetchText: (url: string, opts?: FetchOptions) => Promise<string>;
  env: NodeJS.ProcessEnv;
  log: (message: string) => void;
}

export interface FetchOptions {
  headers?: Record<string, string>;
  /** Cache key override; defaults to the URL. Set "" to skip the cache. */
  cacheKey?: string;
  /** Seconds a cached response stays fresh. Default 86400 (24h). */
  ttlSeconds?: number;
  /** POST body for GraphQL / search endpoints (skips the GET cache). */
  method?: "GET" | "POST";
  body?: string;
}

/** A cluster of near-duplicate pains about the same problem. */
export interface PainCluster {
  id: string;
  /** Short label for the shared pain, derived from the findings' words. */
  label: string;
  findings: PainFinding[];
  /** Distinct sources represented, e.g. ["reddit", "hacker-news"]. */
  sources: string[];
  score: ClusterScore;
}

/** The four scoring axes, each 0–10, plus the weighted total 0–100. */
export interface ClusterScore {
  /** How many distinct people/posts report this pain. */
  frequency: number;
  /** How strongly worded the complaints are. */
  intensity: number;
  /** Evidence people already pay for workarounds / tools. */
  workaroundSpend: number;
  /** How small and weekend-shaped a first version could be. */
  buildability: number;
  total: number;
  /** Why this score, in plain words — shown in the review queue. */
  rationale: string;
}

/** A draft idea produced by the writer from ONE winning cluster. */
export interface PainDraft {
  slug: string;
  title: string;
  /** The product name the writer proposes (clearly a proposal). */
  productName: string;
  category: string;
  /** Full MDX page in the house format (see writer.ts + README.md). */
  mdx: string;
  /** Manifest row in the exact `ideas/manifest.json` shape. */
  manifestRow: Record<string, unknown>;
  /** Evidence receipts: one per finding used. */
  evidence: PainFinding[];
  /** Things the draft could not fill from evidence (gaps for the reviewer). */
  gaps: string[];
  /** Provider spend for this draft in USD. Phase 1 writer is $0 (no LLM). */
  costUsd: number;
}

/** One record in the single-approval review queue. */
export interface ReviewRecord {
  slug: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
  decisionReason?: string;
  cluster: PainCluster;
  draft: PainDraft;
  /** Cost of the whole run that produced this draft (USD). */
  runCostUsd: number;
}

/** What a whole run produced, for the run report. */
export interface PainRunReport {
  startedAt: string;
  finishedAt: string;
  sourceReports: ListenerReport[];
  clustersFound: number;
  drafts: ReviewRecord[];
  /** $0 in Phase 1: every listener API is free and the writer uses no LLM. */
  costUsd: number;
}

/** A voted Idea 4 request, as returned by `convex/ideaRequests.ts` listForSuggest. */
export interface IdeaRequestRow {
  requestId: string;
  title: string;
  normalizedTitle: string;
  problem: string;
  category?: string;
  voteCount: number;
  createdAt: number;
}
