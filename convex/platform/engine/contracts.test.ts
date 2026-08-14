import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";
import {
  MAX_GENERATED_DOCUMENT_BODY_BYTES,
} from "../validators";
import {
  SITE_INPUT_CONTRACT_VERSION,
  VALIDATION_REPORT_CONTRACT_VERSION,
  assertSiteInputCitationsInRange,
  assertValidationReportCitationsInRange,
  parseSiteInputPayload,
  parseValidationReportPayload,
  serializeSiteInputPayload,
  serializeValidationReportPayload,
  type SiteInputPayload,
  type ValidationReportPayload,
} from "./contracts";

function validReport(): ValidationReportPayload {
  return {
    contractVersion: VALIDATION_REPORT_CONTRACT_VERSION,
    ideaTitle: "AI QA Test Case Generator",
    summary: "Generates regression test cases from a product spec.",
    scores: {
      opportunity: { value: 7, reason: "Large addressable market." },
      pain: { value: 6, reason: "Manual QA is slow and error-prone." },
      builderConfidence: { value: 8, reason: "Well-scoped MVP." },
      execution: { value: 5, reason: "Needs a solid eval harness." },
    },
    marketInsight: {
      stats: [
        { label: "QA automation market", value: "$52B by 2028", citations: [0] },
        { label: "CAGR", value: "19%", citations: [1] },
      ],
      cagr: "19%",
      citations: [0, 1],
    },
    competitiveAnalysis: {
      competitors: [
        { name: "Testim", pricing: "$450/mo", citations: [2] },
        { name: "Mabl", pricing: "$700/mo", citations: [3] },
        { name: "Functionize", pricing: "Custom", citations: [4] },
      ],
      citations: [2, 3, 4],
    },
    goToMarket: { content: "Launch via QA communities and dev tool directories." },
    communityAnalysis: {
      content: "QA engineers report 40% of time spent writing repetitive tests.",
      citations: [5],
    },
    keywordList: {
      keywords: [
        { term: "ai test generator", volume: 800, competition: "medium", cpc: 3.2 },
      ],
    },
    whyNow: {
      content: "LLM code understanding recently crossed a usability threshold.",
      citations: [6],
    },
  };
}

function validSiteInput(): SiteInputPayload {
  return {
    contractVersion: SITE_INPUT_CONTRACT_VERSION,
    headline: "Ship fewer bugs, write zero test cases by hand",
    subheadline: "AI QA Test Case Generator turns your spec into regression tests.",
    problemStatement: "QA engineers spend 40% of their time writing repetitive tests.",
    keyBenefits: ["Generates tests from plain-English specs", "Runs in CI"],
    socialProof: [{ stat: "$52B QA automation market by 2028", citations: [0] }],
    callToAction: { label: "Preview this idea" },
  };
}

