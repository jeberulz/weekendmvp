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

/** Visible text compared without the invisible autolink breaks (U+2060) the escape inserts. */
const collapse = (text: string) => text.replace(/\u2060/g, "").replace(/\s+/g, " ").trim();

/** Every link node, as its visible text (security S-P2b: the escape must leave none). */
function links(node: MdNode): string[] {
  const own = node.type === "link" ? [visibleText(node)] : [];
  return [...own, ...(node.children ?? []).flatMap(links)];
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

  // Security S-P2b / ruling R10: the old tests tolerated remark-gfm's bare
  // URL and email links ("literal" links). The escape now leaves no link at
  // all, so these assert none.
  it("renders hostile strings literally as MDX prose: paragraph text only, no link of any kind", () => {
    for (const text of HOSTILE) {
      const tree = parseMdx(escapeMdxText(text));
      const types = [...nodeTypes(tree)].filter((t) => !["root", "paragraph", "text", "break"].includes(t));
      expect(types, text).toEqual([]);
      expect(links(tree), text).toEqual([]);
      expect(collapse(visibleText(tree)), text).toBe(collapse(text));
    }
  });

  it("renders hostile strings literally inside a blockquote, with no link of any kind", () => {
    for (const text of HOSTILE) {
      const quoted = escapeMdxText(text)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      const tree = parseMdx(quoted);
      const types = [...nodeTypes(tree)].filter((t) => !["root", "blockquote", "paragraph", "text", "break"].includes(t));
      expect(types, text).toEqual([]);
      expect(links(tree), text).toEqual([]);
      expect(collapse(visibleText(tree)), text).toBe(collapse(text));
    }
  });

  it("S-P2b: bare URLs, www hosts and emails cannot autolink, and read exactly as written", () => {
    const hostile = [
      "Honestly the only fix that worked for us is at https://example.invalid/tool and it saved our quarter.",
      "Read the full playbook at https://example.invalid/offer before you buy anything.",
      "Visit www.example.invalid or WWW.EXAMPLE.INVALID/path, mail sales@example.invalid or mailto:a.b+c@example.invalid now.",
      "(https://a.example) *www.b.example* _c@d.example_ ~https://e.example~ HTTPS://F.EXAMPLE/x?y=1",
      "https://www.example.invalid/path#frag and http://user@example.invalid",
    ];
    for (const text of hostile) {
      const escaped = escapeMdxText(text);
      for (const doc of [`Lead text. ${escaped}`, `> ${escaped}`, `- **${escaped}** — row`]) {
        const tree = parseMdx(doc);
        expect(links(tree), doc).toEqual([]);
      }
      expect(collapse(visibleText(parseMdx(escaped)))).toBe(collapse(text));
      expect(unescapeMdxText(escaped)).toBe(text);
      expect(quoteMatchesExcerpt(escaped, text)).toBe(true);
    }
  });

  it("does not let a line become a GFM table delimiter row", () => {
    for (const text of ["a<export ***|<div>&amp;,\r\n:- ", "Plan\n:---:\nrow", "x\n:-:"]) {
      const tree = parseMdx(escapeMdxText(text));
      expect([...nodeTypes(tree)].filter((t) => !["root", "paragraph", "text", "break"].includes(t)), text).toEqual([]);
      expect(unescapeMdxText(escapeMdxText(text))).toBe(text);
    }
  });

  it("parses a deterministic fuzz corpus into plain text with no links, in prose, quote and label contexts", () => {
    const alphabet = [
      "a", "b", "x", "1", "9", " ", "  ", "\t", "\n", "\n\n", "\u00a0", "\u2003", "\u3000", "\u200b", "\\", "<", ">", "{", "}", "[", "]", "(", ")", "*", "_", "`",
      "~", "|", "&", "#", "@", "!", ":", ";", "-", "+", "=", ".", ",", "'", '"', "/", "?", "%", "$",
      "import ", "export ", "http://", "https://", "HTTPS://", "www.", "WWW.", "mailto:", "me@x.example", "a.b@c.d",
      "x.example", "&amp;", "&#123;", "&lt;", "&#x2060;", "\u2060", "1. ", "1) ", "- ", "+ ", "* ", "> ", "# ", "```", "~~~",
      "---", "===", "***", "___", ":-", ":-:", "[^1]", "[x]: http://e.example", "<div>", "{1+1}", "![a](b)", "[a](b)",
    ];
    let seed = 0x2545f491;
    const next = () => {
      seed ^= seed << 13;
      seed >>>= 0;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      seed >>>= 0;
      return seed;
    };
    const failures: string[] = [];
    for (let n = 0; n < 3_000; n += 1) {
      let text = "";
      const length = 1 + (next() % 14);
      for (let i = 0; i < length; i += 1) text += alphabet[next() % alphabet.length];
      if (text.trim() === "") continue;
      const escaped = escapeMdxText(text);
      if (unescapeMdxText(escaped) !== text) failures.push(`round trip: ${JSON.stringify(text)}`);
      const lines = escaped.split(/\r\n|\r|\n/).map((line) => line.trim());
      const contexts: Array<[string, string, readonly string[]]> = [
        ["prose", `Lead text. ${escaped}`, ["root", "paragraph", "text", "break"]],
        // The compiler's quoteBlock trims every line and prefixes "> ".
        ["quote", lines.map((line) => (line === "" ? ">" : `> ${line}`)).join("\n"), ["root", "blockquote", "paragraph", "text", "break"]],
        ["label", `- **${lines.join(" ")}** — row`, ["root", "list", "listItem", "paragraph", "strong", "text", "break"]],
      ];
      for (const [context, doc, allowed] of contexts) {
        const tree = parseMdx(doc);
        const extra = [...nodeTypes(tree)].filter((t) => !allowed.includes(t));
        if (extra.length > 0) failures.push(`${context}: ${extra.join(",")} from ${JSON.stringify(text)}`);
        if (links(tree).length > 0) failures.push(`${context}: link from ${JSON.stringify(text)}`);
      }
      if (collapse(visibleText(parseMdx(escaped))) !== collapse(text.replace(/&#x2060;/g, "\u2060"))) {
        // A literal "&#x2060;" in the input is escaped ("\&…"), so it shows as written.
        if (collapse(visibleText(parseMdx(escaped))) !== collapse(text)) failures.push(`visible text: ${JSON.stringify(text)}`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    // Parses the whole corpus with the real MDX parser: ~1.5 s alone, more
    // under a full parallel suite, so the default 5 s timeout is too tight.
  }, 30_000);

  it("escapes block markers only at the start of a line", () => {
    expect(escapeMdxText("- a-b\n1. step 1.5")).toBe("\\- a-b\n1\\. step 1.5");
    expect(escapeMdxText("export data\nwe export data")).toBe("&#101;xport data\nwe export data");
    expect(escapeMdxText(":- a:b")).toBe("\\:- a:b");
  });

  it("writes an invisible word joiner reference into URL schemes, www hosts and before @", () => {
    expect(escapeMdxText("https://a.example www.b.example me@c.example")).toBe(
      "https&#x2060;://a.example www&#x2060;.b.example me&#x2060;\\@c.example",
    );
    expect(unescapeMdxText("https&#x2060;://a.example www&#x2060;.b.example me&#x2060;\\@c.example")).toBe(
      "https://a.example www.b.example me@c.example",
    );
    // A literal reference in the source text is escaped, so it survives as written.
    expect(unescapeMdxText(escapeMdxText("a &#x2060; b"))).toBe("a &#x2060; b");
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
