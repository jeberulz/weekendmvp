import { describe, expect, it } from "vitest";

import { buildFixtureRecord } from "../../engine/__fixtures__/recordV2";
import { compileResearchRecord } from "../../engine/compile";
import { submissionArtifactHash } from "../domain/artifact";
import { runEngineChecks } from "./check-runner";
import { validateEngineSubmission } from "./validated-artifact";

async function world() {
  const record = buildFixtureRecord((draft) => {
    draft.mode = "live";
    draft.brief.slug = "signalpass-idea";
  });
  const compiled = compileResearchRecord({
    record,
    slug: record.brief.slug,
    category: "ai-tools",
    tools: ["cursor", "claude"],
    audiences: ["developers", "weekend-builders"],
    buildTime: "10",
    revenueGoal: "1k-month",
    publishedAt: "2026-10-01",
  });
  const manifestJson = JSON.stringify(compiled.manifestEntry);
  const checked = await validateEngineSubmission({ recordJson: JSON.stringify(record), mdx: compiled.mdx, manifestJson });
  const envelope = checked.envelope;
  const revision = {
    title: envelope.title,
    markdown: envelope.markdown,
    metadata: envelope.metadata,
    sources: envelope.sources.map((source) => ({ ...source, excerptHash: null, verificationAuthority: "engine_receipt" as const })),
    claims: envelope.claims.map((claim) => ({ ...claim, verificationAuthority: "engine_receipt" as const })),
  };
  return {
    record: {
      recordHash: checked.recordHash,
      recordJson: checked.recordJson,
      envelopeJson: JSON.stringify(envelope),
      manifestJson,
    },
    revision,
    slug: record.brief.slug,
    artifactHash: envelope.artifactHash,
    nowMs: Date.parse("2026-10-03T12:00:00Z"),
  };
}

describe("runEngineChecks", () => {
  it("passes the required deep check on a pinned and unchanged engine artifact", async () => {
    const input = await world();
    const checks = await runEngineChecks(input);
    expect(checks.find((check) => check.id === "engine-artifact-audit")?.outcome).toBe("pass");
    expect(checks.every((check) => check.evaluatedHash === input.artifactHash)).toBe(true);
    expect(checks.every((check) => check.producer === "engine")).toBe(true);
  });

  it("fails closed after an unsupported figure is edited into the saved revision", async () => {
    const input = await world();
    input.revision.markdown = input.revision.markdown.replace("$1.4 billion", "$9.4 billion");
    input.artifactHash = await submissionArtifactHash(input.revision);
    const checks = await runEngineChecks(input);
    expect(checks.find((check) => check.id === "engine-artifact-audit")?.outcome).toBe("fail");
    expect(checks.some((check) => check.id.startsWith("engine-audit-") && check.outcome === "fail")).toBe(true);
  });

  it("fails closed when the pinned record or highlights no longer match", async () => {
    const input = await world();
    input.record.recordHash = "0".repeat(64);
    expect((await runEngineChecks(input))[0]?.outcome).toBe("fail");
    const other = await world();
    other.revision.metadata = { ...other.revision.metadata, highlights: null };
    other.artifactHash = await submissionArtifactHash(other.revision);
    expect((await runEngineChecks(other))[0]?.outcome).toBe("fail");
  });
});