describe("validation report payload contract", () => {
  test("a valid payload round-trips through serialize and parse", () => {
    const payload = validReport();
    const body = serializeValidationReportPayload(payload);
    expect(parseValidationReportPayload(body)).toEqual(payload);
  });

  test("rejects an unversioned or unknown contractVersion on parse", () => {
    const payload = { ...validReport(), contractVersion: 2 as never };
    expect(() => parseValidationReportPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("rejects an unknown contractVersion on serialize before touching storage", () => {
    const payload = { ...validReport(), contractVersion: 2 as never };
    expect(() => serializeValidationReportPayload(payload)).toThrow(ConvexError);
  });

  test("rejects malformed JSON", () => {
    expect(() => parseValidationReportPayload("{not json")).toThrow(ConvexError);
  });

  test("rejects a missing body", () => {
    expect(() => parseValidationReportPayload(undefined)).toThrow(ConvexError);
  });

  test("fails closed when marketInsight has zero citations", () => {
    const payload = validReport();
    payload.marketInsight.citations = [];
    expect(() => parseValidationReportPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("fails closed when competitiveAnalysis has zero citations", () => {
    const payload = validReport();
    payload.competitiveAnalysis.citations = [];
    expect(() => parseValidationReportPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("fails closed when communityAnalysis has zero citations", () => {
    const payload = validReport();
    payload.communityAnalysis.citations = [];
    expect(() => parseValidationReportPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("fails closed when whyNow has zero citations", () => {
    const payload = validReport();
    payload.whyNow.citations = [];
    expect(() => parseValidationReportPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("fails closed with fewer than two market stats", () => {
    const payload = validReport();
    payload.marketInsight.stats = [payload.marketInsight.stats[0]];
    expect(() => parseValidationReportPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("fails closed with fewer than three competitors", () => {
    const payload = validReport();
    payload.competitiveAnalysis.competitors =
      payload.competitiveAnalysis.competitors.slice(0, 2);
    expect(() => parseValidationReportPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("rejects non-finite keyword volume or cpc smuggled in as raw JSON text", () => {
    const payload = validReport();
    // `1e400` is syntactically valid JSON but overflows float64 to Infinity
    // on parse — this is not reachable through serializeValidationReportPayload
    // (JSON.stringify turns a real Infinity into `null` first), only through
    // parseValidationReportPayload called directly on raw provider text.
    const body = JSON.stringify(payload).replace('"volume":800', '"volume":1e400');
    expect(body).toContain("1e400");
    expect(JSON.parse(body).keywordList.keywords[0].volume).toBe(Infinity);
    expect(() => parseValidationReportPayload(body)).toThrow(ConvexError);
  });

  test("rejects a site-input shaped document as a validation report", () => {
    const body = JSON.stringify(validSiteInput());
    expect(() => parseValidationReportPayload(body)).toThrow(ConvexError);
  });

  test("serialize rejects a payload whose body exceeds the 256 KiB generated-document cap", () => {
    const payload = validReport();
    payload.communityAnalysis.content = "x".repeat(MAX_GENERATED_DOCUMENT_BODY_BYTES);
    expect(() => serializeValidationReportPayload(payload)).toThrow(ConvexError);
  });
});

describe("citation range cross-check", () => {
  test("accepts references within the stored citation count", () => {
    expect(() =>
      assertValidationReportCitationsInRange(validReport(), 7),
    ).not.toThrow();
  });

  test("fails closed on a citation reference beyond the stored citation count", () => {
    const payload = validReport();
    payload.whyNow.citations = [99];
    expect(() => assertValidationReportCitationsInRange(payload, 7)).toThrow(
      ConvexError,
    );
  });

  test("fails closed on a negative citation reference", () => {
    const payload = validReport();
    payload.marketInsight.citations = [-1];
    expect(() => assertValidationReportCitationsInRange(payload, 7)).toThrow(
      ConvexError,
    );
  });
});

describe("site-input citation range cross-check", () => {
  test("accepts references within the stored citation count", () => {
    expect(() =>
      assertSiteInputCitationsInRange(validSiteInput(), 1),
    ).not.toThrow();
  });

  test("fails closed on a citation reference beyond the stored citation count", () => {
    const payload = validSiteInput();
    payload.socialProof[0].citations = [5];
    expect(() => assertSiteInputCitationsInRange(payload, 1)).toThrow(ConvexError);
  });
});

describe("site-input payload contract", () => {
  test("a valid payload round-trips through serialize and parse", () => {
    const payload = validSiteInput();
    const body = serializeSiteInputPayload(payload);
    expect(parseSiteInputPayload(body)).toEqual(payload);
  });

  test("rejects an unknown contractVersion", () => {
    const payload = { ...validSiteInput(), contractVersion: 2 as never };
    expect(() => parseSiteInputPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("rejects an empty keyBenefits list", () => {
    const payload = validSiteInput();
    payload.keyBenefits = [];
    expect(() => parseSiteInputPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("rejects malformed socialProof entries", () => {
    const payload = { ...validSiteInput(), socialProof: [{ stat: "x" }] as never };
    expect(() => parseSiteInputPayload(JSON.stringify(payload))).toThrow(
      ConvexError,
    );
  });

  test("rejects a validation-report shaped document as site input", () => {
    const body = JSON.stringify(validReport());
    expect(() => parseSiteInputPayload(body)).toThrow(ConvexError);
  });
});
