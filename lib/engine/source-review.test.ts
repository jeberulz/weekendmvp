/**
 * Hermetic Source Critic gate tests (P2).
 * No network, no providers: synthetic fixture record + sealed reviews only.
 */

import { describe, expect, it } from "vitest";

import { buildFixtureRecord } from "./__fixtures__/recordV2.ts";
import { writeCompiledIdea } from "./compile-write.ts";
import {
  assertSourceReviewPass,
  buildPassingSourceReview,
  parseSourceReviewDocument,
  researchRecordHash,
  sealSourceReview,
  SourceReviewError,
  stableJson,
} from "./source-review.ts";
import { sha256Hex } from "./evidence/accept.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function liveRecord() {
  return buildFixtureRecord((draft) => {
    draft.mode = "live";
    draft.brief.slug = "source-critic-gate-idea";
  });
}

describe("source review contract", () => {
  it("refuses a missing review for live research", () => {
    const record = liveRecord();
    expect(() => assertSourceReviewPass(record, undefined)).toThrow(SourceReviewError);
    expect(() => assertSourceReviewPass(record, undefined)).toThrow(/source review required/);
  });

  it("refuses a FAIL verdict even when coverage looks complete", () => {
    const record = liveRecord();
    const pass = buildPassingSourceReview(record);
    const { seal: _seal, ...unsigned } = pass;
    const failed = sealSourceReview({
      ...unsigned,
      verdict: "FAIL",
      failures: ["quote is off-topic for the buyer job"],
    });
    expect(() => assertSourceReviewPass(record, failed)).toThrow(/verdict: FAIL/);
  });

  it("refuses a tampered seal", () => {
    const record = liveRecord();
    const pass = buildPassingSourceReview(record);
    const tampered = { ...pass, reviewer: "attacker" };
    expect(() => parseSourceReviewDocument(tampered)).toThrow(/seal mismatch/);
  });

  it("refuses a review bound to a different record hash", () => {
    const record = liveRecord();
    const pass = buildPassingSourceReview(record);
    const { seal: _seal, ...unsigned } = pass;
    const stale = sealSourceReview({
      ...unsigned,
      recordHash: "a".repeat(64),
    });
    expect(() => assertSourceReviewPass(record, stale)).toThrow(/recordHash/);
  });

  it("refuses when a required check is false", () => {
    const record = liveRecord();
    const pass = buildPassingSourceReview(record);
    const { seal: _seal, ...unsigned } = pass;
    const items = unsigned.items.map((item, index) =>
      index === 0
        ? {
            ...item,
            checks: { ...item.checks, excerptMatchesPage: false },
          }
        : item,
    );
    const bad = sealSourceReview({ ...unsigned, items });
    expect(() => assertSourceReviewPass(record, bad)).toThrow(/required checks are not true/);
  });

  it("refuses when required market/competitor coverage is missing", () => {
    const record = liveRecord();
    const pass = buildPassingSourceReview(record);
    const { seal: _seal, ...unsigned } = pass;
    const items = unsigned.items.filter((item) => item.kind === "community_quote");
    const thin = sealSourceReview({ ...unsigned, items });
    expect(() => assertSourceReviewPass(record, thin)).toThrow(/missing required evidence/);
  });

  it("accepts a sealed PASS that covers claims and two quotes", () => {
    const record = liveRecord();
    const pass = buildPassingSourceReview(record);
    expect(assertSourceReviewPass(record, pass).verdict).toBe("PASS");
    expect(pass.recordHash).toBe(researchRecordHash(record));
    expect(pass.seal).toBe(sha256Hex(stableJson((({ seal: _s, ...rest }) => rest)(pass))));
  });

  it("allows fixture mode without a review (replay path)", () => {
    const record = buildFixtureRecord();
    expect(record.mode).toBe("fixture");
    expect(assertSourceReviewPass(record, undefined).reviewer).toBe("fixture-exempt");
  });
});

describe("compile-write Source Critic gate", () => {
  it("refuses to write a live record without a review", () => {
    const record = liveRecord();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "src-review-"));
    tempDirs.push(dir);
    expect(() =>
      writeCompiledIdea({
        record,
        slug: record.brief.slug,
        ideasDir: dir,
        writeManifest: false,
        allowFixture: true,
      }),
    ).toThrow(/Source Critic PASS/);
    expect(fs.existsSync(path.join(dir, `${record.brief.slug}.mdx`))).toBe(false);
  });

  it("writes a live record when a sealed PASS review is supplied", () => {
    const record = liveRecord();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "src-review-"));
    tempDirs.push(dir);
    const written = writeCompiledIdea({
      record,
      slug: record.brief.slug,
      ideasDir: dir,
      writeManifest: false,
      allowFixture: true,
      sourceReview: buildPassingSourceReview(record),
    });
    expect(fs.existsSync(written.mdxPath)).toBe(true);
  });
});
