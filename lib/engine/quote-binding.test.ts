import { describe, expect, it } from "vitest";
import { extractAttributedQuotes, quotesAreExact } from "./quote-binding.mjs";

const sourceUrl = "https://example.com/discussion";

describe("attributed quote extraction", () => {
  it.each([
    "We spend 2-3 hours copying proposals every week.",
    "We spend 2–3 hours copying proposals every week.",
    "We copy proposals — and lose entire afternoons doing it.",
    'Our R&D team calls this "busy work" every week.',
  ])("preserves the entire visible quote: %s", (quote) => {
    const encoded = quote.replaceAll("&", "&amp;");
    expect(extractAttributedQuotes(`> "${encoded}"\n>\n> — [Source](${sourceUrl})`))
      .toEqual([{ quote, url: sourceUrl }]);
  });

  it("keeps soft breaks, hard breaks and paragraphs in the quote", () => {
    const body = `> "We waste entire afternoons\n> copying proposals.  \n> We need a better process.\n>\n> Nobody enjoys this work."\n>\n> — [Source](${sourceUrl})`;
    const result = extractAttributedQuotes(body);
    expect(result).toHaveLength(1);
    expect(quotesAreExact(result[0]!.quote, "We waste entire afternoons copying proposals. We need a better process. Nobody enjoys this work.")).toBe(true);
    expect(result[0]!.url).toBe(sourceUrl);
  });

  it("takes the URL from the attribution, not a link within the quote", () => {
    const body = `> "Our [current tool](https://example.com/product) wastes entire afternoons."\n>\n> — [Source](${sourceUrl})`;
    expect(extractAttributedQuotes(body)).toEqual([
      { quote: "Our current tool wastes entire afternoons.", url: sourceUrl },
    ]);
  });

  it("does not treat an ordinary quote link as attribution", () => {
    expect(extractAttributedQuotes('> "Our [current tool](https://example.com/product) wastes entire afternoons."'))
      .toEqual([{ quote: "Our current tool wastes entire afternoons.", url: "" }]);
  });

  it("does not bind a source from another blockquote", () => {
    const body = `> "We waste entire afternoons copying proposals."\n\nUnrelated prose.\n\n> — [Source](${sourceUrl})`;
    expect(extractAttributedQuotes(body)).toEqual([
      { quote: "We waste entire afternoons copying proposals.", url: "" },
    ]);
  });

  it("fails closed when an attribution has two different destinations", () => {
    const body = `> "We waste entire afternoons copying proposals."\n>\n> — [One](${sourceUrl}) and [Two](https://example.com/other)`;
    expect(extractAttributedQuotes(body)[0]!.url).toBe("");
  });

  it.each([
    "> - An unsupported added claim.",
    "> > An unsupported nested quotation.",
    "> ```text\n> An unsupported code claim.\n> ```",
  ])("does not bind quotes containing unsupported blocks: %s", (extra) => {
    const body = `> "We waste entire afternoons copying proposals."\n>\n${extra}\n>\n> — [Source](${sourceUrl})`;
    const result = extractAttributedQuotes(body);
    expect(result).toHaveLength(1);
    expect(result[0]!.quote).toContain("We waste entire afternoons");
    expect(result[0]!.url).toBe("");
  });
});
