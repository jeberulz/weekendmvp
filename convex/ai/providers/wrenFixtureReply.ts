/**
 * L1 beta. Wren's fixture reply: what the fixture Claude client answers a
 * `wren-chat` or `wren-plan-turn` request with, so a local or test backend
 * shows a reply that reads like Wren instead of the smallest schema instance
 * (`{"reply":"fixture"}`).
 *
 * Fixture only, by construction: the only importer is `fixtureOutputs.ts`,
 * whose only importer is the fixture client (`fixtures.ts`).
 * `tests/platform/crew-fixture-outputs.test.ts` checks both import edges.
 * Nothing here reads env, the network or the clock: the reply is a pure
 * function of the request the gateway built, so the same request always gets
 * the same reply.
 *
 * Built from the request's real context, never invented:
 * - the founder's message: the JSON string inside `<founder_message>` in the
 *   task block (`wrenTaskBlock`);
 * - the business: the JSON inside `<business_context>`, the second system
 *   block (`wrenBusinessContext` in `convex/workspace/chat.ts`): the business
 *   name, the crew's open reviews (`waitingOnYou`) and what Wren may raise an
 *   approval card for (`approvable`, with real ids).
 * Both are parsed defensively; anything missing reads as empty.
 *
 * The reply always ends with `FIXTURE_WREN_FOOTER`, so nobody mistakes a
 * fixture reply for the model (a production deploy missing
 * `AI_PROVIDER_MODE=live` shows it on every message). It never proposes
 * memory, and the only cards it proposes are approval cards on ids the
 * context listed, which the server checks like any model proposal.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { WREN_CARDS_PER_TURN } from "../../../lib/workspace/contracts/wrenTools";

/** Ends every fixture Wren reply. */
export const FIXTURE_WREN_FOOTER = "Test mode: no AI model wrote this reply.";

/** The plan-turn task instruction (`wrenPlanTurn.ts`) opens with this. */
const PLAN_TURN_MARKER = "The founder wants to change their weekend plan.";

/** Most reviews or approvable things one reply lists. */
const LIST_MAX = 6;

/** Longest quote of the founder's message, in code points. */
const QUOTE_MAX = 80;

const contextSchema = z.object({
  business: z.object({ name: z.string().optional() }).catch({}).optional(),
  partner: z.object({ name: z.string().optional() }).catch({}).optional(),
  waitingOnYou: z.array(z.object({ review: z.string(), page: z.string() })).catch([]).optional(),
  approvable: z.array(z.object({
    kind: z.string(),
    subjectTable: z.string(),
    subjectId: z.string(),
    label: z.string(),
  })).catch([]).optional(),
});

type WrenContext = {
  readonly name: string;
  /** The founder's name for their Crew Lead, or null when none is stored. */
  readonly lead: string | null;
  readonly reviews: readonly { readonly review: string; readonly page: string }[];
  readonly approvable: readonly { readonly kind: string; readonly subjectTable: string; readonly subjectId: string; readonly label: string }[];
};

type Intent = "approvals" | "greeting" | "status" | "plan" | "other";

/** Where each review page is, in words. Keys are `WREN_NAVIGATE_ROUTES` slugs. */
const PAGE_NAMES: ReadonlyMap<string, string> = new Map([
  ["team", "Team HQ"],
  ["brand", "the Brand kit page"],
  ["email", "the Email page"],
  ["social", "the Social page"],
]);

function textOf(blocks: string | readonly { readonly type: string; readonly text?: string }[]): string {
  if (typeof blocks === "string") return blocks;
  return blocks.map((block) => (block.type === "text" && typeof block.text === "string" ? block.text : "")).join("");
}

/** The first line between `<tag>` and `</tag>` in `text` that parses as JSON, or undefined. */
function taggedJson(text: string, tag: string): unknown {
  const lines = text.split("\n");
  const at = lines.indexOf(`<${tag}>`);
  if (at < 0) return undefined;
  for (const line of lines.slice(at + 1)) {
    if (line === `</${tag}>`) return undefined;
    try {
      return JSON.parse(line) as unknown;
    } catch {
      // A prose line (the block's description); keep looking.
    }
  }
  return undefined;
}

function contextOf(params: Anthropic.MessageCreateParamsNonStreaming): WrenContext {
  const system = params.system;
  const block = Array.isArray(system) && system.length > 1 ? textOf([system[1]]) : "";
  const parsed = contextSchema.safeParse(taggedJson(block, "business_context") ?? {});
  const data = parsed.success ? parsed.data : {};
  const name = data.business?.name?.trim();
  const lead = data.partner?.name?.trim();
  return {
    name: name === undefined || name.length === 0 ? "your business" : name,
    lead: lead === undefined || lead.length === 0 ? null : lead,
    reviews: (data.waitingOnYou ?? []).slice(0, LIST_MAX),
    approvable: (data.approvable ?? []).slice(0, LIST_MAX),
  };
}

function userTextOf(params: Anthropic.MessageCreateParamsNonStreaming): string {
  return params.messages.filter((message) => message.role === "user").map((message) => textOf(message.content)).join("\n");
}

