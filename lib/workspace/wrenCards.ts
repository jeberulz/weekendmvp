/**
 * WP77-S4 — Wren's cards: the server-side check of what the model proposed,
 * and the static copy each card shows. Pure: no Convex, no I/O, no clock.
 *
 * The model's `cards` entries are untrusted data (they can carry text the
 * founder or a document planted). `checkWrenCardProposals` is a closed
 * allowlist over exact strings: no trimming, case folding or Unicode
 * normalisation, so a homoglyph (`brаnd` with a Cyrillic а), a URL, markup or
 * a path never matches and is refused. Each tool accepts only its own fields;
 * an extra or missing field refuses the card. At most `WREN_CARDS_PER_TURN`
 * cards are considered per reply; the rest are refused (`over_cap`).
 *
 * What a card shows is built here and in the UI from the allowlisted key:
 * titles, explanations and link labels are static copy, and a navigate link
 * is `/dashboard/b/{projectId}/{route}` built by the app. No model-written
 * text reaches a card. An approval card also shows a subject line so two
 * cards of one kind can be told apart; the server builds it from the subject
 * row (`approvalSubjectLine`): a version number, a sequence title, or the
 * first line of a post. Those are founder or crew text, rendered as plain
 * text only. An approval card's subject is still only a proposal:
 * `convex/workspace/wrenCards.ts` checks it belongs to this business and
 * reuses a live card instead of superseding it.
 */

import {
  WREN_APPROVAL_SUBJECTS,
  WREN_CARD_FIELD_MAX_CHARS,
  WREN_CARD_TOOLS,
  WREN_CARDS_PER_TURN,
  WREN_EXPLAIN_TOPICS,
  WREN_NAVIGATE_ROUTES,
  type WrenApprovalKind,
  type WrenApprovalSubjectTable,
  type WrenCardTool,
  type WrenExplainTopic,
  type WrenNavigateRoute,
} from "./contracts/wrenTools";
import { isControlChar, isInvisibleChar } from "./plainText";

/** One `cards` entry as the model wrote it: every field optional, every value untrusted. */
export type WrenCardProposal = {
  readonly tool: string;
  readonly kind?: string;
  readonly subjectTable?: string;
  readonly subjectId?: string;
  readonly topic?: string;
  readonly route?: string;
};

export type CheckedWrenCard =
  | {
    readonly tool: "approval_card";
    readonly kind: WrenApprovalKind;
    readonly subjectTable: WrenApprovalSubjectTable;
    readonly subjectId: string;
  }
  | { readonly tool: "explain_card"; readonly topic: WrenExplainTopic }
  | { readonly tool: "navigate_card"; readonly route: WrenNavigateRoute };

export const WREN_CARD_REFUSALS = [
  /** `tool` is not one of the three tools. */
  "unknown_tool",
  /** A field the tool does not take, or a required field missing. */
  "bad_fields",
  /** A value longer than `WREN_CARD_FIELD_MAX_CHARS`. */
  "too_long",
  /** An approval kind Wren may not raise, or a table that kind may not name. */
  "kind_not_allowed",
  /** `subjectId` is not shaped like a Convex id. */
  "bad_subject_id",
  /** Not an allowlisted explain topic. */
  "topic_not_allowed",
  /** Not an allowlisted in-app route (URLs and paths included). */
  "route_not_allowed",
  /** Past `WREN_CARDS_PER_TURN`. */
  "over_cap",
  /** The same card twice in one reply. */
  "duplicate",
  // Server-side, from `convex/workspace/wrenCards.ts`:
  /** The subject is not in this founder's business, does not exist, or S1 refused it. */
  "subject_refused",
] as const;
export type WrenCardRefusal = (typeof WREN_CARD_REFUSALS)[number];

export type WrenCardCheck = {
  /** Accepted cards with their position in the model's `cards` array. */
  readonly accepted: readonly { readonly index: number; readonly card: CheckedWrenCard }[];
  readonly refused: readonly { readonly index: number; readonly code: WrenCardRefusal }[];
};

const FIELDS: Readonly<Record<WrenCardTool, readonly CardField[]>> = {
  approval_card: ["kind", "subjectTable", "subjectId"],
  explain_card: ["topic"],
  navigate_card: ["route"],
};

