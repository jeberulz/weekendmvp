import { beforeAll, describe, expect, test } from "vitest";

import { EDITORIAL_LIMITS } from "@/lib/editorial/contracts/limits";
import { checkPublicHttpUrl, isUtcTimestamp } from "@/lib/editorial/contracts/primitives";
import { parseEditorialSubmission, type EditorialSubmission } from "@/lib/editorial/contracts/submission";
import { receiptSplitter } from "@/lib/editorial/fixtures/articles/catalog";
import { menuCostCalculator } from "@/lib/editorial/fixtures/articles/legacy";
import { buildFixtureEnvelope } from "@/lib/editorial/fixtures/envelopes";

const NOW = Date.parse("2026-09-27T12:00:00Z");
let valid: EditorialSubmission;
let legacy: EditorialSubmission;

beforeAll(async () => {
  valid = await buildFixtureEnvelope(receiptSplitter, {
    submissionId: "submission-test-1",
    nowMs: NOW,
    policyVersion: "test-policy",
    producer: "engine",
  });
  legacy = await buildFixtureEnvelope(menuCostCalculator, {
    submissionId: "submission-legacy-1",
    nowMs: NOW,
    policyVersion: "test-policy",
    producer: "legacy-import",
    firstPublishedAt: "2026-02-11",
  });
});

function issuesFor(input: unknown) {
  const result = parseEditorialSubmission(input);
  return result.ok ? [] : result.issues;
}

