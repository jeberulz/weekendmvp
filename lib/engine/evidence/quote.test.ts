import { createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";

import {
  escapeMdxText,
  findContiguousSpan,
  normalizeExcerptForCompare,
  normalizeForSourceMatch,
  normalizeQuoteForCompare,
  quoteMatchesExcerpt,
  unescapeMdxText,
  wordCount,
} from "./quote.ts";

const SOURCE =
  "Our PR queue has basically exploded, and I’m watching   talented engineers\n" +
  "drown in review work. Nobody on the team has time to read every diff. " +
  "We tried three tools last quarter.";

describe("normalizeForSourceMatch", () => {
  it("is word-level, case- and punctuation-insensitive, with a map back to the source", () => {
    const form = normalizeForSourceMatch("Don’t PANIC—it's   fine, café 1,400.");
    expect(form.words).toEqual(["dont", "panic", "its", "fine", "café", "1", "400"]);
    expect(form.normalized).toBe("dont panic its fine café 1 400");
    const text = "Don’t PANIC—it's   fine, café 1,400.";
    expect(form.map.map((m) => text.slice(m.start, m.end))).toEqual([
      "Don’t",
      "PANIC",
      "it's",
      "fine",
      "café",
      "1",
      "400",
    ]);
  });

  it("treats NFC and NFD spellings of a word as the same word", () => {
    const nfd = "café latte";
    expect(normalizeForSourceMatch(nfd).words).toEqual(normalizeForSourceMatch("café latte").words);
  });
});

describe("findContiguousSpan", () => {
  it("returns a contiguous match in the source's own characters (curly quotes, odd whitespace, line breaks)", () => {
    const candidate = "\"I'm watching talented engineers drown in review work\"";
    const span = findContiguousSpan(candidate, SOURCE);
    expect(span).toEqual({
      ok: true,
      start: SOURCE.indexOf("I’m"),
      end: SOURCE.indexOf("work.") + "work.".length,
      text: "I’m watching   talented engineers\ndrown in review work.",
    });
  });

  it("strips leading and trailing ellipses as truncation marks", () => {
    const span = findContiguousSpan("...nobody on the team has time to read every diff…", SOURCE);
    expect(span.ok && span.text).toBe("Nobody on the team has time to read every diff.");
  });

  it("rejects an internal ellipsis that would join separate fragments", () => {
    expect(findContiguousSpan("Our PR queue has basically exploded ... read every diff", SOURCE)).toEqual({
      ok: false,
      reason: "internal_ellipsis",
    });
    expect(findContiguousSpan("Our PR queue … read every diff", SOURCE)).toEqual({ ok: false, reason: "internal_ellipsis" });
    expect(findContiguousSpan("Our PR queue [...] read every diff", SOURCE)).toEqual({ ok: false, reason: "internal_ellipsis" });
  });

  it("rejects a fabricated suffix or prefix around a real span", () => {
    expect(findContiguousSpan("drown in review work and it cost us millions", SOURCE)).toEqual({
      ok: false,
      reason: "span_not_found",
    });
    expect(findContiguousSpan("Honestly our PR queue has basically exploded", SOURCE)).toEqual({
      ok: false,
      reason: "span_not_found",
    });
  });

  it("rejects fragments that are each present but not contiguous", () => {
    expect(findContiguousSpan("Our PR queue has time to read every diff", SOURCE)).toEqual({
      ok: false,
      reason: "span_not_found",
    });
  });

  it("matches whole words only and needs at least one word", () => {
    expect(findContiguousSpan("eam has time", SOURCE)).toEqual({ ok: false, reason: "span_not_found" });
    expect(findContiguousSpan("“ — ”", SOURCE)).toEqual({ ok: false, reason: "span_bounds" });
  });

  it("keeps a glued currency sign and percent from the source, not from the candidate", () => {
    const source = "Honestly paying €500 a month for this is insane, it ate 60% of our budget.";
    const span = findContiguousSpan("$500 a month for this is insane, it ate 60", source);
    expect(span.ok && span.text).toBe("€500 a month for this is insane, it ate 60%");
  });
});

describe("strict quote comparison", () => {
  const original = "AI code often looks good but doesn’t tell you the story of the implementation.";

  it("treats typographic quote, whitespace and line-break differences as equal", () => {
    expect(quoteMatchesExcerpt("AI code often looks good but doesn't tell you\nthe   story of the implementation.", original)).toBe(true);
    expect(normalizeQuoteForCompare("“Fast” — they said…")).toBe(normalizeQuoteForCompare('"Fast" - they said...'));
  });

  it("treats an appended sentence as unequal", () => {
    expect(
      quoteMatchesExcerpt(`${original} This product increased our revenue by nine million dollars overnight.`, original),
    ).toBe(false);
  });

  it("treats a changed number as unequal", () => {
    const quote = "Sales teams spend an average of 25-30 hours per RFP.";
    expect(quoteMatchesExcerpt("Sales teams spend an average of 25-35 hours per RFP.", quote)).toBe(false);
  });

  it('treats an inserted "not" as unequal', () => {
    expect(quoteMatchesExcerpt("AI code often does not look good but doesn’t tell you the story of the implementation.", original)).toBe(false);
  });

  it("treats reordered fragments as unequal", () => {
    expect(quoteMatchesExcerpt("The story of the implementation: AI code often looks good but doesn’t tell you.", original)).toBe(false);
  });

  it("keeps case and other punctuation significant", () => {
    expect(quoteMatchesExcerpt(original.toUpperCase(), original)).toBe(false);
    expect(quoteMatchesExcerpt(original.replace(".", "!"), original)).toBe(false);
  });

  it("undoes MDX escapes on rendered text but never unescapes a record excerpt", () => {
    const excerpt = "Use snake\\_case and *stars* in {braces} <tags> & C#.";
    const rendered = escapeMdxText(excerpt);
    expect(quoteMatchesExcerpt(rendered, excerpt)).toBe(true);
    expect(normalizeQuoteForCompare(rendered)).toBe(normalizeExcerptForCompare(excerpt));
  });
});

// ---------------------------------------------------------------------------
// MDX escaping
// ---------------------------------------------------------------------------

const HOSTILE = [
  "{props.secret} and {`template`} }",
  "<script>alert(1)</script> <Callout>hi</Callout> </x>",
  "[click](https://evil.example) ![img](x.png) <https://x.example>",
  "**bold** __strong__ *em* _em_ ~~gone~~ `code` ``double``",
  "# Heading\n## Sub\n###### Six",
  "> nested quote\n>> deeper",
  "- item\n+ item\n* item\n1. one\n2) two\n10. ten",
  "| a | b |\n|---|---|\n| 1 | 2 |",
  "title\n===\nother\n---",
  "back\\slash \\*already escaped\\* \\\\ double \\",
  "&amp; &lt;tag&gt; &#123; &#x7B; &copy; & alone",
  "<!-- comment --> <div>raw</div>",
  "export const leak = 1;\nimport x from 'y'",
  "C# and F# notes #hashtag",
  "~~~\nfence\n~~~\n```js\ncode\n```",
  "a\nb  \nc\\\nd",
  "[^1] footnote and [ ] task [x] done",
  "$5 and 100% and 3 > 2 < 4",
  "    indented code?",
  "*\n* * *\n___",
  "  - indented marker\n   1. indented number",
  "https://autolink.example.com and www.example.com, HTTP://LOUD.example> mail me@example.com",
  "see https://x.example*bold* and <https://y.example>",
];

type MdNode = { type: string; value?: unknown; children?: MdNode[] };

function parseMdx(source: string): MdNode {
  const processor = createProcessor({ remarkPlugins: [remarkGfm] });
  return processor.parse(source) as unknown as MdNode;
}

function nodeTypes(node: MdNode, out: Set<string> = new Set()): Set<string> {
  out.add(node.type);
  for (const child of node.children ?? []) nodeTypes(child, out);
  return out;
}

function visibleText(node: MdNode): string {
  if (node.type === "text" && typeof node.value === "string") return node.value;
  if (node.type === "break") return "\n";
  return (node.children ?? []).map(visibleText).join(node.type === "root" || node.type === "blockquote" ? "\n" : "");
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** Links other than remark-gfm's bare-URL/email links, whose visible text is the URL itself. */
function nonLiteralLinks(node: MdNode): string[] {
  const text = visibleText(node);
  const literal = /^(?:(?:https?:\/\/|www\.)\S+|[^\s@]+@[^\s@]+)$/i.test(text);
  const own = node.type === "link" && !literal ? [text] : [];
  return [...own, ...(node.children ?? []).flatMap(nonLiteralLinks)];
}

describe("escapeMdxText / unescapeMdxText", () => {
  it("round-trips hostile strings exactly", () => {
    for (const text of HOSTILE) {
      expect(unescapeMdxText(escapeMdxText(text))).toBe(text);
    }
  });

  it("round-trips a deterministic fuzz corpus of Markdown/MDX punctuation", () => {
    const alphabet = ["\\", "<", ">", "{", "}", "[", "]", "*", "_", "`", "~", "|", "&", "#", "@", ":", "-", "+", "=", ".", ")", "1", "a", " ", "\n", "import ", "export ", "&#105;", "\\&", "https://", "www.", "\\:"];
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let n = 0; n < 500; n += 1) {
      let text = "";
      const length = next() % 24;
      for (let i = 0; i < length; i += 1) text += alphabet[next() % alphabet.length];
      expect(unescapeMdxText(escapeMdxText(text))).toBe(text);
    }
  });

  it("renders hostile strings literally as MDX prose (only paragraph text nodes)", () => {
    for (const text of HOSTILE) {
      const tree = parseMdx(escapeMdxText(text));
      const types = [...nodeTypes(tree)].filter((t) => !["root", "paragraph", "text", "break", "link"].includes(t));
      expect(types, text).toEqual([]);
      expect(nonLiteralLinks(tree), text).toEqual([]);
      expect(collapse(visibleText(tree)), text).toBe(collapse(text));
    }
  });

  it("renders hostile strings literally inside a blockquote", () => {
    for (const text of HOSTILE) {
      const quoted = escapeMdxText(text)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      const tree = parseMdx(quoted);
      const types = [...nodeTypes(tree)].filter((t) => !["root", "blockquote", "paragraph", "text", "break", "link"].includes(t));
      expect(types, text).toEqual([]);
      expect(nonLiteralLinks(tree), text).toEqual([]);
      expect(collapse(visibleText(tree)), text).toBe(collapse(text));
    }
  });

  it("escapes block markers only at the start of a line", () => {
    expect(escapeMdxText("- a-b\n1. step 1.5")).toBe("\\- a-b\n1\\. step 1.5");
    expect(escapeMdxText("export data\nwe export data")).toBe("&#101;xport data\nwe export data");
  });

  it("leaves ordinary prose unchanged", () => {
    const prose = "Sales engineers lose two days a week to questionnaires, so they copy old answers.";
    expect(escapeMdxText(prose)).toBe(prose);
  });
});

describe("wordCount", () => {
  it("counts whitespace-separated tokens that hold a letter or digit", () => {
    expect(wordCount("AI-generated PRs cost $24.99 — really!")).toBe(5);
    expect(wordCount("  ")).toBe(0);
  });
});
