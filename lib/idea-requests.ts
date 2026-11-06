/**
 * Idea requests & voting (Idea 4) — pure helpers shared by the Convex
 * backend (`convex/ideaRequests.ts`), the widget, and the tests.
 *
 * Deliberately dependency-free: no icons, no Convex imports, so the same
 * validation runs identically on the server and in tests.
 *
 * Privacy: anonymous visitors are identified only by a random id stored in
 * their own browser (`localStorage`). We never store a raw IP or email for a
 * request/vote — a signed-in request stores the Convex user id, an anonymous
 * one stores only its random anonymous id.
 */

/** Category slugs, mirroring `CATEGORY_META` in `components/ideas/idea-meta`. */
export const IDEA_REQUEST_CATEGORIES = [
  "saas",
  "productivity",
  "health",
  "marketplace",
  "ai-tools",
  "automation",
  "education",
  "b2b",
  "developer-tools",
  "ecommerce",
  "creator-tools",
  "fintech",
] as const;

export type IdeaRequestCategory = (typeof IDEA_REQUEST_CATEGORIES)[number];

export const MAX_REQUEST_TITLE_LENGTH = 120;
export const MAX_REQUEST_PROBLEM_LENGTH = 280;
export const MIN_REQUEST_TEXT_LENGTH = 3;

/** Anonymous ids are random, client-generated, 16–64 URL-safe chars. */
const ANONYMOUS_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const ANONYMOUS_ID_STORAGE_KEY = "wvm-idea-request-anon-id";

export function isValidAnonymousId(value: unknown): value is string {
  return typeof value === "string" && ANONYMOUS_ID_PATTERN.test(value);
}

export function createAnonymousId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/**
 * Returns the browser's stable anonymous id, creating and storing one when
 * needed. Storage failures (private mode, blocked cookies) fall back to a
 * fresh in-memory id for this page load — votes still work, they just do not
 * persist across reloads.
 */
export function getOrCreateAnonymousId(storage?: StorageLike): string {
  const store: StorageLike | null =
    storage ??
    (typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : null);
  if (store) {
    try {
      const existing = store.getItem(ANONYMOUS_ID_STORAGE_KEY);
      if (isValidAnonymousId(existing)) return existing;
      const created = createAnonymousId();
      store.setItem(ANONYMOUS_ID_STORAGE_KEY, created);
      return created;
    } catch {
      return createAnonymousId();
    }
  }
  return createAnonymousId();
}

/** Collapse whitespace and case so "AI CRM" and "ai  crm" dedupe together. */
export function normalizeRequestTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export function signedInVoterKey(subject: string): string {
  return `user:${subject}`;
}

export function anonymousVoterKey(anonymousId: string): string {
  return `anon:${anonymousId}`;
}

export type IdeaRequestInput = {
  title: string;
  problem: string;
  category?: string;
};

export type IdeaRequestValidation =
  | { ok: true; title: string; problem: string; category: string | null }
  | { ok: false; errors: string[] };

const REPEATED_CHAR_RUN = /(.)\1{9,}/;
const URL_LIKE = /(https?:\/\/|www\.)/i;

/**
 * Fail-closed validation for a submitted request. Returns the cleaned
 * values on success; on failure, human-readable errors (no field is ever
 * silently truncated — an over-long title is rejected so the author can
 * shorten it).
 */
export function validateIdeaRequest(input: IdeaRequestInput): IdeaRequestValidation {
  const errors: string[] = [];
  const title = input.title.trim().replace(/\s+/g, " ");
  const problem = input.problem.trim().replace(/\s+/g, " ");

  if (title.length < MIN_REQUEST_TEXT_LENGTH) {
    errors.push("Give the idea a title of at least 3 characters.");
  }
  if (title.length > MAX_REQUEST_TITLE_LENGTH) {
    errors.push(`Keep the title to ${MAX_REQUEST_TITLE_LENGTH} characters or fewer.`);
  }
  if (problem.length < MIN_REQUEST_TEXT_LENGTH) {
    errors.push("Say in one line who it is for and what problem it solves.");
  }
  if (problem.length > MAX_REQUEST_PROBLEM_LENGTH) {
    errors.push(`Keep the problem to ${MAX_REQUEST_PROBLEM_LENGTH} characters or fewer.`);
  }
  if (REPEATED_CHAR_RUN.test(title) || REPEATED_CHAR_RUN.test(problem)) {
    errors.push("That looks like repeated characters — please write it out in words.");
  }
  if (URL_LIKE.test(title) || URL_LIKE.test(problem)) {
    errors.push("Please leave links out — just the idea and the problem it solves.");
  }

  const category =
    input.category === undefined || input.category === ""
      ? null
      : (IDEA_REQUEST_CATEGORIES as readonly string[]).includes(input.category)
        ? input.category
        : null;
  if (input.category !== undefined && input.category !== "" && category === null) {
    errors.push("Choose a category from the list, or leave it blank.");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, title, problem, category };
}

/** Sort key for the public list: most votes first, newest first on ties. */
export function compareIdeaRequests(
  a: { voteCount: number; createdAt: number },
  b: { voteCount: number; createdAt: number },
): number {
  if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
  return b.createdAt - a.createdAt;
}
