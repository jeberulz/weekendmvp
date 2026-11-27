import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { guideSpec } from "@/app/(marketing)/guides/5-to-9-builder/guide.spec";
import { guideCopy } from "@/app/(marketing)/guides/5-to-9-builder/guideCopy";
import { auditGuide, publicSpecStrings } from "@/lib/guides/audit";
import {
  GuideReviewError,
  SOURCE_FAIL_DAYS,
  SOURCE_WARN_DAYS,
  applicableChecks,
  assertReviewPass,
  buildDraftReview,
  finalizeReview,
  recordHash,
  reviewIssues,
  reviewSchema,
  sealReview,
  sourceFreshness,
  stableJson,
  type GuideReview,
} from "@/lib/guides/guide-review";
import { claimBasis, researchRecordSchema, type ResearchRecord } from "@/lib/guides/research-record";
import { checkCopyAgainstRecord, checkRecordConsistency, figuresIn, htmlToText, verifyEvidence, verifyExcerpts } from "@/lib/guides/verify-claims";

const NOW = Date.parse("2026-11-27T12:00:00Z");

type RawRecord = {
  contractVersion: number;
  slug: string;
  sources: { id: string; url: string; publisher: string; title: string; dateChecked: string }[];
  evidence: { id: string; label: string; verify: Record<string, unknown> }[];
  claims: Record<string, unknown>[];
  allowedNumbers: string[];
};

/** A small record that covers every claim kind, with first-hand evidence and an owner statement. */
function rawRecord(): RawRecord {
  return {
    contractVersion: 1,
    slug: "claude-code-mastery",
    sources: [{ id: "docs", url: "https://docs.example.test/claude-code", publisher: "Example Docs", title: "Claude Code overview", dateChecked: "2026-11-20" }],
    evidence: [
      { id: "ideas", label: "Idea pages in this repo", verify: { type: "file-count", dir: "content/ideas", ext: ".mdx", expect: 200, atLeast: true } },
      { id: "solo", label: "Built by one person", verify: { type: "owner-statement", statement: "John built weekendmvp.app on his own with Claude Code.", statedOn: "2026-11-27" } },
    ],
    claims: [
      { id: "pay-1", kind: "pay", text: "The top posted base pay is $220K.", sourceId: "docs", excerpt: "base pay of up to $220K per year", display: "$220K", asOf: "2026-11-20" },
      { id: "tool-1", kind: "tool-fact", text: "Claude Code reads a CLAUDE.md file at the start of a session.", sourceId: "docs", excerpt: "reads CLAUDE.md at the start of every session", asOf: "2026-11-20" },
      { id: "quote-1", kind: "quote", text: "It is a pair programmer that never tires.", sourceId: "docs", excerpt: "a pair programmer that never tires", speaker: "The docs team" },
      { id: "ideas-1", kind: "first-hand", text: "More than 200 startup ideas are researched on weekendmvp.app.", evidenceId: "ideas" },
      { id: "solo-1", kind: "first-hand", text: "weekendmvp.app was built by one person.", evidenceId: "solo" },
    ],
    allowedNumbers: [],
  };
}

const record = (): ResearchRecord => researchRecordSchema.parse(rawRecord());
const mutate = (change: (raw: ReturnType<typeof rawRecord>) => void) => {
  const raw = rawRecord();
  change(raw);
  return raw;
};
const rules = (findings: { rule: string }[]) => findings.map((f) => f.rule);

/** A review where the reviewer judged everything true, sealed against the record. */
function passingReview(rec: ResearchRecord = record()): GuideReview {
  const draft = buildDraftReview(rec, "Source Critic", "2026-11-27T12:00:00.000Z");
  for (const item of draft.items) {
    for (const key of Object.keys(item.checks) as (keyof typeof item.checks)[]) if (item.checks[key] === false) item.checks[key] = true;
  }
  return finalizeReview(rec, draft, "2026-11-27T12:00:00.000Z");
}

