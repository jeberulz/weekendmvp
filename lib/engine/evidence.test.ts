import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evidenceIsStale,
  figureSupported,
  filterFiguresByPage,
  FRESHNESS_DAYS,
  supportingPassage,
} from "./evidence.ts";
import { escapeMdxProse, assertSafeMdx } from "./mdx-safety.ts";
import {
  extractAttributedQuotes,
  quotesAreExact,
} from "./quote-binding.mjs";
import { createProviders } from "./providers.ts";
import { runResearch, type BriefInput } from "./pipeline.ts";
import { RESEARCH_RECORD_V2 } from "./research-record.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const BRIEF: BriefInput = {
  title: "AI RFP Response Assistant",
  audience: "SMB SaaS sales and solutions engineers",
  revenueModel: "Seat-based SaaS with usage caps",
  seedKeywords: [
    "rfp response software",
    "security questionnaire automation",
    "proposal management software",
  ],
  slug: "ai-rfp-response-assistant",
  oneLiner: "Grounded RFP drafts with citations for SMB sales teams.",
};

describe("evidence identity", () => {
  it("records fixture runs as v2 with page-backed claims", async () => {
    const record = await runResearch({
      brief: BRIEF,
      providers: createProviders({ mode: "fixture" }),
      ranAt: "2026-09-27T00:00:00.000Z",
    });
    expect(record.contractVersion).toBe(RESEARCH_RECORD_V2);
    expect(record.run?.mode).toBe("fixture");
    expect(record.sources?.some((source) => source.outcome === "read")).toBe(true);
    expect(record.claims?.some((claim) => claim.verdict === "verified")).toBe(true);
    expect(record.claims?.some((claim) => claim.reason.includes("search text"))).toBe(
      false,
    );
    const sourceIds = new Set(record.sources?.map((source) => source.id));
    for (const claim of record.claims ?? []) {
      for (const id of claim.evidenceIds) {
        expect(sourceIds.has(id), `dangling evidence ${id}`).toBe(true);
      }
      if (claim.verdict === "verified") {
        expect(claim.excerpt.trim().length).toBeGreaterThan(0);
      }
    }
    expect(
      record.claims?.some(
        (claim) =>
          claim.verdict === "verified" &&
          record.community.signals.some((signal) => signal.quote === claim.text),
      ),
    ).toBe(true);
  });

  it("treats a price older than the price window as stale", () => {
    expect(FRESHNESS_DAYS.price).toBe(90);
    expect(
      evidenceIsStale("2026-01-01T00:00:00.000Z", "price", "2026-09-27T00:00:00.000Z"),
    ).toBe(true);
    expect(
      evidenceIsStale("2026-09-01T00:00:00.000Z", "price", "2026-09-27T00:00:00.000Z"),
    ).toBe(false);
  });
});

describe("complete claim verification", () => {
  it("rejects wrong subject, date, geography, currency and scale", () => {
    expect(
      figureSupported(
        "US dentists spent this much in 2025 $20 billion",
        "European pet owners spent $20 billion in 2010.",
      ),
    ).toBe(false);
    expect(figureSupported("20 million users", "20 users")).toBe(false);
    expect(figureSupported("£20 per month", "20 per year")).toBe(false);
    expect(figureSupported("£20 per month", "$20 per month")).toBe(false);
    expect(
      figureSupported(
        "US dentists spent this much in 2025 $20 billion",
        "US dentists spent $20 billion in 2025.",
      ),
    ).toBe(true);
  });

  it("stores a supporting passage after long navigation, not a page prefix", async () => {
    const page =
      "Navigation ".repeat(250) + " The market estimate is $20 billion.";
    const figure = "market estimate $20 billion";
    expect(figureSupported(figure, page)).toBe(true);
    expect(figureSupported(figure, page.slice(0, 400))).toBe(false);
    const passage = supportingPassage(figure, page);
    expect(passage).toBeTruthy();
    expect(passage!).toMatch(/\$20 billion/);
    expect(figureSupported(figure, passage!)).toBe(true);

    const { stats, claims } = await filterFiguresByPage({
      stats: [
        {
          claim: "market estimate",
          value: "$20 billion",
          citation: {
            title: "Report",
            url: "https://example.com/deep",
          },
        },
      ],
      competitors: [],
      fetchText: async () => page,
      retrievedAt: "2026-09-27T00:00:00.000Z",
    });
    expect(stats).toHaveLength(1);
    expect(claims[0]!.verdict).toBe("verified");
    expect(claims[0]!.excerpt).toMatch(/\$20 billion/);
    expect(claims[0]!.excerpt.startsWith("Navigation")).toBe(false);
  });
});

describe("mdx destination policy", () => {
  it("rejects javascript and credential narrative URLs", () => {
    expect(() =>
      assertSafeMdx("[source](javascript:alert%281%29)\n"),
    ).toThrow(/non-public Markdown destinations/);
    expect(() =>
      assertSafeMdx("[pricing](https://user:pass@example.com)\n"),
    ).toThrow(/non-public Markdown destinations/);
    expect(() => assertSafeMdx("[ok](https://example.com/a)\n")).not.toThrow();
  });
});

describe("quote binding after MDX escape", () => {
  it("matches entity-encoded and interior-quote blockquotes", () => {
    const original = 'R&D teams say "forms" burn weekends answering these forms.';
    const block = `> "${original}"\n>\n> — [r/sales](https://www.reddit.com/r/sales/)`;
    const escaped = escapeMdxProse(block);
    expect(escaped).toContain("&amp;");
    const extracted = extractAttributedQuotes(escaped);
    expect(extracted).toHaveLength(1);
    expect(quotesAreExact(extracted[0]!.quote, original)).toBe(true);
    expect(extracted[0]!.url).toBe("https://www.reddit.com/r/sales/");
  });
});

describe("audit CLI syntax", () => {
  it("parses under plain Node", () => {
    const result = spawnSync(
      process.execPath,
      ["--check", path.join(root, "scripts/audit-idea-mdx.mjs")],
      { encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
  });
});
