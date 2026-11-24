/**
 * WP100-S2. "Improve with AI" guardrails, pure: the request parser, the code
 * checks every suggestion passes before a founder sees it, the hints cleaner,
 * the prompt's shape and tier, the `idea_improve` key form, and the fixture
 * reply. No Convex, no model, no spend.
 */
import { describe, expect, test } from "vitest";

import { ideaImproveSpec } from "@/convex/ai/prompts/ideaImprove.v1";
import { keyFormMismatch } from "@/convex/ai/gatewayActions";
import { ideaImproveFixtureReply } from "@/convex/ai/providers/ideaImproveFixtureReply";
import { promptRef, TIER_MODELS } from "@/lib/workspace/contracts/prompts";
import { ideaImproveAttemptKey } from "@/lib/workspace/contracts/metering";
import { WIZARD_LIMITS } from "@/lib/workspace/contracts/wizard";
import { cleanOwnIdeaHints, hintsAreEmpty } from "@/lib/workspace/wizard/idea-hints";
import {
  IDEA_IMPROVE_DEFAULT_NOTE,
  IDEA_IMPROVE_PROMPT_ID,
  IDEA_TEXT_MAX,
  ideaImproveOutputSchema,
  judgeIdeaImprovement,
  parseIdeaImproveRequest,
  rejectReason,
  spliceSelection,
  type IdeaImproveOutput,
  type IdeaImproveRequest,
} from "@/lib/workspace/wizard/idea-improve";

const ROUGH = "basically an app for people who go camping on weekends so they dont forget stuff";
const NO_HINTS = { audience: null, coreAction: null, offer: null };

function whole(text: string): IdeaImproveRequest {
  return { text, selection: null };
}

function improved(text: string, changeNote = "Tightened the wording."): IdeaImproveOutput {
  return { status: "improved", text, changeNote, hints: NO_HINTS };
}

describe("limits", () => {
  test("the output cap is the Step 1 field cap", () => {
    expect(IDEA_TEXT_MAX).toBe(WIZARD_LIMITS.ownIdea);
    expect(IDEA_TEXT_MAX).toBe(240);
  });

  test("the schema refuses text over the cap and unknown keys", () => {
    expect(ideaImproveOutputSchema.safeParse(improved("x".repeat(241))).success).toBe(false);
    expect(ideaImproveOutputSchema.safeParse({ ...improved("Fine."), extra: 1 }).success).toBe(false);
    expect(ideaImproveOutputSchema.safeParse(improved("A checklist app for weekend campers.")).success).toBe(true);
  });
});

describe("parseIdeaImproveRequest", () => {
  test("needs three words", () => {
    expect(parseIdeaImproveRequest("camping app", undefined)).toEqual({ ok: false, error: "too_short" });
    expect(parseIdeaImproveRequest("a camping app", undefined).ok).toBe(true);
  });

  test("refuses text the field would refuse", () => {
    expect(parseIdeaImproveRequest("x ".repeat(130), undefined)).toEqual({ ok: false, error: "invalid_text" });
    expect(parseIdeaImproveRequest("an app\nfor campers", undefined)).toEqual({ ok: false, error: "invalid_text" });
  });

  test("checks the selection and treats a whole-text selection as whole mode", () => {
    expect(parseIdeaImproveRequest(ROUGH, { start: 5, end: 2 })).toEqual({ ok: false, error: "invalid_selection" });
    expect(parseIdeaImproveRequest(ROUGH, { start: 0, end: ROUGH.length + 1 })).toEqual({ ok: false, error: "invalid_selection" });
    expect(parseIdeaImproveRequest(ROUGH, { start: 9, end: 10 })).toEqual({ ok: false, error: "invalid_selection" });
    expect(parseIdeaImproveRequest(ROUGH, { start: 0, end: ROUGH.length })).toEqual({ ok: true, request: whole(ROUGH) });
    const part = parseIdeaImproveRequest(ROUGH, { start: 0, end: 9 });
    expect(part).toEqual({ ok: true, request: { text: ROUGH, selection: { start: 0, end: 9 } } });
  });
});