describe("research record schema", () => {
  test("a record covering every claim kind parses", () => {
    expect(researchRecordSchema.safeParse(rawRecord()).success).toBe(true);
  });

  test("a source must be https with a host, and an excerpt must be more than a word", () => {
    expect(researchRecordSchema.safeParse(mutate((r) => { r.sources[0].url = "http://docs.example.test/x"; })).success).toBe(false);
    expect(researchRecordSchema.safeParse(mutate((r) => { r.sources[0].url = "https://"; })).success).toBe(false);
    expect(researchRecordSchema.safeParse(mutate((r) => { (r.claims[0] as { excerpt: string }).excerpt = "short"; })).success).toBe(false);
  });

  test("evidence folders must stay inside the repo, and ids must be unique", () => {
    for (const dir of ["../secrets", "/etc", "content/../.."]) {
      const raw = mutate((r) => { (r.evidence[0].verify as { dir: string }).dir = dir; });
      expect(researchRecordSchema.safeParse(raw).success, dir).toBe(false);
    }
    const duplicate = mutate((r) => { r.claims[1].id = "pay-1"; });
    const result = researchRecordSchema.safeParse(duplicate);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain('claims id "pay-1" is used more than once');
  });

  test("a first-hand claim needs evidence and an outside claim needs a source", () => {
    expect(researchRecordSchema.safeParse(mutate((r) => { delete (r.claims[3] as { evidenceId?: string }).evidenceId; })).success).toBe(false);
    expect(researchRecordSchema.safeParse(mutate((r) => { delete (r.claims[0] as { sourceId?: string }).sourceId; })).success).toBe(false);
  });

  test("claimBasis returns the source or the evidence a claim rests on", () => {
    const rec = record();
    expect(claimBasis(rec, rec.claims[0]).source?.id).toBe("docs");
    expect(claimBasis(rec, rec.claims[3]).evidence?.id).toBe("ideas");
  });
});

describe("record consistency", () => {
  test("a clean record has no findings", () => {
    expect(checkRecordConsistency(record())).toEqual([]);
  });

  test("a claim that points at a missing source or evidence fails", () => {
    expect(rules(checkRecordConsistency(researchRecordSchema.parse(mutate((r) => { (r.claims[0] as { sourceId: string }).sourceId = "nope"; }))))).toContain("claim-source-missing");
    expect(rules(checkRecordConsistency(researchRecordSchema.parse(mutate((r) => { (r.claims[3] as { evidenceId: string }).evidenceId = "nope"; }))))).toContain("claim-evidence-missing");
  });

  test("a stat or pay claim needs its figure, and the figure must be in both the excerpt and the sentence", () => {
    const missing = researchRecordSchema.parse(mutate((r) => { delete (r.claims[0] as { display?: string }).display; }));
    expect(rules(checkRecordConsistency(missing))).toContain("claim-display-missing");
    const notInExcerpt = researchRecordSchema.parse(mutate((r) => { (r.claims[0] as { display: string }).display = "$250K"; }));
    expect(rules(checkRecordConsistency(notInExcerpt))).toEqual(expect.arrayContaining(["claim-display-not-in-excerpt", "claim-display-not-in-text"]));
  });

  test("pay, tool-fact and date claims need a day, and a quote needs its speaker", () => {
    expect(rules(checkRecordConsistency(researchRecordSchema.parse(mutate((r) => { delete (r.claims[1] as { asOf?: string }).asOf; }))))).toContain("claim-asof-missing");
    expect(rules(checkRecordConsistency(researchRecordSchema.parse(mutate((r) => { delete (r.claims[2] as { speaker?: string }).speaker; }))))).toContain("claim-speaker-missing");
  });

  test("a source or evidence entry that backs nothing is a warning", () => {
    const extra = researchRecordSchema.parse(mutate((r) => {
      r.sources.push({ id: "spare", url: "https://spare.example.test/x", publisher: "P", title: "T", dateChecked: "2026-11-01" });
      r.evidence.push({ id: "spare-ev", label: "Spare", verify: { type: "owner-statement", statement: "Something.", statedOn: "2026-11-01" } });
    }));
    const findings = checkRecordConsistency(extra);
    expect(findings).toEqual(expect.arrayContaining([expect.objectContaining({ rule: "source-unused", severity: "warn" }), expect.objectContaining({ rule: "evidence-unused", severity: "warn" })]));
  });
});

