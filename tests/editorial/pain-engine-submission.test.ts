/**
 * Unit tests for the Pain Engine editorial validator
 * (lib/editorial/engine/validated-pain-engine-artifact.ts).
 *
 * The fixture is a small, fully valid approved review record built in
 * memory; the submission artifacts come from the real bridge builder
 * (`buildSubmission`), so these tests exercise the real submission path —
 * only the record bytes are tampered with, the way a bad actor or a stale
 * file would.
 */
import { describe, expect, test } from "vitest";

import { submissionArtifactHash, type ArtifactInput } from "../../lib/editorial/domain/artifact";
import { validatePainEngineSubmission } from "../../lib/editorial/engine/validated-pain-engine-artifact";
import { buildSubmission, canonicalJson, sha256Hex } from "../../lib/pain-engine/publish";
import {
  buildApprovedFixtureRecord,
  FIXTURE_SLUG,
  FIXTURE_TITLE,
} from "../../lib/pain-engine/__fixtures__/approved-record";

function buildArtifacts(record: ReturnType<typeof buildApprovedFixtureRecord>) {
  const submission = buildSubmission(record);
  return {
    recordJson: submission.recordJson,
    mdx: submission.mdx,
    manifestJson: JSON.stringify(submission.manifestRow),
    sourceReviewJson: submission.sourceReviewJson,
    submission,
  };
}