type CardField = Exclude<keyof WrenCardProposal, "tool">;

const CARD_FIELDS: readonly CardField[] = ["kind", "subjectTable", "subjectId", "topic", "route"];

/** One field's value, read by name without dynamic property access (the static scan bans it here). */
function fieldValue(proposal: WrenCardProposal, field: CardField): string | undefined {
  switch (field) {
    case "kind":
      return proposal.kind;
    case "subjectTable":
      return proposal.subjectTable;
    case "subjectId":
      return proposal.subjectId;
    case "topic":
      return proposal.topic;
    case "route":
      return proposal.route;
  }
}

/**
 * Convex document ids are lower-case base32 text (convex-test's ids add the
 * table name, hence `_`). Anything else, markup and URLs included, is not an id.
 * The real check is `ctx.db.normalizeId` against the S1 table on the server.
 */
const CONVEX_ID_SHAPE = /^[0-9a-z_]{1,64}$/u;

function isOwnKey<T extends object>(table: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(table, key);
}

function isTool(value: string): value is WrenCardTool {
  return (WREN_CARD_TOOLS as readonly string[]).includes(value);
}

function checkOne(proposal: WrenCardProposal): CheckedWrenCard | WrenCardRefusal {
  if (!isTool(proposal.tool)) return "unknown_tool";
  const allowed = FIELDS[proposal.tool];
  for (const field of CARD_FIELDS) {
    const value = fieldValue(proposal, field);
    const wanted = allowed.includes(field);
    if (wanted !== (value !== undefined)) return "bad_fields";
    if (value !== undefined && value.length > WREN_CARD_FIELD_MAX_CHARS) return "too_long";
  }
  switch (proposal.tool) {
    case "approval_card": {
      const { kind = "", subjectTable = "", subjectId = "" } = proposal;
      if (!isOwnKey(WREN_APPROVAL_SUBJECTS, kind)) return "kind_not_allowed";
      const tables: readonly string[] = WREN_APPROVAL_SUBJECTS[kind];
      if (!tables.includes(subjectTable)) return "kind_not_allowed";
      if (!CONVEX_ID_SHAPE.test(subjectId)) return "bad_subject_id";
      return { tool: "approval_card", kind, subjectTable: subjectTable as WrenApprovalSubjectTable, subjectId };
    }
    case "explain_card": {
      const topic = proposal.topic ?? "";
      return isOwnKey(WREN_EXPLAIN_TOPICS, topic) ? { tool: "explain_card", topic } : "topic_not_allowed";
    }
    case "navigate_card": {
      const route = proposal.route ?? "";
      return isOwnKey(WREN_NAVIGATE_ROUTES, route) ? { tool: "navigate_card", route } : "route_not_allowed";
    }
  }
}

function cardKey(card: CheckedWrenCard): string {
  switch (card.tool) {
    case "approval_card":
      return `approval:${card.kind}:${card.subjectTable}:${card.subjectId}`;
    case "explain_card":
      return `explain:${card.topic}`;
    case "navigate_card":
      return `navigate:${card.route}`;
  }
}

/**
 * The closed allowlist check of one reply's proposals (see the file header).
 * Refused entries are dropped; the reply itself is unaffected.
 */
export function checkWrenCardProposals(proposals: readonly WrenCardProposal[]): WrenCardCheck {
  const accepted: { index: number; card: CheckedWrenCard }[] = [];
  const refused: { index: number; code: WrenCardRefusal }[] = [];
  const seen = new Set<string>();
  proposals.forEach((proposal, index) => {
    if (index >= WREN_CARDS_PER_TURN) {
      refused.push({ index, code: "over_cap" });
      return;
    }
    const checked = checkOne(proposal);
    if (typeof checked === "string") {
      refused.push({ index, code: checked });
      return;
    }
    const key = cardKey(checked);
    if (seen.has(key)) {
      refused.push({ index, code: "duplicate" });
      return;
    }
    seen.add(key);
    accepted.push({ index, card: checked });
  });
  return { accepted, refused };
}

// ---------------------------------------------------------------------------
// What a card shows (static copy)
// ---------------------------------------------------------------------------

