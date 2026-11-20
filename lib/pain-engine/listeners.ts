/**
 * Pain Engine — Phase 1 listeners.
 *
 * One listener per source. Each is isolated: the orchestrator runs them with
 * Promise.allSettled, so a failure in one is reported and the rest still run.
 * Every listener is free to call in Phase 1 — no paid API anywhere:
 *
 *   hacker-news    Algolia search API, no key.
 *   reddit         App-only OAuth when REDDIT_CLIENT_ID/SECRET are set,
 *                  otherwise public .json (often 403 from cloud IPs — the
 *                  listener reports that instead of failing the batch).
 *   product-hunt   GraphQL API, free developer token in PRODUCT_HUNT_TOKEN.
 *                  Skipped (not failed) when the token is unset.
 *   github-issues  GitHub search API, no auth for low volume; a token in
 *                  GITHUB_TOKEN raises the rate limit when set.
 *   app-store      Apple App Store RSS review feeds, no key. The app list
 *                  comes from PAIN_ENGINE_APP_STORE_IDS (comma-separated
 *                  App Store ids); skipped when unset.
 *   idea-requests  Read-only consumer of `convex/ideaRequests.ts`
 *                  listForSuggest rows, supplied as a JSON file
 *                  (PAIN_ENGINE_IDEA_REQUESTS_FILE). This file is NOT
 *                  modified by this engine; voted requests are pre-validated
 *                  brief seeds.
 *
 * Out of scope in Phase 1: X (paid API) and Facebook groups (no clean API).
 */
import { isPainSignal, normaliseFinding } from "./extract.ts";
import type {
  IdeaRequestRow,
  ListenerContext,
  PainFinding,
  PainListener,
} from "./types.ts";

/** Pain queries used against the search-style sources. */
export const PAIN_QUERIES = [
  "I wish there was a tool",
  "frustrated with manual work",
  "alternative to",
  "waste of time every week",
  "struggling with invoicing",
  "looking for a tool to",
];

function isoDate(value: string | number | undefined): string {
  if (!value && value !== 0) return "";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function itemUrl(base: string, id: string | number): string {
  return `${base}${id}`;
}

/* ------------------------------------------------------------------ */
/* Hacker News (Algolia, no key)                                       */
/* ------------------------------------------------------------------ */

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  _highlightResult?: { title?: { value?: string } };
}

