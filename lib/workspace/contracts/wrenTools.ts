/**
 * WP77-S4 — Wren's tools: the closed allowlist the model may propose from.
 *
 * Wren has no tool loop (D23): the gateway sends no tools and never continues
 * a `tool_use` turn. A "tool call" is an entry in the optional `cards` array
 * of Wren's one structured reply. The model only proposes; server code
 * (`convex/workspace/wrenCards.ts`, checked by `checkWrenCardProposals` in
 * `lib/workspace/wrenCards.ts`) decides. Every tool creates or shows a card
 * and nothing else: no tool sends, posts, spends, publishes, debits, or
 * changes an approval or a setting (D13, D23). The founder's click on an
 * approval card is the only way anything happens, and that click goes through
 * S1's `decideApproval`, never through Wren.
 *
 * This module is imported by the Wren prompts, so the prompt version lock
 * hashes it: any change here needs a version bump of `wren-chat` and
 * `wren-plan-turn`. Keys only, no copy (the copy lives in
 * `lib/workspace/wrenCards.ts`). No imports, no I/O.
 */

/** The three tools. Anything else is refused. */
export const WREN_CARD_TOOLS = ["approval_card", "explain_card", "navigate_card"] as const;
export type WrenCardTool = (typeof WREN_CARD_TOOLS)[number];

/** Cards one Wren reply may carry. Proposals past this are refused, never queued. */
export const WREN_CARDS_PER_TURN = 3;

/**
 * Approval kinds Wren may raise, and the subject tables each may name. A
 * strict subset of S1's `APPROVAL_SUBJECT_TABLES` (tested). Left out on
 * purpose: `artifact_review` (generators raise it with the D17 round),
 * `spend` (only change rounds raise it, with the server's price), `ad_launch`
 * (ads start only from the ads flow, D13), `upgrade` (billing), `send` to
 * an `outbound_messages` list (D13: never a new list from chat), and `send`
 * on a single `sequence_steps` row (a step is sent as part of its approved
 * sequence, so Wren raises the sequence card only).
 */
export const WREN_APPROVAL_SUBJECTS = {
  publish: ["site_versions"],
  send: ["sequences"],
  post: ["social_posts"],
} as const;
export type WrenApprovalKind = keyof typeof WREN_APPROVAL_SUBJECTS;
export type WrenApprovalSubjectTable = (typeof WREN_APPROVAL_SUBJECTS)[WrenApprovalKind][number];

/** Topics an explain card may show. Each one is static copy keyed here; the model writes none of it. */
export const WREN_EXPLAIN_TOPICS = {
  approvals: "how approval cards work and why nothing happens without the founder's click",
  change_rounds: "how asking for changes works: two free rounds, then a priced round",
  credits: "what credits are and when work costs them",
  wren_limits: "how many messages the Crew Lead answers per day on each plan",
  publishing: "how the landing page goes live",
  email_sending: "how emails reach a list, and when they are sent",
  social_posting: "how social posts are scheduled and posted",
  crew: "who the crew are and what each specialist makes",
} as const;
export type WrenExplainTopic = keyof typeof WREN_EXPLAIN_TOPICS;

/**
 * In-app pages a navigate card may open, always inside this founder's own
 * business (`/dashboard/b/{projectId}/{route}`). Keys are workspace route
 * slugs (a subset of `WORKSPACE_ROUTES`, tested); `dashboard` is the index.
 * There is no external URL, and the link is built by the app from the key,
 * never from model text.
 */
export const WREN_NAVIGATE_ROUTES = {
  dashboard: "the business dashboard",
  team: "Team HQ, the crew",
  launch: "the launch plan",
  "build-pack": "the weekend build pack",
  brand: "the brand kit",
  tasks: "tasks",
  email: "email sequences",
  ads: "ads drafts",
  social: "social posts",
  files: "files and what the Crew Lead knows",
  settings: "business settings",
} as const;
export type WrenNavigateRoute = keyof typeof WREN_NAVIGATE_ROUTES;

/** Longest value the model may put in any card field. Longer is refused. */
export const WREN_CARD_FIELD_MAX_CHARS = 64;

/** The prompt's description of the tools, built from the allowlists above. */
export function wrenToolsInstruction(): string {
  const kinds = Object.entries(WREN_APPROVAL_SUBJECTS)
    .map(([kind, tables]) => `${kind} (subjectTable: ${tables.join(" or ")})`)
    .join("; ");
  const topics = Object.entries(WREN_EXPLAIN_TOPICS).map(([key, about]) => `${key}: ${about}`).join("; ");
  const routes = Object.entries(WREN_NAVIGATE_ROUTES).map(([key, about]) => `${key}: ${about}`).join("; ");
  return [
    `You may add up to ${WREN_CARDS_PER_TURN} cards to your reply in the optional cards field. A card is all you can do; it never sends, posts, publishes, spends or approves anything.`,
    `- approval_card: put an approval card in front of the founder for a thing in this business, by its id from the business context. Fields: kind, subjectTable, subjectId. Kinds: ${kinds}. The founder decides on the card; you never approve.`,
    `- explain_card: show a short built-in explanation. Field: topic. Topics: ${topics}.`,
    `- navigate_card: link to a page of this business in the workspace. Field: route. Routes: ${routes}. No other links exist.`,
    "The founder sees approval cards. Explain and navigate cards may not be shown yet, so never refer to one in your reply: no \"below\", no \"the link\", no \"this card\". Write the reply so it stands on its own without them.",
    "Only add a card when it helps the founder with what they asked. Leave cards out otherwise.",
  ].join("\n");
}