describe("excerpt verification against the page", () => {
  const page = "<html><body><script>var x = 1;</script><p>The role has base pay of up to $220K per year.</p><p>Claude Code reads CLAUDE.md at the start of every session.</p><p>Reviewers call it &ldquo;a pair programmer that never tires&rdquo; &amp; more.</p></body></html>";

  test("htmlToText drops scripts and tags and decodes entities", () => {
    const text = htmlToText(page);
    expect(text).not.toContain("var x");
    expect(text).not.toContain("<p>");
    expect(text).toContain("“a pair programmer that never tires” & more.");
  });

  test("each excerpt is found on the page, however the page is marked up", async () => {
    const results = await verifyExcerpts(record(), async () => page);
    expect(results.map((r) => [r.claimId, r.status])).toEqual([["pay-1", "found"], ["tool-1", "found"], ["quote-1", "found"]]);
  });

  test("first-hand claims are not fetched, and each page is fetched once", async () => {
    const urls: string[] = [];
    await verifyExcerpts(record(), async (url) => { urls.push(url); return page; });
    expect(urls).toEqual(["https://docs.example.test/claude-code"]);
  });

  test("a reworded excerpt is not found, even if the number is right", async () => {
    const reworded = "<p>The role pays up to $220K a year.</p><p>Claude Code reads CLAUDE.md at the start of every session.</p>";
    const results = await verifyExcerpts(record(), async () => reworded);
    expect(results.find((r) => r.claimId === "pay-1")?.status).toBe("not-found");
    expect(results.find((r) => r.claimId === "tool-1")?.status).toBe("found");
  });

  test("a page that cannot be read leaves its claims unverified, not passed", async () => {
    const results = await verifyExcerpts(record(), async () => { throw new Error("HTTP 403"); });
    expect(results.every((r) => r.status === "unreachable" && r.detail === "HTTP 403")).toBe(true);
  });
});

describe("first-hand evidence", () => {
  const runners = (files: number, git: number | null) => ({ countFiles: () => files, gitCount: () => git });

  test("at least is met by a higher count and exact needs the same count", () => {
    expect(verifyEvidence(record(), runners(231, 10)).find((r) => r.evidenceId === "ideas")).toMatchObject({ status: "verified", detail: "observed 231, the record says at least 200" });
    const exact = researchRecordSchema.parse(mutate((r) => { (r.evidence[0].verify as { atLeast: boolean }).atLeast = false; }));
    expect(verifyEvidence(exact, runners(231, 10)).find((r) => r.evidenceId === "ideas")?.status).toBe("mismatch");
  });

  test("a count below what the record says is a mismatch", () => {
    expect(verifyEvidence(record(), runners(150, 10)).find((r) => r.evidenceId === "ideas")?.status).toBe("mismatch");
  });

  test("git on a shallow clone cannot answer, so it is unverifiable and never a pass", () => {
    const git = researchRecordSchema.parse(mutate((r) => { r.evidence.push({ id: "prs", label: "Merged PRs", verify: { type: "git-count", what: "pull-request-merges", expect: 100, atLeast: true } }); }));
    expect(verifyEvidence(git, runners(231, null)).find((r) => r.evidenceId === "prs")?.status).toBe("unverifiable");
  });

  test("an owner statement is always unverifiable by machine and needs a reviewer", () => {
    expect(verifyEvidence(record(), runners(231, 10)).find((r) => r.evidenceId === "solo")).toMatchObject({ status: "unverifiable" });
  });

  test("the real repo satisfies the file counts the Claude Code guide would cite", () => {
    const count = (dir: string, ext: string) => fs.readdirSync(path.join(process.cwd(), dir)).filter((f) => f.endsWith(ext)).length;
    expect(count("content/ideas", ".mdx")).toBeGreaterThanOrEqual(200);
    expect(count(".claude/skills", "")).toBeGreaterThanOrEqual(3);
  });
});