describe("validatePainEngineSubmission", () => {
  test("accepts a valid approved fixture record", () => {
    const artifacts = buildArtifacts(buildApprovedFixtureRecord());
    const validated = validatePainEngineSubmission(artifacts);
    expect(validated.envelope.producer).toBe("pain-engine");
    expect(validated.envelope.mode).toBe("live");
    expect(validated.envelope.engineRunId).toBeNull();
    expect(validated.envelope.engineContractVersion).toBe(1);
    expect(validated.envelope.proposedSlug).toBe(FIXTURE_SLUG);
    expect(validated.envelope.title).toBe(FIXTURE_TITLE);
    expect(validated.envelope.submissionId).toBe(`pe_${validated.recordHash.slice(0, 32)}`);
    expect(validated.envelope.checks).toEqual([]);
    expect(validated.envelope.recommendation).toBe("accept");
    expect(validated.recordJson).toBe(artifacts.recordJson);
    expect(validated.recordHash).toBe(sha256Hex(artifacts.recordJson));
    expect(validated.envelope.sources.length).toBe(2);
    expect(validated.envelope.claims.length).toBe(2);
    for (const source of validated.envelope.sources) {
      expect(source.verification.status).toBe("unverified");
    }
    for (const claim of validated.envelope.claims) {
      expect(claim.verification.status).toBe("unverified");
    }
  });

  test("accepts a record with a recorded title override", () => {
    const record = buildApprovedFixtureRecord();
    record.publishOverrides = {
      title: "Quiet Hours, Booked Ahead",
      productName: "Quiet Hours",
      appliedAt: "2026-11-24T13:00:00.000Z",
    };
    const artifacts = buildArtifacts(record);
    const validated = validatePainEngineSubmission(artifacts);
    expect(validated.envelope.title).toBe("Quiet Hours, Booked Ahead");
    expect(validated.envelope.proposedSlug).toBe(FIXTURE_SLUG);
  });

  test("the envelope artifact hash matches the receiver's computation", async () => {
    // The import refuses the submission with ARTIFACT_HASH_MISMATCH when
    // the hash disagrees, so the bridge's synchronous hash must stay in
    // parity with the receiver's async submissionArtifactHash. If the
    // receiver's formula ever changes, this test fails first.
    const artifacts = buildArtifacts(buildApprovedFixtureRecord());
    const envelope = artifacts.submission.envelope;
    const receiverHash = await submissionArtifactHash(envelope as unknown as ArtifactInput);
    expect(envelope.artifactHash).toBe(receiverHash);
  });

  test("the artifact hash still matches when evidence slices end in a space", async () => {
    // The envelope schema trims every text field on parse, and the receiver
    // hashes the parsed values. A quote sliced mid-phrase (text.slice(0, 120)
    // landing on a space) used to make the bridge hash disagree with the
    // receiver's — the bridge must emit already-trimmed values.
    const record = buildApprovedFixtureRecord();
    const adversarialText = `${"A".repeat(119)} ${"B".repeat(30)}`;
    for (const list of [record.draft.evidence, record.cluster.findings]) {
      list[0].quote = "";
      list[0].text = adversarialText;
    }
    expect(record.draft.evidence[0].text.slice(0, 120)).toMatch(/ $/);
    const artifacts = buildArtifacts(record);
    const validated = validatePainEngineSubmission(artifacts);
    const receiverHash = await submissionArtifactHash(
      validated.envelope as unknown as ArtifactInput,
    );
    expect(validated.envelope.artifactHash).toBe(receiverHash);
  });

  test("refuses a non-approved record", () => {
    const approved = buildArtifacts(buildApprovedFixtureRecord());
    // Flip the approved record bytes to pending: the validator must refuse
    // on status before it ever trusts the source review.
    const pending = JSON.parse(approved.recordJson) as Record<string, unknown>;
    pending.status = "pending";
    delete pending.decidedAt;
    expect(() =>
      validatePainEngineSubmission({ ...approved, recordJson: canonicalJson(pending) }),
    ).toThrow(/must be approved/);
  });

  test("refuses a tampered record (source review no longer binds to it)", () => {
    const artifacts = buildArtifacts(buildApprovedFixtureRecord());
    const tampered = JSON.parse(artifacts.recordJson) as Record<string, unknown>;
    const draft = tampered.draft as Record<string, unknown>;
    draft.title = "Tampered Title for Shared Desks";
    const tamperedJson = canonicalJson(tampered);
    expect(() =>
      validatePainEngineSubmission({ ...artifacts, recordJson: tamperedJson }),
    ).toThrow(/source review failed verification/);
  });

  test("refuses a tampered source-review seal", () => {
    const artifacts = buildArtifacts(buildApprovedFixtureRecord());
    const review = JSON.parse(artifacts.sourceReviewJson) as Record<string, unknown>;
    review.seal = "0".repeat(64);
    expect(() =>
      validatePainEngineSubmission({ ...artifacts, sourceReviewJson: canonicalJson(review) }),
    ).toThrow(/source review failed verification/);
  });

  test("refuses a swapped manifest row (wrong source)", () => {
    const artifacts = buildArtifacts(buildApprovedFixtureRecord());
    const manifest = JSON.parse(artifacts.manifestJson) as Record<string, unknown>;
    manifest.source = `engine:${FIXTURE_SLUG}`;
    expect(() =>
      validatePainEngineSubmission({ ...artifacts, manifestJson: JSON.stringify(manifest) }),
    ).toThrow(/Manifest row does not match/);
  });

  test("refuses a swapped MDX", () => {
    const artifacts = buildArtifacts(buildApprovedFixtureRecord());
    expect(() =>
      validatePainEngineSubmission({ ...artifacts, mdx: artifacts.mdx.replace("too noisy", "too loud") }),
    ).toThrow(/MDX does not match/);
  });

  test("refuses MDX missing a canonical section", () => {
    const record = buildApprovedFixtureRecord();
    record.draft.mdx = record.draft.mdx.replace("## Market Research\n\n", "");
    const artifacts = buildArtifacts(record);
    expect(() => validatePainEngineSubmission(artifacts)).toThrow(/canonical sections in order/);
  });

  test("refuses MDX missing the How-it-works list", () => {
    const record = buildApprovedFixtureRecord();
    record.draft.mdx = record.draft.mdx.replace(
      "**How it works:**\n\n1. **Pick a quiet slot** — members book an hour in a low-noise zone.\n2. **Hold the desk** — the desk is held for that hour, no walk-ins.\n3. **Focus, then leave** — the slot ends and the desk returns to open use.",
      "**How it works:**\n\nJust book a slot and focus.",
    );
    const artifacts = buildArtifacts(record);
    expect(() => validatePainEngineSubmission(artifacts)).toThrow(/numbered list/);
  });

  test("refuses MDX claiming engine: true", () => {
    const record = buildApprovedFixtureRecord();
    record.draft.mdx = record.draft.mdx.replace(
      `title: "${FIXTURE_TITLE}"`,
      `title: "${FIXTURE_TITLE}"\nengine: true`,
    );
    const artifacts = buildArtifacts(record);
    expect(() => validatePainEngineSubmission(artifacts)).toThrow(/must not claim engine: true/);
  });
});
