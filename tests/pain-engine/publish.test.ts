import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { clusterFindings } from "../../lib/pain-engine/cluster";
import {
  buildSubmission,
  overrideTitleIssues,
  verifyPainEngineSourceReview,
  writerTitleIssues,
} from "../../lib/pain-engine/publish";
import { updateReviewRecordBookkeeping } from "../../lib/pain-engine/review";
import type { PainFinding, ReviewRecord } from "../../lib/pain-engine/types";
import { writeDraft } from "../../lib/pain-engine/writer";

function findings(): PainFinding[] {
  return [
    {
      source: "reddit",
      url: "https://www.reddit.com/r/smallbusiness/comments/fixture1/",
      title: "I spend 3 hours every Friday doing invoices by hand and I hate it",
      text: "I spend 3 hours every Friday doing invoices by hand and I hate it. I copy amounts from emails into a spreadsheet, then into my invoicing tool, and every time I make a typo I have to chase the client. I wish there was a tool that just did it.",
      context: "r/smallbusiness · u/fixture-founder",
      date: "2026-11-01",
      agreementCount: 214,
      quote: "I spend 3 hours every Friday doing invoices by hand and I hate it.",
    },
    {
      source: "hacker-news",
      url: "https://news.ycombinator.com/item?id=40000001",
      title: "Invoicing is the worst part of freelancing",
      text: "Invoicing is the worst part of freelancing. Every month I waste a whole afternoon copying line items from emails into invoices. I would pay for a tool that turns an email thread into an invoice.",
      context: "Hacker News · fixture-user",
      date: "2026-10-28",
      agreementCount: 96,
      quote: "I would pay for a tool that turns an email thread into an invoice.",
    },
    {
      source: "github-issues",
      url: "https://github.com/example/billing/issues/42",
      title: "Feature request: generate invoice from email thread",
      text: "Feature request: generate invoice from email thread. Our team manually copies amounts from client emails into invoices every week. It is tedious and error-prone. I would pay for an add-on that did this automatically.",
      context: "GitHub issue · @fixture-dev",
      date: "2026-10-20",
      agreementCount: 58,
      quote: "It is tedious and error-prone.",
    },
  ];
}

/** An approved review record built the same way the live engine builds one. */
function approvedRecord(patch?: (record: ReviewRecord) => void): ReviewRecord {
  const [cluster] = clusterFindings(findings());
  const draft = writeDraft(cluster);
  const record: ReviewRecord = {
    slug: draft.slug,
    status: "approved",
    createdAt: "2026-11-24T11:00:00.000Z",
    decidedAt: "2026-11-24T11:30:00.000Z",
    decisionReason: "test approval",
    cluster,
    draft,
    runCostUsd: 0,
  };
  patch?.(record);
  return record;
}

/** Make a fixture record look like a real raw draft: the fields AND the
 * MDX must agree (the writer generates both from the same values). */
function makeRaw(record: ReviewRecord, title: string, productName: string): void {
  record.draft.mdx = record.draft.mdx.split(record.draft.productName).join(productName);
  record.draft.title = title;
  record.draft.productName = productName;
}

describe("title gate — writer-derived values", () => {
  it("refuses a raw [FEATURE] title cut at 100 chars and a label-fragment product name", () => {
    const record = approvedRecord((r) => {
      makeRaw(
        r,
        "[FEATURE] Add the ability to manage multiple Claude accounts within the Claude Desktop app with easy",
        "App Show",
      );
    });
    expect(record.draft.title).toHaveLength(100);
    const issues = writerTitleIssues(record);
    expect(issues.some((issue) => issue.includes("bracket tag"))).toBe(true);
    expect(issues.some((issue) => issue.includes("truncated"))).toBe(true);
    expect(issues.some((issue) => issue.includes("generic words"))).toBe(true);
    expect(() => buildSubmission(record)).toThrow(/Title gate refused/);
  });

  it("refuses a product name that is another company's product", () => {
    const record = approvedRecord((r) => {
      r.draft.productName = "App Chatgpt";
    });
    expect(writerTitleIssues(record).some((issue) => issue.includes("chatgpt"))).toBe(true);
    expect(() => buildSubmission(record)).toThrow(/Title gate refused/);
  });

  it("passes a clean writer title and product name", () => {
    const record = approvedRecord();
    expect(writerTitleIssues(record)).toEqual([]);
  });
});