/** The approval card's title, by kind and table. Never model text. */
export function approvalCardTitle(kind: string, subjectTable: string): string {
  switch (`${kind}:${subjectTable}`) {
    case "publish:site_versions":
      return "Publish this landing page version";
    case "send:sequences":
      return "Start sending this email sequence";
    case "post:social_posts":
      return "Post this social post";
    case "artifact_review:documents":
    case "artifact_review:site_versions":
      return "Review this draft";
    case "spend:documents":
    case "spend:tasks":
      return "Approve a paid change round";
    default:
      return "Approval needed";
  }
}

export const WREN_EXPLAIN_COPY: Readonly<Record<WrenExplainTopic, { readonly title: string; readonly body: string }>> = {
  approvals: {
    title: "How approval cards work",
    body: "Nothing is sent, posted, published or spent until you approve its card. Wren and the crew can only put cards in front of you. You can approve, ask for changes, or say not now, and an approved card can be cancelled before it is used.",
  },
  change_rounds: {
    title: "Asking for changes",
    body: "Each draft gets two free rounds of changes. From the third round, the card shows the price in credits first, and nothing is charged unless you approve it.",
  },
  credits: {
    title: "Credits",
    body: "Your plan includes monthly credits. Crew work that makes something new, like a paid change round, shows its price on a card before it starts. Chatting with Wren and approving cards never costs credits.",
  },
  wren_limits: {
    title: "How much Wren answers",
    body: "Your plan includes a number of Wren messages a day. Approval clicks and retries don't count. When the messages run out, your plan, cards and crew keep working.",
  },
  publishing: {
    title: "Going live",
    body: "Your landing page goes live only when you approve a publish card for the exact version you reviewed. If the page changes after that, you approve again.",
  },
  email_sending: {
    title: "Sending emails",
    body: "Emails go out only after you approve the sequence or the step. Wren never picks who receives them and never sends to a new list.",
  },
  social_posting: {
    title: "Social posts",
    body: "A post is published only after you approve its card. Approving schedules that one post; nothing else is posted.",
  },
  crew: {
    title: "Your crew",
    body: "Each specialist makes one part of your launch, like the brand kit, the landing page or the emails. Their work comes back to you as a card to review.",
  },
};

export const WREN_NAVIGATE_LABELS: Readonly<Record<WrenNavigateRoute, string>> = {
  dashboard: "Open the dashboard",
  team: "Open Team HQ",
  launch: "Open the launch plan",
  "build-pack": "Open the build pack",
  brand: "Open the brand kit",
  tasks: "Open tasks",
  email: "Open email",
  ads: "Open ads",
  social: "Open social",
  files: "Open files",
  settings: "Open settings",
};

/** The workspace route slug for a navigate key (`dashboard` is the index). */
export function navigateRouteSlug(route: WrenNavigateRoute): string {
  return route === "dashboard" ? "" : route;
}

// ---------------------------------------------------------------------------
// Approval cards: subject line, review link, decision copy
// ---------------------------------------------------------------------------

/** Longest subject line an approval card shows, in characters (an ellipsis included). */
export const APPROVAL_SUBJECT_LINE_MAX_CHARS = 80;

/**
 * The first non-empty line of `text`, whitespace folded, leading markdown
 * markers and control characters removed, cut to
 * `APPROVAL_SUBJECT_LINE_MAX_CHARS` with an ellipsis. Empty when there is no
 * text. The result is plain text for a React text node, never HTML.
 */
export function subjectExcerpt(text: string | undefined, max: number = APPROVAL_SUBJECT_LINE_MAX_CHARS): string {
  if (text === undefined) return "";
  for (const raw of text.split("\n")) {
    const line = cleanLine(raw);
    if (line.length === 0) continue;
    const chars = Array.from(line);
    return chars.length <= max ? line : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
  }
  return "";
}

const LEADING_MARKERS = "#>*-+";

/** One line folded to single spaces, invisible characters and leading markdown markers dropped. */
function cleanLine(raw: string): string {
  let out = "";
  let gap = false;
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (isInvisibleChar(code)) continue;
    if (isControlChar(code) || char.trim() === "") {
      gap = out.length > 0;
      continue;
    }
    if (out.length === 0 && LEADING_MARKERS.includes(char)) continue;
    if (gap) out += " ";
    gap = false;
    out += char;
  }
  return out;
}

