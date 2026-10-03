import { auditEngineArtifact } from "../../engine/artifact-audit";
import { parseResearchRecord } from "../../engine/research-record";
import { qualityCheckInputSchema, type QualityCheck } from "../contracts/checks";
import { editorialSubmissionSchema } from "../contracts/submission";
import { claimContent, sourceContent } from "../domain/artifact";
import { sourceFreshness } from "../domain/freshness";
import { canonicalJson, sha256Hex } from "../domain/hash";
import type { RevisionRecord } from "../core/state";
import { LIVE_POLICY_VERSION, LIVE_REQUIRED_CHECK_IDS } from "../core/live";

export type PinnedEngineRecord = {
  recordHash: string;
  recordJson: string;
  envelopeJson: string;
  manifestJson: string;
};

type CheckInput = {
  record: PinnedEngineRecord;
  revision: Pick<RevisionRecord, "title" | "markdown" | "metadata" | "sources" | "claims">;
  slug: string;
  artifactHash: string;
  nowMs: number;
};

function oneLine(message: string): string {
  return message.replace(/\s+/g, " ").trim().slice(0, 590) || "Engine audit reported an issue.";
}

/**
 * Re-run the exact engine artifact auditor against saved editorial bytes.
 * Any missing or changed pinned evidence makes the required check fail.
 */
export async function runEngineChecks(input: CheckInput): Promise<QualityCheck[]> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let metrics: { verifiedQuotes: number; marketRows: number; competitorRows: number } | null = null;
  try {
    if (await sha256Hex(input.record.recordJson) !== input.record.recordHash) {
      throw new Error("Pinned research record hash mismatch.");
    }
    const record = parseResearchRecord(JSON.parse(input.record.recordJson));
    const envelope = editorialSubmissionSchema.parse(JSON.parse(input.record.envelopeJson));
    const manifest: unknown = JSON.parse(input.record.manifestJson);
    if (record.mode !== "live" || record.brief.slug !== input.slug || envelope.proposedSlug !== input.slug) {
      throw new Error("Pinned engine identity disagrees with this idea.");
    }
    if (input.revision.title !== envelope.title) errors.push("The saved title differs from the audited engine title.");
    if (canonicalJson(input.revision.metadata.highlights) !== canonicalJson(envelope.metadata.highlights)) {
      errors.push("The saved highlights differ from the evidence-bound engine highlights.");
    }
    if (
      canonicalJson(input.revision.sources.map(sourceContent)) !== canonicalJson(envelope.sources.map(sourceContent)) ||
      canonicalJson(input.revision.claims.map(claimContent)) !== canonicalJson(envelope.claims.map(claimContent))
    ) {
      errors.push("The saved source or claim content differs from the pinned engine submission.");
    }
    const audit = auditEngineArtifact(input.revision.markdown, record, { slug: input.slug, manifestRow: manifest });
    errors.push(...audit.errors);
    warnings.push(...audit.warnings);
    metrics = audit.metrics;
  } catch (error) {
    errors.push(error instanceof Error ? `Engine check could not validate its pinned record: ${oneLine(error.message)}` : "Engine check could not validate its pinned record.");
  }

  const at = new Date(input.nowMs).toISOString();
  const base = { policyVersion: LIVE_POLICY_VERSION, evaluatedHash: input.artifactHash, evaluatedAt: at, producer: "engine" as const };
  const checks: QualityCheck[] = [{
    ...base,
    id: LIVE_REQUIRED_CHECK_IDS[0],
    label: "Idea Engine deep artifact audit",
    category: "evidence",
    severity: "blocker",
    outcome: errors.length === 0 ? "pass" : "fail",
    message: errors.length === 0
      ? `Record-bound facts and MDX passed (${metrics?.verifiedQuotes ?? 0} quotes, ${metrics?.marketRows ?? 0} market rows, ${metrics?.competitorRows ?? 0} competitors).`
      : oneLine(`${errors.length} audit issue${errors.length === 1 ? "" : "s"}: ${errors[0]}`),
    locations: [],
  }];
  errors.slice(0, 20).forEach((message, index) => checks.push({
    ...base,
    id: `engine-audit-${index + 1}`,
    label: `Engine audit issue ${index + 1}`,
    category: "evidence",
    severity: "blocker",
    outcome: "fail",
    message: oneLine(message),
    locations: [],
  }));
  warnings.slice(0, 20).forEach((message, index) => checks.push({
    ...base,
    id: `engine-warning-${index + 1}`,
    label: `Engine audit warning ${index + 1}`,
    category: "content",
    severity: "warning",
    outcome: "warning",
    message: oneLine(message),
    locations: [],
  }));
  const priceSourceIds = new Set(input.revision.claims
    .filter((claim) => claim.topic === "pricing")
    .flatMap((claim) => claim.sourceIds));
  const stale = input.revision.sources.filter((source) => sourceFreshness(
    priceSourceIds.has(source.id) ? "first_party_pricing" : source.sourceType,
    source.retrievedAt,
    input.nowMs,
  ).freshness === "stale");
  checks.push({
    ...base,
    id: "engine-evidence-freshness",
    label: "Evidence freshness",
    category: "evidence",
    severity: "warning",
    outcome: stale.length === 0 ? "pass" : "warning",
    message: stale.length === 0 ? "All pinned sources are within their freshness windows." : `${stale.length} pinned source${stale.length === 1 ? " is" : "s are"} stale; review the current pages before approval.`,
    locations: stale.slice(0, 20).map((source) => ({ section: null, claimId: null, sourceId: source.id, line: null })),
  });
  // Fail closed if a future policy/result drift would not fit the DTO contract.
  for (const check of checks) {
    const { producer, ...dto } = check;
    if (producer !== "engine" || !qualityCheckInputSchema.safeParse(dto).success) {
      throw new Error("Engine check output violated the editorial check contract.");
    }
  }
  return checks;
}
