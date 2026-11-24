import { describe, expect, test } from "vitest";
import { artifactReviewQuestion, crewAssignmentIntent, handoffGuide, pageFocus, specialistStatusAnswer } from "@/lib/workspace/crewAssignment";

describe("crew draft commands", () => {
  test.each([
    ["Iris, change Siteprimer’s voice and show me one revised email.", "Iris, change Siteprimer’s voice", "show me one revised email."],
    ["Ask Iris to make the brand palette warmer, then have Elle update the waitlist emails.",
      "Ask Iris to make the brand palette warmer", "have Elle update the waitlist emails."],
  ])("keeps the founder's two briefs separate", (message, note, emailNote) => {
    expect(crewAssignmentIntent(message)).toEqual({ type: "revision", target: "brand", note, followUpEmail: true, emailNote });
  });

  test("a direct target takes precedence over the employee page", () => {
    expect(crewAssignmentIntent("Please rewrite the email to match the approved brand.", "brand")).toMatchObject({
      type: "revision", target: "email", followUpEmail: false,
    });
    expect(crewAssignmentIntent("Please make it shorter.", "social")).toMatchObject({
      type: "revision", target: "social", note: "Please make it shorter.",
    });
  });

  test.each([
    "I requested some changes to the brand kit. Do you have any updates?",
    "Update me on the brand kit changes.",
    "What is Leo (Landing) working on for us right now, and what do you need from me?",
    "Could you explain how to change the brand palette?",
    "Don't change the email yet.",
    "Update the email later, but don't start yet.",
    "Change the email address for my account.",
    "Please change the brand kit in my other business.",
    'For instance, "update the brand kit" could mean a lot of things.',
  ])("keeps informational and negated requests out of the writing queue", (message) => {
    expect(crewAssignmentIntent(message, "brand")).toBeNull();
  });

  test("keeps hypothetical handoffs and explicit answer-only notes out of the revision broker", () => {
    expect(handoffGuide("How do handoffs work?")).toBe(true);
    expect(handoffGuide("Where can I follow the handoff?")).toBe(true);
    expect(handoffGuide("How is Elle doing on the handoff?")).toBe(false);
    expect(crewAssignmentIntent("Please update the brand palette. This is a question only.", "brand")).toBeNull();
    expect(artifactReviewQuestion("Is it approved yet?", "email")).toBe("email");
    expect(artifactReviewQuestion("What colors are in the approved brand kit?")).toBeNull();
    expect(artifactReviewQuestion("Brand kit approved?")).toBe("brand");
    expect(artifactReviewQuestion("Have we approved spending credits for the brand revision?", "brand")).toBeNull();
  });

  test("asks one clarification when the referred draft or follow-up is ambiguous", () => {
    expect(crewAssignmentIntent("Revise the draft to sound calmer.")).toMatchObject({ type: "clarify" });
    expect(crewAssignmentIntent("Change the brand voice, then rewrite the social posts.")).toMatchObject({ type: "clarify" });
  });

  test("extracts an employee or artifact page only for the active business", () => {
    expect(pageFocus("p1", "/dashboard/b/p1/team/landing")).toBe("landing");
    expect(pageFocus("p1", "/dashboard/b/p1/brand")).toBe("brand");
    expect(pageFocus("p1", "/dashboard/b/p2/team/brand")).toBeUndefined();
    expect(pageFocus("p1", "/dashboard/b/p1/team")).toBeUndefined();
  });

  test("answers the exact Leo question even when there is no executable landing job", () => {
    const crew = { reviewCount: 0, specialists: [{ name: "Leo", role: "landing", status: "coming_soon", detail: "Landing page is not built yet." }] };
    expect(specialistStatusAnswer("What is Leo (Landing) working on for us right now, and what do you need from me?", undefined, crew))
      .toContain("Leo (landing) — coming soon. Landing page is not built yet.");
    expect(specialistStatusAnswer("What is Leo's status?", undefined, crew)).toContain("no open draft reviews");
  });
});