export type ApprovalSubjectFacts =
  | { readonly table: "site_versions"; readonly version: bigint | null }
  | { readonly table: "sequences"; readonly title: string | null }
  | { readonly table: "social_posts"; readonly text: string | null }
  | { readonly table: "other" };

/**
 * The approval card's subject line from server-read facts (null when the row
 * is gone or not this business's). Never model text.
 */
export function approvalSubjectLine(facts: ApprovalSubjectFacts): string {
  switch (facts.table) {
    case "site_versions":
      return facts.version === null ? "Landing page version" : `Landing page version ${facts.version.toString()}`;
    case "sequences": {
      const title = facts.title === null ? "" : subjectExcerpt(facts.title);
      return title === "" ? "Email sequence" : `Email sequence: ${title}`;
    }
    case "social_posts": {
      const text = facts.text === null ? "" : subjectExcerpt(facts.text);
      return text === "" ? "Social post" : `Social post: ${text}`;
    }
    case "other":
      return "";
  }
}

/** Where the founder reviews an approval card's subject (a workspace route key). */
export const APPROVAL_REVIEW_ROUTES = ["launch", "email", "social", "files"] as const;
export type ApprovalReviewRoute = (typeof APPROVAL_REVIEW_ROUTES)[number];

/** The review page for a subject table: the launch plan for the site, email, social; files otherwise. */
export function approvalReviewRoute(subjectTable: string): ApprovalReviewRoute {
  switch (subjectTable) {
    case "site_versions":
      return "launch";
    case "sequences":
    case "sequence_steps":
      return "email";
    case "social_posts":
      return "social";
    default:
      return "files";
  }
}

export const APPROVAL_REVIEW_LABELS: Readonly<Record<ApprovalReviewRoute, string>> = {
  launch: "Review it on the launch page",
  email: "Review it in email",
  social: "Review it in social",
  files: "Review it in files",
};

/** The card's line after a decision call returns, by the approval's new status. */
export function approvalDecisionCopy(status: string): string {
  switch (status) {
    case "approved":
      return "Approved.";
    case "cancelled":
      return "Okay, not now.";
    case "expired":
      return "This card expired.";
    case "changes_requested":
      return "Changes requested.";
    default:
      return "";
  }
}

export const CHANGED_CODES: ReadonlySet<string> = new Set([
  "APPROVAL_SUBJECT_CHANGED",
  "APPROVAL_SUBJECT_MISMATCH",
  "APPROVAL_SUBJECT_NOT_PUBLISHABLE",
  "APPROVAL_SUBJECT_NOT_FOUND",
  "APPROVAL_TERMS_MISMATCH",
]);

/**
 * The card's line when `decideApproval` refuses, by its ConvexError code
 * (`null` for a non-Convex error such as a dropped connection). Only an
 * unknown or transient failure asks the founder to try again. (An expired
 * card is not an error: `decideApproval` returns status `expired`, read by
 * `approvalDecisionCopy`.)
 */
export function approvalDecisionErrorCopy(code: string | null): string {
  if (code !== null && CHANGED_CODES.has(code)) return "This changed since Wren raised it. Ask Wren again for a fresh card.";
  switch (code) {
    case "APPROVAL_ALREADY_DECIDED":
      return "This card was already decided.";
    case "RESOURCE_NOT_FOUND":
      return "This card is no longer available.";
    case "WORKSPACE_DISABLED":
      return "Approvals are paused right now. Nothing was changed.";
    default:
      return "That didn't go through. Try again in a moment.";
  }
}

/** The words for an approval card's status, shared by the chat card and the Email page. */
export const STATUS_LABEL: Record<"pending" | "approved" | "changes_requested" | "expired" | "cancelled", string> = {
  pending: "Waiting for you",
  approved: "Approved",
  changes_requested: "Changes requested",
  expired: "Expired",
  cancelled: "Not going ahead",
};

/** The `code` in a thrown `ConvexError`'s data (read by shape, so this file imports nothing), or null for anything else. */
export function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("data" in error)) return null;
  const data: unknown = error.data;
  return typeof data === "object" && data !== null && "code" in data && typeof data.code === "string" ? data.code : null;
}