describe("title gate — human overrides", () => {
  it("refuses an override that is still a bracket tag or a brand name", () => {
    expect(overrideTitleIssues("[FEATURE] Something", "Clean Name").length).toBeGreaterThan(0);
    expect(overrideTitleIssues("Clean Title Here", "Claude Switchboard").length).toBeGreaterThan(0);
  });

  it("accepts a clean override and records it", () => {
    const record = approvedRecord((r) => {
      makeRaw(
        r,
        "[FEATURE] Add the ability to manage multiple Claude accounts within the Claude Desktop app with easy",
        "App Show",
      );
    });
    const submission = buildSubmission(record, {
      title: "Multi-account switching for Claude Desktop",
      productName: "Account Switcher",
    });
    expect(submission.overridesApplied?.title).toBe(
      "Multi-account switching for Claude Desktop",
    );
    expect(submission.overridesApplied?.productName).toBe("Account Switcher");
    expect(submission.envelope.title).toBe("Multi-account switching for Claude Desktop");
    expect(submission.mdx).toContain('title: "Multi-account switching for Claude Desktop"');
    expect(submission.mdx).toContain("Account Switcher");
    expect(submission.mdx).not.toContain("App Show");
    expect(submission.manifestRow.title).toBe("Multi-account switching for Claude Desktop");
  });

  it("a previously recorded override still applies on a later run without flags", () => {
    const record = approvedRecord((r) => {
      makeRaw(
        r,
        "[FEATURE] Add the ability to manage multiple Claude accounts within the Claude Desktop app with easy",
        "App Show",
      );
      r.publishOverrides = {
        title: "Multi-account switching for Claude Desktop",
        productName: "Account Switcher",
        appliedAt: "2026-11-24T11:35:00.000Z",
      };
    });
    const submission = buildSubmission(record);
    expect(submission.envelope.title).toBe("Multi-account switching for Claude Desktop");
  });

  it("the submission hash is stable across identical runs (confirm-then-apply works)", () => {
    const overrides = {
      title: "Multi-account switching for Claude Desktop",
      productName: "Account Switcher",
    };
    const record = approvedRecord((r) => {
      makeRaw(
        r,
        "[FEATURE] Add the ability to manage multiple Claude accounts within the Claude Desktop app with easy",
        "App Show",
      );
    });
    const first = buildSubmission(record, overrides);
    // A second run with the same flags — and a third run with no flags,
    // relying on the recorded override — must hash identically, or
    // --confirm-submission from the dry run could never match the apply.
    const second = buildSubmission(
      { ...record, publishOverrides: first.overridesApplied ?? undefined },
      overrides,
    );
    const third = buildSubmission({
      ...record,
      publishOverrides: first.overridesApplied ?? undefined,
    });
    expect(second.artifactHash).toBe(first.artifactHash);
    expect(third.artifactHash).toBe(first.artifactHash);
    expect(second.recordHash).toBe(first.recordHash);
  });
});

describe("submission gate — status", () => {
  it("refuses a pending record", () => {
    const record = approvedRecord((r) => {
      r.status = "pending";
      delete r.decidedAt;
    });
    expect(() => buildSubmission(record)).toThrow(/is pending/);
  });

  it("refuses a rejected record", () => {
    const record = approvedRecord((r) => {
      r.status = "rejected";
    });
    expect(() => buildSubmission(record)).toThrow(/is rejected/);
  });

  it("refuses an already-submitted record", () => {
    const record = approvedRecord((r) => {
      r.submission = {
        status: "submitted",
        submissionId: "pe_0123456789abcdef0123456789abcdef",
        artifactHash: "a".repeat(64),
        recordHash: "b".repeat(64),
        highlightsDropped: true,
        preparedAt: "2026-11-24T11:35:00.000Z",
        submittedAt: "2026-11-24T11:36:00.000Z",
        ideaId: "idea_test",
      };
    });
    expect(() => buildSubmission(record)).toThrow(/already submitted/);
  });
});