describe("figures in copy", () => {
  test("picks up money, percentages, K amounts and counts of three digits or more, not years or small numbers", () => {
    expect(figuresIn("Pay is $220K, up 14%, from 229 ideas, 1,800 dollars and 400+ builders.")).toEqual(["$220K", "14%", "229", "1,800", "400+"]);
    expect(figuresIn("In 2026 there are 5 steps, 30 days and 18 items in section 9.")).toEqual([]);
  });

  test("a K, M or B amount without a currency symbol is one figure, suffix included", () => {
    expect(figuresIn("50K users, 1.2M views, 200K downloads and 3B events.")).toEqual(["50K", "1.2M", "200K", "3B"]);
    expect(figuresIn("About 50k users and 2.5m visits.")).toEqual(["50k", "2.5m"]);
    expect(figuresIn("$220K stays one figure, and 1,200K too.")).toEqual(["$220K", "1,200K"]);
    // Plain numbers still need three digits, and a unit word is not a suffix.
    expect(figuresIn("12 builders and 5 steps in 40 minutes, 8 km.")).toEqual([]);
  });

  test("a claim for 200 users does not back 200K users, and an unrecorded 50K is caught", () => {
    const rec = researchRecordSchema.parse(mutate((r) => {
      r.claims = [{ id: "n1", kind: "first-hand", text: "We have 200 users.", evidenceId: "solo" }];
      r.evidence = r.evidence.filter((e) => e.id === "solo");
      r.sources = [];
    }));
    const unmapped = (text: string[]) => checkCopyAgainstRecord(rec, text).filter((f) => f.rule === "copy-number-unmapped").map((f) => f.message);
    expect(unmapped(["We have 200 users."])).toEqual([]);
    expect(unmapped(["We have 200K users."])).toEqual([expect.stringContaining('"200K"')]);
    expect(unmapped(["We have 50K users."])).toEqual([expect.stringContaining('"50K"')]);
    const listed = researchRecordSchema.parse({ ...rec, allowedNumbers: ["50K"] });
    expect(checkCopyAgainstRecord(listed, ["We have 200 users and 50K views."]).filter((f) => f.rule === "copy-number-unmapped")).toEqual([]);
  });

  test("a figure the record does not back is an error, one it backs or lists as structure is not", () => {
    const rec = record();
    expect(rules(checkCopyAgainstRecord(rec, ["The top posted base pay is $220K.", "More than 200 startup ideas are researched on weekendmvp.app.", "weekendmvp.app was built by one person.", "It is a pair programmer that never tires.", "Claude Code reads a CLAUDE.md file at the start of a session."]))).toEqual([]);
    const unbacked = checkCopyAgainstRecord(rec, ["Builders earn $300K.", ...rec.claims.map((c) => c.text)]);
    expect(unbacked).toEqual([expect.objectContaining({ rule: "copy-number-unmapped", severity: "error", message: expect.stringContaining("$300K") })]);
    const listed = researchRecordSchema.parse(mutate((r) => { r.allowedNumbers = ["$300K"]; }));
    expect(rules(checkCopyAgainstRecord(listed, ["Builders earn $300K.", ...rec.claims.map((c) => c.text)]))).toEqual([]);
  });

  test("a figure matches as a whole token, so a claim saying 1200 does not back a 200", () => {
    const base = mutate((r) => {
      r.claims = [{ id: "n1", kind: "first-hand", text: "We have 1200 articles.", evidenceId: "solo" }];
      r.evidence = r.evidence.filter((e) => e.id === "solo");
      r.sources = [];
    });
    const rec = researchRecordSchema.parse(base);
    const copy = ["We have 1200 articles.", "We have 200 builders."];
    const unmapped = (r: ResearchRecord, text: string[]) => checkCopyAgainstRecord(r, text).filter((f) => f.rule === "copy-number-unmapped");
    expect(unmapped(rec, copy)).toEqual([expect.objectContaining({ rule: "copy-number-unmapped", message: expect.stringContaining('"200"') })]);
    // The same figure written with a comma, or with a plus, is still the same figure.
    expect(unmapped(rec, ["We have 1,200 articles.", "Over 1200+ articles."])).toEqual([]);
    // An allowed number of 1200 does not allow 200 either.
    const listed = researchRecordSchema.parse({ ...base, allowedNumbers: ["1200"] });
    expect(unmapped(listed, ["We have 200 builders."])).toHaveLength(1);
    expect(unmapped(listed, ["Chapter 1200 is long."])).toEqual([]);
    // A percentage is not backed by a longer one.
    const pct = researchRecordSchema.parse(mutate((r) => { (r.claims[0] as { text: string }).text = "Pay rose 120% in a year."; (r.claims[0] as { display?: string }).display = "120%"; (r.claims[0] as { excerpt: string }).excerpt = "Pay rose 120% in a year."; }));
    expect(unmapped(pct, ["Pay rose 20% in a year."])).toHaveLength(1);
    expect(unmapped(pct, ["Pay rose 120% in a year."])).toEqual([]);
  });

  test("evidence that is a stand-in is an error, so a placeholder run can never publish", () => {
    const placeholder = researchRecordSchema.parse(mutate((r) => {
      r.evidence[1].verify = { type: "owner-statement", statement: "PLACEHOLDER: John describes how he built it with Claude Code.", statedOn: "2026-11-27" };
      (r.claims[4] as { text: string }).text = "TBD: the owner's build story goes here.";
    }));
    const found = checkRecordConsistency(placeholder).filter((f) => f.rule === "evidence-placeholder");
    expect(found.map((f) => f.path)).toEqual(["evidence:solo", "claim:solo-1"]);
    expect(found.every((f) => f.severity === "error")).toBe(true);
    // Real evidence is not flagged, and neither is an ordinary word like "placeholders" inside a longer word.
    expect(rules(checkRecordConsistency(record()))).not.toContain("evidence-placeholder");
    const label = researchRecordSchema.parse(mutate((r) => { r.evidence[0].label = "Idea pages in this repo, to be supplied"; }));
    expect(checkRecordConsistency(label).some((f) => f.rule === "evidence-placeholder" && f.path === "evidence:ideas")).toBe(true);
  });

  test("a claim whose sentence is not in the copy is a warning", () => {
    const findings = checkCopyAgainstRecord(record(), ["Nothing from the record is here."]);
    expect(findings.filter((f) => f.rule === "claim-unused")).toHaveLength(5);
    expect(findings.every((f) => f.rule === "claim-unused" ? f.severity === "warn" : true)).toBe(true);
  });
});