export const hackerNewsListener: PainListener = {
  source: "hacker-news",
  async listen(ctx: ListenerContext): Promise<PainFinding[]> {
    const findings: PainFinding[] = [];
    for (const query of PAIN_QUERIES.slice(0, 3)) {
      const data = await ctx.fetchJson<{ hits: HnHit[] }>(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=10`,
      );
      for (const hit of data.hits ?? []) {
        const text = `${hit.title ?? ""}`;
        if (!text.trim()) continue;
        findings.push(
          normaliseFinding({
            source: "hacker-news",
            url: itemUrl("https://news.ycombinator.com/item?id=", hit.objectID),
            title: text,
            text,
            context: `Hacker News · ${hit.author ?? "unknown"}`,
            date: isoDate(hit.created_at),
            agreementCount: (hit.points ?? 0) + (hit.num_comments ?? 0),
          }),
        );
      }
    }
    return findings;
  },
};

/* ------------------------------------------------------------------ */
/* Reddit (OAuth when creds exist, else public .json)                   */
/* ------------------------------------------------------------------ */

const REDDIT_SUBREDDITS = ["SaaS", "smallbusiness", "Entrepreneur", "productivity", "freelance"];

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext?: string;
    subreddit: string;
    author: string;
    ups?: number;
    num_comments?: number;
    created_utc?: number;
    permalink: string;
  };
}

async function redditAccessToken(ctx: ListenerContext): Promise<string | null> {
  const id = ctx.env.REDDIT_CLIENT_ID;
  const secret = ctx.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const data = await ctx.fetchJson<{ access_token: string }>(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cacheKey: "",
    },
  );
  return data.access_token;
}

export const redditListener: PainListener = {
  source: "reddit",
  async listen(ctx: ListenerContext): Promise<PainFinding[]> {
    const token = await redditAccessToken(ctx).catch(() => null);
    const findings: PainFinding[] = [];
    for (const sub of REDDIT_SUBREDDITS) {
      const query = "pain OR frustrated OR \"I wish\" OR \"alternative to\"";
      const url = token
        ? `https://oauth.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=10&sort=top&t=month`
        : `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=10&sort=top&t=month`;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const data = await ctx.fetchJson<{ data: { children: RedditPost[] } }>(url, { headers });
      for (const child of data.data?.children ?? []) {
        const post = child.data;
        const text = `${post.title} ${post.selftext ?? ""}`.trim();
        if (!isPainSignal(text)) continue;
        findings.push(
          normaliseFinding({
            source: "reddit",
            url: `https://www.reddit.com${post.permalink}`,
            title: post.title,
            text,
            context: `r/${post.subreddit} · u/${post.author}`,
            date: isoDate(post.created_utc),
            agreementCount: (post.ups ?? 0) + (post.num_comments ?? 0),
          }),
        );
      }
    }
    return findings;
  },
};

/* ------------------------------------------------------------------ */
/* Product Hunt (GraphQL, free developer token)                        */
/* ------------------------------------------------------------------ */

interface ProductHuntEdge {
  node: {
    name: string;
    tagline: string;
    url: string;
    votesCount: number;
    createdAt: string;
    comments?: { edges: { node: { body: string; user: { username: string } } }[] };
  };
}

export const productHuntListener: PainListener = {
  source: "product-hunt",
  async listen(ctx: ListenerContext): Promise<PainFinding[]> {
    const token = ctx.env.PRODUCT_HUNT_TOKEN;
    if (!token) {
      ctx.log("product-hunt: PRODUCT_HUNT_TOKEN unset — skipping (not a failure)");
      return [];
    }
    const query = `
      query { posts(first: 10, order: VOTES_COUNT) {
        edges { node { name tagline url votesCount createdAt
          comments(first: 5) { edges { node { body user { username } } } } } } } }`;
    const data = await ctx.fetchJson<{ data: { posts: { edges: ProductHuntEdge[] } } }>(
      "https://api.producthunt.com/v2/api/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        cacheKey: "",
      },
    );
    const findings: PainFinding[] = [];
    for (const edge of data.data?.posts?.edges ?? []) {
      const node = edge.node;
      for (const comment of node.comments?.edges ?? []) {
        const body = comment.node.body ?? "";
        if (!isPainSignal(body)) continue;
        findings.push(
          normaliseFinding({
            source: "product-hunt",
            url: node.url,
            title: `${node.name} — ${node.tagline}`,
            text: body,
            context: `Product Hunt comment · @${comment.node.user.username} on ${node.name}`,
            date: isoDate(node.createdAt),
            agreementCount: node.votesCount,
          }),
        );
      }
    }
    return findings;
  },
};

/* ------------------------------------------------------------------ */
/* GitHub issues (free search API)                                     */
/* ------------------------------------------------------------------ */

interface GithubIssue {
  id: number;
  title: string;
  body?: string;
  html_url: string;
  user: { login: string };
  reactions?: { "+1": number; total_count: number };
  comments: number;
  created_at: string;
}

