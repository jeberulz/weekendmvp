import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import { parseSiteInputPayload } from "../engine/contracts";
import {
  MAX_KEY_BENEFITS,
  normalizePreviewCustomisation,
  prefillFromIdea,
  toSiteInput,
} from "./customisation";

function valid() {
  return {
    headline: "Ship fewer bugs, write zero tests by hand",
    subheadline: "Turn your product spec into regression tests.",
    problemStatement:
      "QA engineers spend around 40% of their week writing repetitive tests.",
    keyBenefits: ["Generates tests from plain-English specs"],
    callToAction: "Get early access",
  };
}

function fieldError(field: string) {
  return expect.objectContaining({
    data: expect.objectContaining({ code: "INVALID_PREVIEW_FIELD", field }),
  });
}

describe("preview customisation bounds", () => {
  test("a valid customisation normalizes and trims", () => {
    const result = normalizePreviewCustomisation({
      ...valid(),
      headline: "  Ship fewer bugs, write zero tests by hand  ",
    });
    expect(result.headline).toBe("Ship fewer bugs, write zero tests by hand");
  });

  test("rejects a non-object payload", () => {
    for (const bad of [null, undefined, "string", 42, []]) {
      expect(() => normalizePreviewCustomisation(bad)).toThrow(ConvexError);
    }
  });

  test("enforces the minimum on every bounded field", () => {
    for (const field of [
      "headline",
      "subheadline",
      "problemStatement",
      "callToAction",
    ] as const) {
      expect(() =>
        normalizePreviewCustomisation({ ...valid(), [field]: "x" }),
      ).toThrow(fieldError(field));
    }
  });

  test("enforces the maximum on every bounded field", () => {
    const overlong = "x".repeat(5_000);
    for (const field of [
      "headline",
      "subheadline",
      "problemStatement",
      "callToAction",
    ] as const) {
      expect(() =>
        normalizePreviewCustomisation({ ...valid(), [field]: overlong }),
      ).toThrow(fieldError(field));
    }
  });

  test("rejects a non-string in any bounded field", () => {
    expect(() =>
      normalizePreviewCustomisation({ ...valid(), headline: 42 }),
    ).toThrow(fieldError("headline"));
  });

  test("bounds the benefits array itself, not only its members", () => {
    expect(() =>
      normalizePreviewCustomisation({ ...valid(), keyBenefits: [] }),
    ).toThrow(fieldError("keyBenefits"));
    expect(() =>
      normalizePreviewCustomisation({
        ...valid(),
        keyBenefits: Array.from({ length: MAX_KEY_BENEFITS + 1 }, () => "a benefit"),
      }),
    ).toThrow(fieldError("keyBenefits"));
    expect(() =>
      normalizePreviewCustomisation({ ...valid(), keyBenefits: "not an array" }),
    ).toThrow(fieldError("keyBenefits"));
    expect(() =>
      normalizePreviewCustomisation({ ...valid(), keyBenefits: [42] }),
    ).toThrow(fieldError("keyBenefits"));
  });

  test("output satisfies the frozen WP26-S1 site-input contract", () => {
    const siteInput = toSiteInput(normalizePreviewCustomisation(valid()));
    // The real parser, not a re-implementation: if the two contracts ever
    // drift, this fails rather than silently producing an unrenderable spec.
    expect(parseSiteInputPayload(JSON.stringify(siteInput))).toEqual(siteInput);
  });

  test("social proof is empty rather than invented", () => {
    // An anonymous preview has no Validation Report, and the S1 contract
    // requires citations on every social-proof entry. Emitting an uncited
    // claim to fill the page would be fabricating evidence.
    expect(toSiteInput(normalizePreviewCustomisation(valid())).socialProof).toEqual(
      [],
    );
  });
});

describe("prefill from a canonical idea", () => {
  const idea = {
    _id: "idea1" as never,
    _creationTime: 0,
    slug: "ai-qa-test-case-generator",
    title: "AI QA Test Case Generator",
    description:
      "Teams rewrite the same regression tests by hand every release cycle.",
    publishedAt: Date.UTC(2026, 0, 1),
    category: "developer-tools",
    buildTime: "8",
    revenueGoal: "$5k MRR",
    applicationCategory: "DeveloperApplication",
    tools: ["claude-code"],
    audiences: ["developers", "QA leads"],
    bodyMode: "mdx" as const,
  };

  test("produces a customisation that already passes its own bounds", () => {
    const prefilled = prefillFromIdea(idea);
    expect(() => normalizePreviewCustomisation(prefilled)).not.toThrow();
    expect(prefilled.headline).toBe(idea.title);
    expect(prefilled.problemStatement).toBe(idea.description);
  });

  test("falls back when the idea has no summary and no audiences", () => {
    const sparse = { ...idea, audiences: [] as string[] };
    const prefilled = prefillFromIdea(sparse);
    expect(() => normalizePreviewCustomisation(prefilled)).not.toThrow();
    expect(prefilled.subheadline.length).toBeGreaterThan(0);
  });

  test("prefers the idea summary when present", () => {
    const prefilled = prefillFromIdea({ ...idea, summary: "A sharper summary line." });
    expect(prefilled.subheadline).toBe("A sharper summary line.");
  });

  test("the prefill round-trips into a valid site input", () => {
    const siteInput = toSiteInput(prefillFromIdea(idea));
    expect(() => parseSiteInputPayload(JSON.stringify(siteInput))).not.toThrow();
  });
});