describe("buildSubmission — happy path", () => {
  it("builds the envelope, drops highlights, and leaves OG as draft", () => {
    const record = approvedRecord();
    expect(record.draft.manifestRow.highlights).toBeDefined();
    const submission = buildSubmission(record);
    expect(submission.envelope.producer).toBe("pain-engine");
    expect(submission.envelope.mode).toBe("live");
    expect(submission.envelope.engineContractVersion).toBe(1);
    expect(submission.envelope.engineRunId).toBeNull();
    expect(submission.submissionId).toMatch(/^pe_[a-f0-9]{32}$/);
    expect(submission.artifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(submission.recordHash).toMatch(/^[a-f0-9]{64}$/);
    expect(submission.manifestRow.highlights).toBeUndefined();
    expect(submission.highlightsDropped).toBe(true);
    expect((submission.manifestRow.og as { status: string }).status).toBe("draft");
    expect(submission.manifestRow.publishedAt).toBeUndefined();
    expect(submission.manifestRow.source).toBe(`pain-engine:${record.slug}`);
    expect(submission.mdx).not.toContain("engine: true");
  });

  it("maps evidence to sources and claims with honest verification", () => {
    const submission = buildSubmission(approvedRecord());
    expect(submission.sources).toHaveLength(3);
    expect(submission.claims).toHaveLength(3);
    for (const source of submission.sources) {
      expect((source.verification as { status: string }).status).toBe("unverified");
    }
    expect(submission.sources[0].sourceType).toBe("community_discussion");
    expect(submission.claims[0].section).toBe("problem");
    expect(submission.claims[0].kind).toBe("observed");
  });

  it("maps the advisory verdict onto the recommendation", () => {
    const pivot = buildSubmission(
      approvedRecord((r) => {
        r.draft.scorecard.verdict = "PIVOT";
      }),
    );
    expect(pivot.verdict).toBe("PIVOT");
    expect(pivot.envelope.recommendation).toBe("needs_research");
    const build = buildSubmission(
      approvedRecord((r) => {
        r.draft.scorecard.verdict = "BUILD";
      }),
    );
    expect(build.envelope.recommendation).toBe("accept");
    const pass = buildSubmission(
      approvedRecord((r) => {
        r.draft.scorecard.verdict = "PASS";
      }),
    );
    expect(pass.envelope.recommendation).toBe("reject");
  });
});

describe("Pain Engine source review", () => {
  it("seals the review to the submitted record bytes and verifies", () => {
    const submission = buildSubmission(approvedRecord());
    expect(
      verifyPainEngineSourceReview(submission.sourceReview, submission.recordJson),
    ).toEqual([]);
    expect(submission.sourceReview.verdict).toBe("PASS");
    expect(submission.sourceReview.reviewer).toBe("pain-engine:human-approval");
    expect(submission.sourceReview.reviewedAt).toBe("2026-11-24T11:30:00.000Z");
    expect(submission.sourceReview.items).toHaveLength(3);
  });

  it("detects a tampered review and a mismatched record", () => {
    const submission = buildSubmission(approvedRecord());
    const tampered = {
      ...submission.sourceReview,
      items: submission.sourceReview.items.map((item, i) =>
        i === 0 ? { ...item, quote: "tampered" } : item,
      ),
    };
    expect(
      verifyPainEngineSourceReview(tampered, submission.recordJson),
    ).toContain("seal: does not match the document body (tampered or unsigned)");
    expect(
      verifyPainEngineSourceReview(submission.sourceReview, '{"slug":"other"}'),
    ).toContain("recordHash: does not match the submitted record bytes");
  });
});

describe("updateReviewRecordBookkeeping", () => {
  function tempRoot(record: ReviewRecord): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pain-engine-bridge-"));
    const dir = path.join(root, "engine", "pain", "review");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${record.slug}.json`), JSON.stringify(record, null, 2));
    return root;
  }

  it("records overrides and the prepared marker without touching the decision", () => {
    const record = approvedRecord();
    const root = tempRoot(record);
    const updated: ReviewRecord = {
      ...record,
      publishOverrides: {
        title: "Multi-account switching for Claude Desktop",
        productName: "Account Switcher",
        appliedAt: "2026-11-24T11:35:00.000Z",
      },
      submission: {
        status: "prepared",
        submissionId: "pe_0123456789abcdef0123456789abcdef",
        artifactHash: "a".repeat(64),
        recordHash: "b".repeat(64),
        highlightsDropped: true,
        preparedAt: "2026-11-24T11:35:00.000Z",
        ideaId: null,
      },
    };
    updateReviewRecordBookkeeping(root, updated);
    const saved = JSON.parse(
      fs.readFileSync(path.join(root, "engine", "pain", "review", `${record.slug}.json`), "utf8"),
    ) as ReviewRecord;
    expect(saved.status).toBe("approved");
    expect(saved.decidedAt).toBe("2026-11-24T11:30:00.000Z");
    expect(saved.publishOverrides?.title).toBe("Multi-account switching for Claude Desktop");
    expect(saved.submission?.status).toBe("prepared");
  });

  it("refuses to change the decision through bookkeeping", () => {
    const record = approvedRecord();
    const root = tempRoot(record);
    expect(() =>
      updateReviewRecordBookkeeping(root, { ...record, status: "rejected" }),
    ).toThrow(/status\/decidedAt changed/);
  });
});
