/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { validatePainEngineSubmission } from "../../lib/editorial/engine/validated-pain-engine-artifact";
import { sha256Hex } from "../../lib/editorial/domain/hash";
import { buildSubmission, canonicalJson } from "../../lib/pain-engine/publish";
import { buildApprovedFixtureRecord } from "../../lib/pain-engine/__fixtures__/approved-record";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

function input() {
  const submission = buildSubmission(buildApprovedFixtureRecord());
  return {
    recordJson: submission.recordJson,
    mdx: submission.mdx,
    manifestJson: JSON.stringify(submission.manifestRow),
    sourceReviewJson: submission.sourceReviewJson,
  };
}

describe("private Pain Engine ingestion", () => {
  test("the Node validator and one transaction bind the candidate to its normalized record", async () => {
    const t = convexTest(schema, modules);
    const source = input();
    const checked = await validatePainEngineSubmission(source);
    const args = {
      envelope: JSON.stringify(checked.envelope),
      recordJson: checked.recordJson,
      recordHash: checked.recordHash,
      manifestJson: source.manifestJson,
    };
    const first = await t.action(internal.editorial.ingest.validateAndImportPainEngine, source);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.duplicate).toBe(false);
    expect(first.value.slugConflict).toBe(false);
    const second = await t.mutation(internal.editorial.service.importValidatedPainEngine, args);
    expect(second.ok && second.value.duplicate).toBe(true);
    const rows = await t.run(async (ctx) => ctx.db.query("editorial_pain_engine_records").take(10));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ideaId).toBe(first.value.ideaId);
    expect(rows[0]?.recordHash).toBe(checked.recordHash);
    expect(rows[0]?.submissionId).toBe(checked.envelope.submissionId);
    const revisions = await t.run(async (ctx) => ctx.db.query("editorial_revisions").take(10));
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.origin).toBe("manual");
    expect(revisions[0]?.checks).toEqual([]);
    expect(revisions[0]?.claims.every((claim) => claim.verificationAuthority === "none")).toBe(true);
    expect(revisions[0]?.sources.every((source) => source.verificationAuthority === "none")).toBe(true);
    const ideas = await t.run(async (ctx) => ctx.db.query("editorial_ideas").take(10));
    expect(ideas).toHaveLength(1);
    expect(ideas[0]?.origin).toBe("manual");
    expect(ideas[0]?.slugConflict).toBe(false);
  });

  test("a changed record hash or a non-approved status is refused before a candidate is stored", async () => {
    const t = convexTest(schema, modules);
    const source = input();
    const checked = await validatePainEngineSubmission(source);
    const args = {
      envelope: JSON.stringify(checked.envelope),
      recordJson: checked.recordJson,
      recordHash: "0".repeat(64),
      manifestJson: source.manifestJson,
    };
    await expect(t.mutation(internal.editorial.service.importValidatedPainEngine, args)).rejects.toThrow(
      /Pain Engine review record hash mismatch/,
    );
    const pending = JSON.parse(checked.recordJson) as Record<string, unknown>;
    pending.status = "pending";
    delete pending.decidedAt;
    const pendingJson = canonicalJson(pending);
    await expect(
      t.mutation(internal.editorial.service.importValidatedPainEngine, {
        ...args,
        recordJson: pendingJson,
        recordHash: await sha256Hex(pendingJson),
      }),
    ).rejects.toThrow(/Pain Engine record and editorial envelope disagree/);
    expect(await t.run(async (ctx) => ctx.db.query("editorial_pain_engine_records").take(10))).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.query("editorial_ideas").take(10))).toEqual([]);
  });

  test("a tampered source-review seal is refused by the action before anything is stored", async () => {
    const t = convexTest(schema, modules);
    const source = input();
    const review = JSON.parse(source.sourceReviewJson) as Record<string, unknown>;
    review.seal = "0".repeat(64);
    await expect(
      t.action(internal.editorial.ingest.validateAndImportPainEngine, {
        ...source,
        sourceReviewJson: canonicalJson(review),
      }),
    ).rejects.toThrow(/source review failed verification/);
    expect(await t.run(async (ctx) => ctx.db.query("editorial_pain_engine_records").take(10))).toEqual([]);
    expect(await t.run(async (ctx) => ctx.db.query("editorial_ideas").take(10))).toEqual([]);
  });

  test("a different record for the same slug is a slug conflict, not a replacement", async () => {
    const t = convexTest(schema, modules);
    const firstSource = input();
    const first = await t.action(internal.editorial.ingest.validateAndImportPainEngine, firstSource);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const other = buildSubmission(
      buildApprovedFixtureRecord({ findingText: "A different report of the same shared-desk noise." }),
    );
    const second = await t.action(internal.editorial.ingest.validateAndImportPainEngine, {
      recordJson: other.recordJson,
      mdx: other.mdx,
      manifestJson: JSON.stringify(other.manifestRow),
      sourceReviewJson: other.sourceReviewJson,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.slugConflict).toBe(true);
    expect(second.value.ideaId).not.toBe(first.value.ideaId);
    const rows = await t.run(async (ctx) => ctx.db.query("editorial_pain_engine_records").take(10));
    expect(rows).toHaveLength(2);
    // The first idea's pinned record is untouched by the second import.
    const firstRow = rows.find((row) => row.ideaId === first.value.ideaId);
    expect(firstRow?.recordHash).toBe(await sha256Hex(firstSource.recordJson));
  });
});