describe("Editorial DTO v1 envelope", () => {
  test("fixture engine and legacy envelopes validate", () => {
    expect(parseEditorialSubmission(valid).ok).toBe(true);
    expect(parseEditorialSubmission(legacy).ok).toBe(true);
  });

  test("unknown keys are rejected at every level, so nothing extra reaches storage", () => {
    expect(issuesFor({ ...valid, approvedBy: "owner" }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...valid, metadata: { ...valid.metadata, customField: "x" } }).length).toBeGreaterThan(0);
    expect(
      issuesFor({ ...valid, sources: [{ ...valid.sources[0], humanReviewed: true }, ...valid.sources.slice(1)] }).length,
    ).toBeGreaterThan(0);
    expect(issuesFor({ ...valid, claims: [{ ...valid.claims[0], approved: true }] }).length).toBeGreaterThan(0);
  });

  test("sizes are bounded", () => {
    expect(issuesFor({ ...valid, markdown: "x".repeat(EDITORIAL_LIMITS.markdownChars + 1) }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...valid, title: "t".repeat(EDITORIAL_LIMITS.titleChars + 1) }).length).toBeGreaterThan(0);
    const manySources = Array.from({ length: EDITORIAL_LIMITS.sources + 1 }, (_, index) => ({
      ...valid.sources[0],
      id: `src-many-${index}`,
    }));
    expect(issuesFor({ ...valid, sources: manySources, claims: [] }).length).toBeGreaterThan(0);
    expect(
      issuesFor({ ...valid, recommendationReasons: Array.from({ length: 13 }, () => "reason") }).length,
    ).toBeGreaterThan(0);
  });

  test("timestamps must be real UTC instants", () => {
    expect(isUtcTimestamp("2026-09-27T12:00:00Z")).toBe(true);
    expect(isUtcTimestamp("2026-09-27T12:00:00.123Z")).toBe(true);
    expect(isUtcTimestamp("2026-09-27T12:00:00+01:00")).toBe(false);
    expect(isUtcTimestamp("2026-02-30T12:00:00Z")).toBe(false);
    expect(isUtcTimestamp("2026-09-27 12:00:00")).toBe(false);
    const offsetSource = { ...valid.sources[0], retrievedAt: "2026-09-01T10:00:00+02:00" };
    expect(issuesFor({ ...valid, sources: [offsetSource, ...valid.sources.slice(1)] }).length).toBeGreaterThan(0);
  });

  test("control and bidirectional override characters are refused in single-line fields", () => {
    const rlo = String.fromCodePoint(0x202e);
    const nul = String.fromCodePoint(0);
    const lineSeparator = String.fromCodePoint(0x2028);
    expect(issuesFor({ ...valid, title: `Invoice ${rlo}gnp.exe` }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...valid, buyer: `Freelancers${nul}` }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...valid, title: `Two${lineSeparator}lines` }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...valid, markdown: `${valid.markdown}${nul}` }).length).toBeGreaterThan(0);
  });

  test("only public http(s) links are valid sources", () => {
    expect(checkPublicHttpUrl("https://paynudge.example/pricing")).toBeNull();
    expect(checkPublicHttpUrl("javascript:alert(1)")).toBe("scheme");
    expect(checkPublicHttpUrl("data:text/html,hi")).toBe("scheme");
    expect(checkPublicHttpUrl("https://user:secret@site.example/")).toBe("credentials");
    expect(checkPublicHttpUrl("http://localhost:3000/admin")).toBe("host");
    expect(checkPublicHttpUrl("http://127.0.0.1/")).toBe("ip_literal");
    expect(checkPublicHttpUrl("http://[::1]/")).toBe("ip_literal");
    expect(checkPublicHttpUrl("https://printer.internal/status")).toBe("internal_host");
    expect(checkPublicHttpUrl("https://site.example/a b")).toBe("whitespace");
    const bad = { ...valid.sources[0], url: "javascript:alert(1)" };
    expect(issuesFor({ ...valid, sources: [bad, ...valid.sources.slice(1)] }).length).toBeGreaterThan(0);
  });

  test("verification claims must be backed by evidence fields", () => {
    const noExcerpt = { ...valid.sources[0], excerpt: null };
    expect(issuesFor({ ...valid, sources: [noExcerpt, ...valid.sources.slice(1)] }).length).toBeGreaterThan(0);
    const verifiedSummary = {
      ...valid.sources[0],
      sourceType: "search_summary" as const,
    };
    expect(issuesFor({ ...valid, sources: [verifiedSummary, ...valid.sources.slice(1)] }).length).toBeGreaterThan(0);
    const verifiedAssumption = {
      ...valid.claims[0],
      kind: "assumed" as const,
    };
    expect(issuesFor({ ...valid, claims: [verifiedAssumption, ...valid.claims.slice(1)] }).length).toBeGreaterThan(0);
    const verifiedWithoutSource = { ...valid.claims[0], sourceIds: [] };
    expect(issuesFor({ ...valid, claims: [verifiedWithoutSource] }).length).toBeGreaterThan(0);
  });

  test("claims and checks may only reference evidence in the same envelope", () => {
    const orphan = { ...valid.claims[0], sourceIds: ["src-not-here"] };
    expect(issuesFor({ ...valid, claims: [orphan] }).length).toBeGreaterThan(0);
    const duplicateIds = [valid.sources[0], { ...valid.sources[1], id: valid.sources[0].id }];
    expect(issuesFor({ ...valid, sources: duplicateIds, claims: [] }).length).toBeGreaterThan(0);
  });

  test("producer, mode and legacy details must agree", () => {
    expect(issuesFor({ ...valid, mode: "legacy" }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...valid, engineRunId: null }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...valid, legacy: { firstPublishedAt: null, bodyOrigin: "mdx" } }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...legacy, legacy: null }).length).toBeGreaterThan(0);
    expect(issuesFor({ ...legacy, mode: "fixture" }).length).toBeGreaterThan(0);
  });

  test("validation issues never echo submitted values", () => {
    const marker = "SECRET-MARKER-7f3a";
    const issues = issuesFor({
      ...valid,
      title: `${marker}${String.fromCodePoint(0x202e)}`,
      sources: [{ ...valid.sources[0], url: `javascript:${marker}` }, ...valid.sources.slice(1)],
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(JSON.stringify(issues)).not.toContain(marker);
    expect(issues.length).toBeLessThanOrEqual(25);
  });
});