describe("rejectReason", () => {
  const source = "an app for people who go camping on weekends so they dont forget stuff";

  test("passes a faithful tidy-up", () => {
    expect(rejectReason(source, "A packing checklist for weekend campers so they don't forget anything.")).toBeNull();
  });

  test.each([
    ["empty", "   "],
    ["too_long", `Campers ${"pack ".repeat(60)}`],
    ["not_single_line", "A checklist for campers.\nThey pack."],
    ["more_sentences", "A checklist for campers. It saves time on weekends."],
    ["new_number", "A checklist for weekend campers on 3 day trips."],
    ["new_market_claim", "A checklist for campers in a $4B camping market."],
    ["new_proper_noun", "A checklist for campers, built on Notion."],
    ["hype", "A seamless checklist for weekend campers."],
    ["hype", "A checklist for weekend campers!"],
    ["hype", "An AI-powered checklist for weekend campers."],
    ["lost_meaning", "A budgeting tool for nurses."],
  ] as const)("rejects %s", (reason, candidate) => {
    expect(rejectReason(source, candidate)).toBe(reason);
  });

  test("keeps numbers, names and AI the founder wrote", () => {
    expect(rejectReason("an AI planner for 3 day trips with Strava", "An AI planner for 3 day trips with Strava.")).toBeNull();
  });
});

describe("judgeIdeaImprovement", () => {
  test("a suggestion keeps a clean change note and cleaned hints", () => {
    const verdict = judgeIdeaImprovement(whole(ROUGH), {
      status: "improved",
      text: "A packing checklist for weekend campers so they don't forget anything.",
      changeNote: "",
      hints: { audience: "weekend campers.", coreAction: "tick off a packing list", offer: "the #1 app in a $2B market" },
    });
    expect(verdict).toEqual({
      status: "suggested",
      text: "A packing checklist for weekend campers so they don't forget anything.",
      changeNote: IDEA_IMPROVE_DEFAULT_NOTE,
      hints: { audience: "weekend campers", coreAction: "tick off a packing list", offer: null },
    });
  });

  test("the same text is already clear", () => {
    const text = "A packing checklist for weekend campers.";
    expect(judgeIdeaImprovement(whole(text), improved(text))).toEqual({ status: "already_clear" });
    expect(judgeIdeaImprovement(whole(text), improved("a packing checklist for weekend campers"))).toEqual({ status: "already_clear" });
  });

  test("passes the model's own already_clear and not_an_idea", () => {
    expect(judgeIdeaImprovement(whole(ROUGH), { ...improved(""), status: "already_clear" })).toEqual({ status: "already_clear" });
    expect(judgeIdeaImprovement(whole("hello there friend"), { ...improved(""), status: "not_an_idea" })).toEqual({ status: "not_an_idea" });
  });

  test("an invented fact is rejected, never suggested", () => {
    expect(judgeIdeaImprovement(whole(ROUGH), improved("A packing app for weekend campers on 2 night trips."))).toEqual({
      status: "rejected",
      reason: "new_number",
    });
    expect(judgeIdeaImprovement(whole(ROUGH), improved("The #1 packing app for 2 million weekend campers."))).toEqual({
      status: "rejected",
      reason: "new_market_claim",
    });
  });

  test("selection mode splices the replacement into the founder's text", () => {
    const request: IdeaImproveRequest = { text: ROUGH, selection: { start: 0, end: 9 } };
    const verdict = judgeIdeaImprovement(request, improved("Simply"));
    // "Simply" is the whole replacement; the rest of the text is untouched.
    expect(verdict.status).toBe("suggested");
    if (verdict.status === "suggested") expect(verdict.text).toBe(`Simply ${ROUGH.slice(10)}`);
  });

  test("selection mode rejects a reply that rewrites the whole idea", () => {
    const request: IdeaImproveRequest = { text: ROUGH, selection: { start: 0, end: 9 } };
    const verdict = judgeIdeaImprovement(request, improved(ROUGH.replace("basically", "simply")));
    expect(verdict).toEqual({ status: "rejected", reason: "selection_overflow" });
  });

  test("spliceSelection fixes spacing at the joins", () => {
    expect(spliceSelection("an app for campers", { start: 3, end: 6 }, " checklist ")).toBe("an checklist for campers");
  });
});

