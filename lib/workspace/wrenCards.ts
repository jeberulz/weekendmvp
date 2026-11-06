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
 * text reaches a card. An approval card's subject is still only a proposal:
 * `convex/workspace/wrenCards.ts` checks it belongs to this business (S1's
 * `createApprovalRecord`) and never touches an existing card.
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

const FIELDS: Readonly<Record<WrenCardTool, readonly (keyof WrenCardProposal)[]>> = {
  approval_card: ["kind", "subjectTable", "subjectId"],
  explain_card: ["topic"],
  navigate_card: ["route"],
};

const CARD_FIELDS: readonly (keyof WrenCardProposal)[] = ["kind", "subjectTable", "subjectId", "topic", "route"];

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
    const value = proposal[field];
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
    case "send:sequence_steps":
      return "Send this email";
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
