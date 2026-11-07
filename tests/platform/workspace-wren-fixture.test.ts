/**
 * L1 beta. Wren's fixture reply (`convex/ai/providers/wrenFixtureReply.ts`),
 * driven through the real Claude adapter in fixture mode with the request the
 * gateway builds (system rules, the business context block, the task block,
 * the output schema). No network, no env, no model.
 */
import { describe, expect, test } from "vitest";

import type { Doc } from "@/convex/_generated/dataModel";
import { outputJsonSchema, systemBlocksFor } from "@/convex/ai/gateway";
import { wrenChatSpec } from "@/convex/ai/prompts/wrenChat";
import { wrenPlanTurnSpec } from "@/convex/ai/prompts/wrenPlanTurn";
import { wrenReplyOutput, type WrenReplyOutput, type WrenTurnInput } from "@/convex/ai/prompts/wrenShared";
import { createAnthropicAdapter } from "@/convex/ai/providers/anthropic";
import { FIXTURE_WREN_FOOTER, wrenFixtureIntent } from "@/convex/ai/providers/wrenFixtureReply";
import type { TextRequest } from "@/convex/ai/providers/types";
import {
  WREN_REVIEW_OPEN_MS,
  WREN_REVIEW_TARGETS,
  wrenBusinessContext,
  type ApprovableSubject,
  type WaitingReview,
} from "@/convex/workspace/chat";
import { WREN_CARDS_PER_TURN, WREN_NAVIGATE_ROUTES } from "@/lib/workspace/contracts/wrenTools";
import { REVIEW_TARGETS } from "@/lib/workspace/reviews";
import { APPROVAL_PENDING_TTL_MS } from "@/lib/workspace/contracts/approvals";

const PROJECT = {
  _id: "project_1",
  ownerId: "user_1",
  title: "PostureUp",
  workspace: {
    version: 1, name: "PostureUp", slug: "postureup", ownIdeaText: "Posture reminders for desk workers",
    platform: "web", commercialModel: "free", goal: "waitlist",
    partner: { personality: "strategist", name: "Wren" }, wizardSessionId: "wizard_1", createdVia: "wizard",
  },
} as unknown as Doc<"projects">;

const REVIEWS: WaitingReview[] = [
  { review: "Brand kit", page: "brand" },
  { review: "Blueprint", page: "team" },
];

const APPROVABLE: ApprovableSubject[] = [
  { kind: "publish", subjectTable: "site_versions", subjectId: "site_version_1", label: "Landing page version 2" },
  { kind: "post", subjectTable: "social_posts", subjectId: "post_1", label: "Social post ready to schedule" },
];

type Spec = typeof wrenChatSpec;

async function wrenReply(
  message: string,
  options: { spec?: Spec; reviews?: WaitingReview[]; approvable?: ApprovableSubject[]; context?: string } = {},
): Promise<WrenReplyOutput> {
  const spec = options.spec ?? wrenChatSpec;
  const inputs: WrenTurnInput = { message, history: [] };
  const context = options.context ??
    wrenBusinessContext(PROJECT, null, options.approvable ?? [], options.reviews ?? []);
  const request: TextRequest = {
    model: "claude-haiku-5-5",
    effort: "low",
    thinking: { type: "disabled" },
    maxTokens: spec.maxTokens,
    system: systemBlocksFor(spec, context),
    user: spec.buildUser(inputs),
    outputSchema: outputJsonSchema(spec.outputSchema),
    timeoutMs: 5_000,
  };
  const result = await createAnthropicAdapter({ env: {} }).complete(request);
  const parsed = wrenReplyOutput.safeParse(result.json);
  if (!parsed.success) throw new Error(`not a Wren reply: ${result.text}`);
  return parsed.data;
}

/** The house rules every fixture reply keeps: the footer, calm text, never the bare word. */
function expectWrenVoice(reply: WrenReplyOutput) {
  expect(reply.reply.endsWith(FIXTURE_WREN_FOOTER)).toBe(true);
  expect(reply.reply).not.toMatch(/\bfixture\b/iu);
  expect(reply.reply).not.toContain("!");
  expect(reply.remember ?? []).toEqual([]);
  expect(reply.memorySummary ?? null).toBeNull();
}