export const githubIssuesListener: PainListener = {
  source: "github-issues",
  async listen(ctx: ListenerContext): Promise<PainFinding[]> {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (ctx.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${ctx.env.GITHUB_TOKEN}`;
    const query =
      "type:issue state:open label:enhancement reactions:>5 " +
      "(\"pain\" OR \"frustrating\" OR \"wish\" OR \"workaround\" OR \"manual\")";
    const data = await ctx.fetchJson<{ items: GithubIssue[] }>(
      `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=10&sort=reactions&order=desc`,
      { headers },
    );
    const findings: PainFinding[] = [];
    for (const issue of data.items ?? []) {
      const text = `${issue.title} ${issue.body ?? ""}`.trim();
      if (!isPainSignal(text)) continue;
      findings.push(
        normaliseFinding({
          source: "github-issues",
          url: issue.html_url,
          title: issue.title,
          text,
          context: `GitHub issue · @${issue.user.login}`,
          date: isoDate(issue.created_at),
          agreementCount: (issue.reactions?.total_count ?? 0) + issue.comments,
        }),
      );
    }
    return findings;
  },
};

/* ------------------------------------------------------------------ */
/* App Store reviews (Apple RSS feeds, no key)                         */
/* ------------------------------------------------------------------ */

export const appStoreListener: PainListener = {
  source: "app-store",
  async listen(ctx: ListenerContext): Promise<PainFinding[]> {
    const ids = (ctx.env.PAIN_ENGINE_APP_STORE_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      ctx.log("app-store: PAIN_ENGINE_APP_STORE_IDS unset — skipping (not a failure)");
      return [];
    }
    const findings: PainFinding[] = [];
    for (const id of ids) {
      const feed = await ctx.fetchJson<{
        feed: {
          entry?: {
            title?: { label: string };
            content?: { label: string };
            author?: { name?: { label: string } };
            "im:rating"?: { label: string };
            updated?: { label: string };
            id?: { label: string };
          }[];
        };
      }>(`https://itunes.apple.com/rss/customerreviews/page=1/id=${id}/sortBy=mostRecent/json`);
      for (const entry of feed.feed?.entry ?? []) {
        const text = `${entry.title?.label ?? ""} ${entry.content?.label ?? ""}`.trim();
        if (!isPainSignal(text)) continue;
        findings.push(
          normaliseFinding({
            source: "app-store",
            url: entry.id?.label ?? `https://apps.apple.com/app/id${id}`,
            title: entry.title?.label ?? "App Store review",
            text,
            context: `App Store review · ${entry.author?.name?.label ?? "anonymous"} · ${entry["im:rating"]?.label ?? "?"}★`,
            date: isoDate(entry.updated?.label),
            agreementCount: 0,
          }),
        );
      }
    }
    return findings;
  },
};

/* ------------------------------------------------------------------ */
/* Idea 4 requests/votes — read-only file adapter                      */
/* ------------------------------------------------------------------ */

/**
 * Convert listForSuggest rows (exported to JSON by the operator, e.g. from
 * the Convex dashboard) into findings. The vote count is the agreement
 * signal, so a voted request is a pre-validated brief seed.
 * This adapter reads a file; it never calls Convex and never modifies
 * `convex/ideaRequests.ts`.
 */
export function ideaRequestsToFindings(rows: IdeaRequestRow[]): PainFinding[] {
  return rows
    .filter((row) => row.title.trim() && row.problem.trim())
    .map((row) =>
      normaliseFinding({
        source: "idea-requests",
        url: "https://www.weekendmvp.app/ideas/requests",
        title: row.title,
        text: `${row.title} ${row.problem}`.trim(),
        context: `Idea request · ${row.voteCount} vote${row.voteCount === 1 ? "" : "s"}${row.category ? ` · ${row.category}` : ""}`,
        date: row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : "",
        agreementCount: row.voteCount,
      }),
    );
}

/**
 * Factory: build the idea-requests listener from rows the operator exported
 * (e.g. from the Convex dashboard). The listener itself never touches
 * Convex or the network — the rows are the input.
 */
export function createIdeaRequestsListener(rows: IdeaRequestRow[]): PainListener {
  return {
    source: "idea-requests",
    async listen(): Promise<PainFinding[]> {
      return ideaRequestsToFindings(rows);
    },
  };
}

/** All Phase 1 listeners, in run order. */
export const PHASE1_LISTENERS: PainListener[] = [
  hackerNewsListener,
  redditListener,
  productHuntListener,
  githubIssuesListener,
  appStoreListener,
];