describe("hints", () => {
  test("drop market claims, markup and over-long phrases", () => {
    expect(cleanOwnIdeaHints({ audience: "  weekend campers. ", coreAction: "<b>pack</b>", offer: "x".repeat(81) })).toEqual({
      ...NO_HINTS,
      audience: "weekend campers",
    });
    expect(hintsAreEmpty(NO_HINTS)).toBe(true);
    expect(cleanOwnIdeaHints({ audience: "campers in a $4B market", coreAction: null, offer: null }).audience).toBeNull();
  });
});

describe("prompt spec", () => {
  test("is the cheapest tier, realtime, no thinking, small output", () => {
    expect(ideaImproveSpec.id).toBe(IDEA_IMPROVE_PROMPT_ID);
    expect(ideaImproveSpec.tier).toBe("fast");
    expect(TIER_MODELS.fast).toMatch(/haiku/u);
    expect(ideaImproveSpec.thinking).toEqual({ type: "disabled" });
    expect(ideaImproveSpec.mode).toBe("realtime");
    expect(ideaImproveSpec.maxTokens).toBeLessThanOrEqual(400);
    expect(ideaImproveSpec.fallbacks).toBe("none");
  });

  test("the founder's text is a data block, and selection mode adds the selected words", () => {
    const wholeUser = ideaImproveSpec.buildUser({ mode: "whole", idea: ROUGH, selected: null });
    expect(wholeUser).toContain("Mode: whole");
    expect(wholeUser).toContain("<idea>");
    expect(wholeUser).toContain(JSON.stringify(ROUGH));
    expect(wholeUser).not.toContain("<selected>");
    const partUser = ideaImproveSpec.buildUser({ mode: "selection", idea: ROUGH, selected: "basically" });
    expect(partUser).toContain("Mode: selection");
    expect(partUser).toContain("<selected>");
  });

  test("the system prompt forbids invented facts and hype", () => {
    const system = ideaImproveSpec.system.toLowerCase();
    expect(system).toContain("never");
    expect(system).toMatch(/number|fact/u);
  });
});

describe("idea_improve key form", () => {
  const ROW_ID = "k57abc0000000000000000000000000a";
  const key = { kind: "idea_improve" as const, improvementId: ROW_ID as never };
  const ref = promptRef(ideaImproveSpec);

  test("needs the owner and refuses business context", () => {
    expect(keyFormMismatch({ attemptKey: key, promptRef: ref })).toMatch(/ownerId/u);
    expect(keyFormMismatch({ attemptKey: key, promptRef: ref, ownerId: "u1" as never })).toBeNull();
    expect(keyFormMismatch({ attemptKey: key, promptRef: ref, ownerId: "u1" as never, projectId: "p1" as never })).toMatch(/pre-business/u);
  });

  test("runs only the improve prompt", () => {
    expect(keyFormMismatch({ attemptKey: key, promptRef: "wren-reply@3", ownerId: "u1" as never })).toMatch(/runs only/u);
  });

  test("the attempt key shape", () => {
    expect(ideaImproveAttemptKey(ROW_ID, 1)).toBe(`idea-improve:${ROW_ID}:1`);
    expect(() => ideaImproveAttemptKey(ROW_ID, 0)).toThrow();
    expect(() => ideaImproveAttemptKey("not-an-id", 1)).toThrow();
  });
});

describe("fixture reply", () => {
  function params(user: string) {
    return { model: "fixture", max_tokens: 400, messages: [{ role: "user" as const, content: user }] };
  }

  test("tidies the idea without adding facts, and the checks pass it", () => {
    const user = ideaImproveSpec.buildUser({ mode: "whole", idea: ROUGH, selected: null });
    const reply = ideaImproveOutputSchema.parse(ideaImproveFixtureReply(params(user)));
    expect(reply.status).toBe("improved");
    expect(reply.text).toBe("An app for people who go camping on weekends so they don't forget.");
    expect(reply.hints.audience).toBe("people");
    expect(judgeIdeaImprovement(whole(ROUGH), reply).status).toBe("suggested");
  });

  test("a tidy sentence comes back already clear", () => {
    const text = "A packing checklist for weekend campers.";
    const user = ideaImproveSpec.buildUser({ mode: "whole", idea: text, selected: null });
    expect(ideaImproveOutputSchema.parse(ideaImproveFixtureReply(params(user))).status).toBe("already_clear");
  });
});