describe("Wren fixture reply", () => {
  test("'What needs my approval right now?' names the open reviews and raises approval cards on approvable things", async () => {
    const reply = await wrenReply("What needs my approval right now?", { reviews: REVIEWS, approvable: APPROVABLE });
    expectWrenVoice(reply);
    expect(reply.reply).toContain("Here is what is waiting on you for PostureUp:");
    expect(reply.reply).toContain("- Brand kit: review it on the Brand kit page.");
    expect(reply.reply).toContain("- Blueprint: review it on Team HQ.");
    expect(reply.reply).toContain("- Landing page version 2: approve it on the card when you are ready.");
    expect(reply.reply).toContain("Nothing goes out until you approve it.");
    expect(reply.cards).toEqual([
      { tool: "approval_card", kind: "publish", subjectTable: "site_versions", subjectId: "site_version_1" },
      { tool: "approval_card", kind: "post", subjectTable: "social_posts", subjectId: "post_1" },
    ]);
  });

  test("approval cards stop at the per-turn cap", async () => {
    const many = Array.from({ length: 5 }, (_, i): ApprovableSubject => ({
      kind: "post", subjectTable: "social_posts", subjectId: `post_${i.toString()}`, label: `Post ${i.toString()}`,
    }));
    const reply = await wrenReply("Anything to approve?", { approvable: many });
    expect(reply.cards).toHaveLength(WREN_CARDS_PER_TURN);
  });

  test("with nothing open, the approvals answer says so and carries no card", async () => {
    const reply = await wrenReply("What needs my approval right now?");
    expectWrenVoice(reply);
    expect(reply.reply).toContain("Nothing needs your approval for PostureUp right now.");
    expect(reply.cards ?? []).toEqual([]);
  });

  test("a greeting introduces Wren with the business and what is waiting", async () => {
    const reply = await wrenReply("hello", { reviews: REVIEWS });
    expectWrenVoice(reply);
    expect(reply.reply).toContain("Hi. I am Wren, your Crew Lead for PostureUp.");
    expect(reply.reply).toContain("2 reviews waiting on you (Brand kit, Blueprint).");
    expect(reply.cards ?? []).toEqual([]);
  });

  test("the lead uses the name the founder chose, never Wren (roster per idea S1)", async () => {
    const juno = {
      ...PROJECT,
      workspace: { ...PROJECT.workspace, partner: { personality: "strategist", name: "Juno" } },
    } as unknown as Doc<"projects">;
    const reply = await wrenReply("hello", { context: wrenBusinessContext(juno, null, [], []) });
    expect(reply.reply).toContain("Hi. I am Juno, your Crew Lead for PostureUp.");
    expect(reply.reply).not.toContain("Wren");
  });

  test("the chat rules name no lead, so the founder's name in the business context wins", () => {
    for (const spec of [wrenChatSpec, wrenPlanTurnSpec]) {
      expect(spec.system).not.toMatch(/\bWren\b/u);
      expect(spec.system).toContain("partner.name in <business_context>");
      expect(spec.buildUser({ message: "hi", history: [] })).not.toMatch(/\bas Wren\b/u);
    }
  });

  test("a free-form message is quoted back honestly with where the business stands", async () => {
    const reply = await wrenReply("tesr", { reviews: REVIEWS.slice(0, 1) });
    expectWrenVoice(reply);
    expect(reply.reply).toContain('I can only answer "tesr" properly with the live model switched on.');
    expect(reply.reply).toContain("1 review waiting on you (Brand kit).");
    const long = await wrenReply(`${"a".repeat(200)}`);
    expect(long.reply).toContain(`"${"a".repeat(77)}..."`);
  });

  test("a plan-changing turn (wren-plan-turn) explains how to change the plan", async () => {
    const reply = await wrenReply("Can we move the launch email to Sunday?", { spec: wrenPlanTurnSpec });
    expectWrenVoice(reply);
    expect(reply.reply).toContain("I cannot change the plan myself, but you can.");
  });

  test("the same request always gets the same reply", async () => {
    const first = await wrenReply("What needs my approval right now?", { reviews: REVIEWS, approvable: APPROVABLE });
    const second = await wrenReply("What needs my approval right now?", { reviews: REVIEWS, approvable: APPROVABLE });
    expect(second).toEqual(first);
  });

  test("a context block it cannot read still gives a valid, generic reply", async () => {
    const reply = await wrenReply("status?", { context: "<business_context>\nnot json\n</business_context>" });
    expectWrenVoice(reply);
    expect(reply.reply).toContain("Where your business stands: Nothing is waiting on you right now.");
  });

  test("intent reading", () => {
    expect(wrenFixtureIntent("What needs my approval right now?", false)).toBe("approvals");
    expect(wrenFixtureIntent("anything to review?", false)).toBe("approvals");
    expect(wrenFixtureIntent("Hello", false)).toBe("greeting");
    expect(wrenFixtureIntent("hello, can you write me a full marketing strategy for next quarter please", false)).toBe("other");
    expect(wrenFixtureIntent("What's next?", false)).toBe("status");
    expect(wrenFixtureIntent("hello", true)).toBe("plan");
  });
});

describe("Wren's business context lists the crew's open reviews", () => {
  test("WREN_REVIEW_TARGETS mirrors REVIEW_TARGETS, and every page is a navigate route", () => {
    const mirrored = Object.fromEntries(
      Object.entries(REVIEW_TARGETS).map(([kind, target]) => [kind, { review: target.title, page: target.slug }]),
    );
    expect(Object.fromEntries(WREN_REVIEW_TARGETS)).toEqual(mirrored);
    for (const target of WREN_REVIEW_TARGETS.values()) expect(Object.hasOwn(WREN_NAVIGATE_ROUTES, target.page)).toBe(true);
  });

  test("a review stays open exactly as long as a pending approval card", () => {
    expect(WREN_REVIEW_OPEN_MS).toBe(APPROVAL_PENDING_TTL_MS);
  });

  test("the block carries waitingOnYou as data, without approval ids", () => {
    const block = wrenBusinessContext(PROJECT, null, [], REVIEWS);
    const json: unknown = JSON.parse(block.split("\n")[2]);
    expect(json).toMatchObject({ waitingOnYou: REVIEWS, approvable: [] });
    expect(block).not.toContain("approvalId");
  });
});
