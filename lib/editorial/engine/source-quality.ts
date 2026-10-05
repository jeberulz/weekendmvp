import type { AcceptedEvidence, ResearchRecordV2 } from "../../engine/evidence/contract";

/**
 * Structural publication checks on the evidence the writer actually selected.
 * These catch repeated source hosts and non-software fees; an editor must still
 * inspect the original pages, buyer context, and commercial comparability.
 */
export function publicationEvidenceIssues(record: ResearchRecordV2): string[] {
  const byId = new Map<string, AcceptedEvidence>(record.evidence.accepted.map((item) => [item.id, item]));
  const selected = (ids: readonly string[]) => ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const marketPublishers = new Set(
    selected(record.market.statIds).map((item) => new URL(item.sourceUrl).hostname.toLowerCase().replace(/^www\./, "")),
  );
  const quoteDiscussions = new Set(selected(record.community.quoteIds).map((item) => item.sourceUrl));
  const issues: string[] = [];

  if (marketPublishers.size < 2) {
    issues.push("Selected market figures need at least two distinct source hosts.");
  }
  if (quoteDiscussions.size < 2) {
    issues.push("Selected buyer quotations need at least two separate discussion URLs.");
  }

  for (const competitor of record.competitors) {
    for (const item of selected(competitor.priceIds)) {
      if (item.kind !== "competitor_price") continue;
      const description = `${item.plan ?? ""} ${item.excerpt}`;
      if (/\bmanaged[ -]service\b/iu.test(description) ||
          (item.price.period === "one_time" && /\b(?:onboarding|setup|implementation|training|consulting)\b/iu.test(description))) {
        issues.push(`${competitor.name}: a managed service or one-time setup fee is not a comparable software plan price.`);
      }
    }
  }

  return issues;
}