describe("sealed review", () => {
  test("a draft fails until every check is judged, and it names what is missing", () => {
    const rec = record();
    const draft = buildDraftReview(rec, "Source Critic", "2026-11-27T12:00:00.000Z");
    expect(draft.verdict).toBe("FAIL");
    expect(() => assertReviewPass(rec, draft, NOW)).toThrow(GuideReviewError);
    expect(reviewIssues(rec, draft, NOW).some((i) => i.includes('claim "pay-1": excerptMatchesPage is false'))).toBe(true);
  });

  test("a fully judged, sealed review passes", () => {
    const rec = record();
    const review = passingReview(rec);
    expect(review.verdict).toBe("PASS");
    expect(review.failures).toEqual([]);
    expect(reviewIssues(rec, review, NOW)).toEqual([]);
    expect(assertReviewPass(rec, JSON.parse(JSON.stringify(review)), NOW).seal).toBe(review.seal);
  });

  test("each claim kind gets its own checks, and checks that do not apply must stay null", () => {
    const rec = record();
    const keys = (id: string) => applicableChecks(rec.claims.find((c) => c.id === id)!, rec.evidence.find((e) => e.id === (rec.claims.find((c) => c.id === id) as { evidenceId?: string }).evidenceId));
    expect(keys("pay-1")).toEqual(["excerptMatchesPage", "topical", "figureMatchesExcerpt", "sourceCredible", "asOfStated"]);
    expect(keys("quote-1")).toContain("wholeStatementInContext");
    expect(keys("ideas-1")).toEqual(["topical", "reproducible"]);
    expect(keys("solo-1")).toEqual(["topical", "ownerConfirmed"]);
    const review = passingReview(rec);
    const tampered = sealReview({ ...review, items: review.items.map((i) => (i.claimId === "ideas-1" ? { ...i, checks: { ...i.checks, excerptMatchesPage: true } } : i)) });
    expect(reviewIssues(rec, tampered, NOW).some((i) => i.includes("excerptMatchesPage does not apply"))).toBe(true);
  });

  test("editing a check after sealing breaks the seal", () => {
    const rec = record();
    const review = passingReview(rec);
    const edited = structuredClone(review);
    edited.items[0].notes = "changed after sealing";
    expect(reviewIssues(rec, edited, NOW)).toEqual(expect.arrayContaining([expect.stringContaining("seal:")]));
  });

  test("a review of an older version of the record is stale", () => {
    const review = passingReview(record());
    const changed = researchRecordSchema.parse(mutate((r) => { (r.claims[0] as { text: string }).text = "The top posted base pay is $220K a year."; }));
    expect(reviewIssues(changed, review, NOW)).toEqual(expect.arrayContaining([expect.stringContaining("recordHash:")]));
  });

  test("a review of another guide, a missing claim and a wrong verdict are each reported", () => {
    const rec = record();
    const review = passingReview(rec);
    const otherSlug = sealReview({ ...structuredClone(review), slug: "another-guide" } as Omit<GuideReview, "seal">);
    expect(reviewIssues(rec, otherSlug, NOW).some((i) => i.startsWith("slug:"))).toBe(true);
    const missing = sealReview({ ...structuredClone(review), items: review.items.slice(1) } as Omit<GuideReview, "seal">);
    expect(reviewIssues(rec, missing, NOW)).toEqual(expect.arrayContaining(['claim "pay-1": not reviewed']));
    const fail = sealReview({ ...structuredClone(review), verdict: "FAIL", failures: ["a source is thin"] } as Omit<GuideReview, "seal">);
    expect(reviewIssues(rec, fail, NOW).some((i) => i.startsWith("verdict: FAIL"))).toBe(true);
  });

  test("finalizeReview cannot seal a PASS over a false check", () => {
    const rec = record();
    const draft = buildDraftReview(rec, "Source Critic", "2026-11-27T12:00:00.000Z");
    const sealed = finalizeReview(rec, draft, "2026-11-27T12:00:00.000Z");
    expect(sealed.verdict).toBe("FAIL");
    expect(sealed.failures.length).toBeGreaterThan(0);
    expect(() => assertReviewPass(rec, sealed, NOW)).toThrow(/does not pass/);
  });

  test("finalizeReview refuses a review drafted from an older record, so judgments are never rebound", () => {
    const rec = record();
    const draft = buildDraftReview(rec, "Source Critic", "2026-11-27T12:00:00.000Z");
    for (const item of draft.items) for (const key of Object.keys(item.checks) as (keyof typeof item.checks)[]) if (item.checks[key] === false) item.checks[key] = true;
    // The reviewer judged this record. Then a claim changes while its id stays.
    const changed = researchRecordSchema.parse(mutate((r) => { (r.claims[0] as { text: string }).text = "The top posted base pay is $220K a year."; }));
    expect(() => finalizeReview(changed, draft, "2026-11-27T12:00:00.000Z")).toThrow(/cannot be sealed/);
    expect(() => finalizeReview(changed, draft, "2026-11-27T12:00:00.000Z")).toThrow(/recordHash:/);
    // The same record still seals to a PASS.
    expect(finalizeReview(rec, draft, "2026-11-27T12:00:00.000Z").verdict).toBe("PASS");
    // A review for another guide is refused too.
    expect(() => finalizeReview(rec, { ...draft, slug: "another-guide" }, "2026-11-27T12:00:00.000Z")).toThrow(/slug:/);
  });

  test("a missing or malformed review is refused with a clear reason", () => {
    const rec = record();
    expect(() => assertReviewPass(rec, undefined, NOW)).toThrow(/sealed Source Critic PASS is required/);
    expect(() => assertReviewPass(rec, null, NOW)).toThrow(GuideReviewError);
    expect(() => assertReviewPass(rec, { verdict: "PASS" }, NOW)).toThrow(/not well formed/);
    expect(reviewSchema.safeParse(passingReview(rec)).success).toBe(true);
  });

  test("the hash does not depend on key order", () => {
    const rec = record();
    const reordered = researchRecordSchema.parse(JSON.parse(JSON.stringify({ allowedNumbers: [], claims: rec.claims, evidence: rec.evidence, sources: rec.sources, slug: rec.slug, contractVersion: 1 })));
    expect(recordHash(reordered)).toBe(recordHash(rec));
    expect(stableJson({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
  });

  test("a source checked more than the limit ago fails the review and one past the warning age is flagged", () => {
    const rec = record();
    const day = 24 * 3600 * 1000;
    expect(sourceFreshness(rec, NOW)[0]).toMatchObject({ ageDays: 7, level: "ok" });
    expect(sourceFreshness(rec, Date.parse("2026-11-20T00:00:00Z") + (SOURCE_WARN_DAYS + 1) * day)[0].level).toBe("warn");
    const old = Date.parse("2026-11-20T00:00:00Z") + (SOURCE_FAIL_DAYS + 1) * day;
    expect(sourceFreshness(rec, old)[0].level).toBe("fail");
    expect(reviewIssues(rec, passingReview(rec), old).some((i) => i.startsWith('source "docs": last checked'))).toBe(true);
  });
});

describe("audit integration", () => {
  /** The real guide's reader-facing figures, listed as structure so the real guide has a clean baseline. */
  const readerFigures = [...Object.values(guideCopy), ...publicSpecStrings(guideSpec)].flatMap((text) => figuresIn(text));
  const guideRecord = () => {
    const raw = rawRecord();
    raw.slug = guideSpec.slug;
    raw.allowedNumbers = [...new Set(readerFigures)];
    return raw;
  };
  const audit = (research?: { record: unknown; review: unknown; now: number }) =>
    // The spec is passed as is: a JSON round trip would drop its function-valued section summary.
    auditGuide({ spec: guideSpec, deck: guideCopy, fileExists: () => true, isOfferEnabled: () => false, research });

  test("a guide with no record is not checked for claims, which is the current state of the 5-to-9 guide", () => {
    expect(audit().findings.some((f) => f.rule.startsWith("research") || f.rule.startsWith("copy-number"))).toBe(false);
  });

  test("a record without a sealed review fails the audit", () => {
    const result = audit({ record: guideRecord(), review: null, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "research-review", severity: "error", message: expect.stringContaining("missing") }));
  });

  test("a record with a sealed PASS review passes the research rules", () => {
    const raw = guideRecord();
    const review = passingReview(researchRecordSchema.parse(raw));
    const result = audit({ record: raw, review, now: NOW });
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
  });

  test("changing the record after review makes the review stale and fails the audit", () => {
    const raw = guideRecord();
    const review = passingReview(researchRecordSchema.parse(raw));
    raw.allowedNumbers.push("999");
    expect(audit({ record: raw, review, now: NOW }).findings).toContainEqual(expect.objectContaining({ rule: "research-review", message: expect.stringContaining("recordHash") }));
  });

  test("an inline Receipt amount must trace to a claim like any other figure", () => {
    const raw = guideRecord();
    const sources = [{ file: "guide/_sections.tsx", text: '<Receipt kind="Price" amount="$999" source="A working example">first paid offer.</Receipt>' }];
    const run = (record: ReturnType<typeof guideRecord>) =>
      auditGuide({ spec: guideSpec, deck: guideCopy, fileExists: () => true, isOfferEnabled: () => false, research: { record, review: passingReview(researchRecordSchema.parse(record)), now: NOW }, sources });
    expect(run(raw).findings).toContainEqual(expect.objectContaining({ rule: "copy-number-unmapped", message: expect.stringContaining('"$999"') }));
    raw.allowedNumbers.push("$999");
    expect(run(raw).findings.filter((f) => f.rule === "copy-number-unmapped")).toEqual([]);
  });

  test("an invalid record, or a record for another guide, is reported", () => {
    const bad = audit({ record: { contractVersion: 1 }, review: null, now: NOW });
    expect(bad.findings.some((f) => f.rule === "research-record-invalid")).toBe(true);
    const other = rawRecord();
    expect(audit({ record: other, review: null, now: NOW }).findings).toContainEqual(expect.objectContaining({ rule: "research-record-invalid", message: expect.stringContaining('"claude-code-mastery"') }));
  });

  test("a figure in the guide copy that no claim backs fails the audit", () => {
    const raw = guideRecord();
    raw.allowedNumbers = raw.allowedNumbers.filter((n) => n !== "$1,800");
    const review = passingReview(researchRecordSchema.parse(raw));
    const result = audit({ record: raw, review, now: NOW });
    expect(result.findings).toContainEqual(expect.objectContaining({ rule: "copy-number-unmapped", message: expect.stringContaining("$1,800") }));
  });

  test("a source checked more than the warning age ago warns on the audit", () => {
    const raw = guideRecord();
    const review = passingReview(researchRecordSchema.parse(raw));
    const later = Date.parse("2026-11-20T00:00:00Z") + (SOURCE_WARN_DAYS + 5) * 24 * 3600 * 1000;
    expect(audit({ record: raw, review, now: later }).findings).toContainEqual(expect.objectContaining({ rule: "source-aging", severity: "warn" }));
  });
});

describe("guide:source-review CLI", () => {
  const dir = path.join(process.cwd(), "guides", "records");
  const created: string[] = [];
  const cleanup = () => {
    for (const file of created.splice(0)) fs.rmSync(file, { force: true });
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  };
  afterEach(cleanup);

  const run = (...args: string[]) =>
    spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/guide-source-review.mjs", ...args], { encoding: "utf8" });
  const writeRecord = (name: string, raw: unknown) => {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(raw, null, 2));
    created.push(file, file.replace(/\.json$/, ".source-review.json"));
    return `guides/records/${name}.json`;
  };

  test("draft, judge, seal and check: the gate only opens on a sealed PASS", () => {
    const rel = writeRecord("zz-test-cli-flow", rawRecord());

    expect(run("check", `--record=${rel}`, "--now=2026-11-27").status).toBe(2); // no review yet
    expect(run("draft", `--record=${rel}`, "--reviewer=Test Reviewer", "--now=2026-11-27").status).toBe(0);
    expect(run("draft", `--record=${rel}`).status).toBe(2); // will not overwrite without --force

    const failing = run("check", `--record=${rel}`, "--now=2026-11-27");
    expect(failing.status).toBe(1);
    expect(failing.stdout).toContain("excerptMatchesPage is false");

    // The reviewer judges every claim true, then seals.
    const reviewFile = path.join(process.cwd(), rel.replace(/\.json$/, ".source-review.json"));
    const review = JSON.parse(fs.readFileSync(reviewFile, "utf8")) as GuideReview;
    for (const item of review.items) for (const key of Object.keys(item.checks) as (keyof typeof item.checks)[]) if (item.checks[key] === false) item.checks[key] = true;
    fs.writeFileSync(reviewFile, JSON.stringify(review));
    const sealed = run("seal", `--record=${rel}`, "--now=2026-11-27");
    expect(sealed.status).toBe(0);
    expect(sealed.stdout).toContain("verdict PASS");
    expect(run("check", `--record=${rel}`, "--now=2026-11-27").status).toBe(0);

    // Sealing again after the record changed is refused, even though every check is true.
    const edited = rawRecord();
    edited.claims[0].text = "The top posted base pay is $230K a year.";
    fs.writeFileSync(path.join(process.cwd(), rel), JSON.stringify(edited));
    const resealed = run("seal", `--record=${rel}`, "--now=2026-11-27");
    expect(resealed.status).toBe(1);
    expect(resealed.stdout).toContain("recordHash");
    expect(resealed.stdout).toContain("draft with --force");
    fs.writeFileSync(path.join(process.cwd(), rel), JSON.stringify(rawRecord()));

    // Editing the record afterwards makes the review stale.
    const raw = rawRecord();
    raw.claims[0].text = "The top posted base pay is $220K a year.";
    fs.writeFileSync(path.join(process.cwd(), rel), JSON.stringify(raw));
    const stale = run("check", `--record=${rel}`, "--now=2026-11-27");
    expect(stale.status).toBe(1);
    expect(stale.stdout).toContain("recordHash");
  });

  test("verify checks the record and reproduces first-hand evidence from this repo, without fetching", () => {
    const rel = writeRecord("zz-test-cli-verify", rawRecord());
    const result = run("verify", `--record=${rel}`, "--now=2026-11-27");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('evidence-verified: evidence "ideas": observed');
    expect(result.stdout).toContain("evidence-unverifiable");
    expect(result.stdout).toContain("excerpts-not-fetched");
  });

  test("verify fails when first-hand evidence does not match the repo", () => {
    const raw = rawRecord();
    (raw.evidence[0].verify as { expect: number }).expect = 100000;
    const rel = writeRecord("zz-test-cli-mismatch", raw);
    const result = run("verify", `--record=${rel}`, "--now=2026-11-27");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("evidence-mismatch");
  });

  test("an invalid record, a path outside guides/records and a bad command are rejected", () => {
    const rel = writeRecord("zz-test-cli-invalid", { contractVersion: 1 });
    expect(run("verify", `--record=${rel}`).status).toBe(1);
    expect(run("verify", "--record=package.json").status).toBe(2);
    expect(run("verify", "--record=guides/records/../../package.json").status).toBe(2);
    expect(run("nonsense", `--record=${rel}`).status).toBe(2);
    expect(run("verify").status).toBe(2);
  });
});
