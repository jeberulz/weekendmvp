import { describe, expect, it } from "vitest";

import { buildFixtureRecord } from "../../engine/__fixtures__/recordV2";
import { publicationEvidenceIssues } from "./source-quality";

describe("publication evidence quality", () => {
  it("accepts selected statistics, buyer discussions and software prices with independent sources", () => {
    expect(publicationEvidenceIssues(buildFixtureRecord())).toEqual([]);
  });

  it("refuses two market figures from one publisher", () => {
    const record = buildFixtureRecord();
    const reportStats = record.evidence.accepted.filter(
      (item) => item.kind === "market_stat" && item.sourceUrl === "https://research.example.com/ai-code-review-market",
    );
    expect(reportStats).toHaveLength(2);
    record.market.statIds = reportStats.map((item) => item.id);
    expect(publicationEvidenceIssues(record)).toContain(
      "Selected market figures need at least two distinct source hosts.",
    );
  });

  it("refuses buyer quotations from one discussion even when their text differs", () => {
    const record = buildFixtureRecord();
    const forumQuotes = record.evidence.accepted.filter(
      (item) => item.kind === "community_quote" && item.sourceUrl === "https://forum.example.com/t/ai-review-noise",
    );
    expect(forumQuotes).toHaveLength(2);
    record.community.quoteIds = forumQuotes.map((item) => item.id);
    expect(publicationEvidenceIssues(record)).toContain(
      "Selected buyer quotations need at least two separate discussion URLs.",
    );
  });

  it("refuses a setup fee and a managed service presented as software prices", () => {
    const record = buildFixtureRecord();
    const firstPrice = record.evidence.accepted.find((item) => item.kind === "competitor_price");
    expect(firstPrice?.kind).toBe("competitor_price");
    if (firstPrice?.kind !== "competitor_price") throw new Error("fixture price missing");
    firstPrice.price.period = "one_time";
    firstPrice.excerpt = "Premium onboarding service costs $2,000 one time.";
    expect(publicationEvidenceIssues(record)).toContain(
      "CodeRabbit: a managed service or one-time setup fee is not a comparable software plan price.",
    );

    firstPrice.price.period = "month";
    firstPrice.excerpt = "Managed service costs $1,499 per month.";
    expect(publicationEvidenceIssues(record)).toContain(
      "CodeRabbit: a managed service or one-time setup fee is not a comparable software plan price.",
    );
  });
});
