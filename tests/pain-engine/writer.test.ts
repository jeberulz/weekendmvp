import { describe, expect, it } from "vitest";

import { clusterFindings } from "../../lib/pain-engine/cluster";
import { WRITER_WORD_TARGET, writeDraft } from "../../lib/pain-engine/writer";
import type { PainFinding } from "../../lib/pain-engine/types";

const CANONICAL_HEADINGS = [
  "## The Problem",
  "## The Solution",
  "## Market Research",
  "## Competitive Landscape",
  "## Business Model",
  "## Recommended Tech Stack",
  "## AI Prompts to Build This",
  "## Sources",
];

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

describe("writeDraft — house MDX format", () => {
  const [cluster] = clusterFindings(findings());
  const draft = writeDraft(cluster);

  it("uses the exact eight headings in canonical order", () => {
    const positions = CANONICAL_HEADINGS.map((h) => draft.mdx.indexOf(h));
    for (const pos of positions) expect(pos).toBeGreaterThanOrEqual(0);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("has slug + title frontmatter and deliberately no engine:true marker", () => {
    expect(draft.mdx.startsWith(`---\nslug: "${draft.slug}"\ntitle: "`)).toBe(true);
    expect(draft.mdx).not.toContain("engine: true");
  });

  it("includes the How it works list under The Solution", () => {
    expect(draft.mdx).toContain("**How it works:**");
  });

  it("quotes only real evidence, with links to the sources", () => {
    expect(draft.mdx).toContain("I spend 3 hours every Friday doing invoices by hand and I hate it.");
    expect(draft.mdx).toContain("https://www.reddit.com/r/smallbusiness/comments/fixture1/");
    expect(draft.mdx).toContain("https://news.ycombinator.com/item?id=40000001");
  });

  it("invents no market stats and no competitor pricing", () => {
    expect(draft.mdx).not.toMatch(/\$\d+(\.\d+)?\s*(billion|million)/i);
    expect(draft.mdx).not.toContain("TAM");
    expect(draft.mdx).toContain("No market sizing was found in the evidence");
    expect(draft.mdx).toContain("No competitor pricing was verified");
  });

  it("labels proposed pricing as an assumption, not observed data", () => {
    expect(draft.mdx).toContain("an assumption, not observed market data");
  });

  it("meets the 2,200-word deep target and reports it in the manifest row", () => {
    const words = draft.mdx.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(WRITER_WORD_TARGET);
    expect(draft.manifestRow.provenance).toMatchObject({
      wordCount: words,
      researchMode: "pain-engine",
      auditPassed: false,
    });
    expect(draft.manifestRow.researchLevel).toBe("deep");
  });

  it("builds a manifest row in the exact manifest shape", () => {
    expect(draft.manifestRow.source).toBe(`pain-engine:${draft.slug}`);
    expect(draft.manifestRow.category).toBe("fintech");
    expect(draft.manifestRow.tools).toEqual(["claude", "cursor", "v0"]);
    expect(Array.isArray(draft.manifestRow.audiences)).toBe(true);
    expect((draft.manifestRow.audiences as string[]).length).toBeGreaterThanOrEqual(2);
    const scores = draft.manifestRow.scores as Record<string, number>;
    for (const key of ["opportunity", "pain", "timing", "builder_confidence"]) {
      expect(scores[key]).toBeGreaterThanOrEqual(1);
      expect(scores[key]).toBeLessThanOrEqual(10);
    }
    expect((draft.manifestRow.og as { status: string }).status).toBe("draft");
    expect(draft.manifestRow.publishedAt).toBeUndefined();
  });

  it("flags gaps instead of inventing missing evidence", () => {
    expect(draft.gaps.length).toBeGreaterThanOrEqual(2);
    expect(draft.gaps.join(" ")).toContain("market sizing");
    expect(draft.costUsd).toBe(0);
  });

  it("keeps the real quote in highlights within the 190-char limit", () => {
    const highlights = draft.manifestRow.highlights as { problemQuote: string };
    expect(highlights.problemQuote.length).toBeLessThanOrEqual(190);
  });
});