function founderMessageOf(userText: string): string {
  const message = taggedJson(userText, "founder_message");
  return typeof message === "string" ? message : "";
}

/** A rough reading of what the founder asked. Deterministic; the live model does the real reading. */
export function wrenFixtureIntent(message: string, planTurn: boolean): Intent {
  if (planTurn) return "plan";
  const text = message.toLowerCase().replace(/\s+/gu, " ").trim();
  if (/\b(approv\w*|review\w*|sign[- ]?off|waiting on me|needs? (me|my|you)|my turn)\b/u.test(text)) return "approvals";
  if (/^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening))\b/u.test(text) && text.split(" ").length <= 5) return "greeting";
  if (/\b(status|progress|update|where (are|do) (we|things)|what('?s| is) next|next step\w*|how('?s| is) it going)\b/u.test(text)) {
    return "status";
  }
  return "other";
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function pageName(page: string): string {
  return PAGE_NAMES.get(page) ?? "your workspace";
}

function reviewLines(context: WrenContext): string[] {
  return context.reviews.map((item) => `- ${item.review}: review it on ${pageName(item.page)}.`);
}

function approvableLines(context: WrenContext): string[] {
  return context.approvable.map((item) => `- ${item.label}: approve it on the card when you are ready.`);
}

/** One sentence on what is waiting on the founder. */
function standing(context: WrenContext): string {
  const reviews = context.reviews.length;
  const ready = context.approvable.length;
  if (reviews === 0 && ready === 0) return "Nothing is waiting on you right now.";
  const parts: string[] = [];
  if (reviews > 0) {
    parts.push(`${reviews.toString()} ${plural(reviews, "review", "reviews")} waiting on you (${context.reviews.map((item) => item.review).join(", ")})`);
  }
  if (ready > 0) parts.push(`${ready.toString()} ${plural(ready, "thing", "things")} ready to approve`);
  return `${parts.join(" and ")}.`;
}

function approvalsReply(context: WrenContext): string {
  if (context.reviews.length === 0 && context.approvable.length === 0) {
    return [
      `Nothing needs your approval for ${context.name} right now.`,
      "When the crew finishes something for you to check, it shows up on Team HQ and I will point you to it.",
    ].join(" ");
  }
  const lines = [`Here is what is waiting on you for ${context.name}:`, ...reviewLines(context), ...approvableLines(context)];
  lines.push("", "Nothing goes out until you approve it.");
  return lines.join("\n");
}

/** The founder's words, cut on a code point boundary past `QUOTE_MAX` characters. */
function quoteOf(message: string): string {
  const points = Array.from(message.replace(/\s+/gu, " ").trim());
  return points.length > QUOTE_MAX ? `${points.slice(0, QUOTE_MAX - 3).join("")}...` : points.join("");
}

function replyFor(intent: Intent, context: WrenContext, message: string): string {
  switch (intent) {
    case "approvals":
      return approvalsReply(context);
    case "greeting":
      return [
        `Hi. ${context.lead === null ? "I am your Crew Lead" : `I am ${context.lead}, your Crew Lead`} for ${context.name}. ${standing(context)}`,
        "Ask me what needs your approval, what the crew is working on, or how to change the plan.",
      ].join("\n\n");
    case "status":
      return [
        `Where ${context.name} stands: ${standing(context)}`,
        context.reviews.length > 0
          ? "The next step is to clear those reviews, so the crew can carry on with the rest of the weekend plan."
          : "The crew carries on with the weekend plan, and I will tell you when something needs you.",
      ].join("\n\n");
    case "plan":
      return [
        "I cannot change the plan myself, but you can.",
        "Open the launch plan, move the step you want to change, and check what depends on it before you save. " +
          "Everything else stays as it is.",
      ].join("\n\n");
    case "other":
      return [
        `I can only answer "${quoteOf(message)}" properly with the live model switched on.`,
        `Here is where ${context.name} stands in the meantime: ${standing(context)}`,
      ].join("\n\n");
  }
}

/** The approval cards to propose: one per approvable thing the context listed, at most `WREN_CARDS_PER_TURN`. */
function approvalCards(context: WrenContext) {
  return context.approvable.slice(0, WREN_CARDS_PER_TURN).map((item) => ({
    tool: "approval_card",
    kind: item.kind,
    subjectTable: item.subjectTable,
    subjectId: item.subjectId,
  }));
}

/** The fixture Wren reply (`wrenReplyOutput` shape) for a Wren request. */
export function wrenFixtureReply(params: Anthropic.MessageCreateParamsNonStreaming): unknown {
  const userText = userTextOf(params);
  const context = contextOf(params);
  const message = founderMessageOf(userText);
  const intent = wrenFixtureIntent(message, userText.includes(PLAN_TURN_MARKER));
  const cards = intent === "approvals" ? approvalCards(context) : [];
  return {
    reply: `${replyFor(intent, context, message)}\n\n${FIXTURE_WREN_FOOTER}`,
    ...(cards.length === 0 ? {} : { cards }),
  };
}
