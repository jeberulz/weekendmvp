import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { renderMarkdown, safeHref } from "@/lib/editorial/markdown/render";

function html(markdown: string, options: Parameters<typeof renderMarkdown>[1] = {}) {
  const result = renderMarkdown(markdown, options);
  return { markup: renderToStaticMarkup(<>{result.node}</>), notices: result.notices, claimsShown: result.claimsShown };
}

describe("safe preview: nothing executes", () => {
  const hostile = [
    "<script>window.__pwned = 1</script>",
    '<img src=x onerror="window.__pwned=1">',
    '<svg onload="alert(1)"></svg>',
    '<iframe src="https://evil.example/"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    '<div style="position:fixed;inset:0">overlay</div>',
    "<!-- hidden comment -->",
  ];

  test.each(hostile)("raw HTML is shown as text: %s", (payload) => {
    const { markup, notices } = html(`## The Problem\n\n${payload}\n`);
    expect(markup).not.toMatch(/<(script|img|svg|iframe|div style)/i);
    // Event-handler attributes on a real tag (escaped text like &lt;img onerror is fine).
    expect(markup).not.toMatch(/<[a-z][^<>]*\son[a-z]+=/i);
    expect(markup).toContain("&lt;");
    expect(markup).not.toContain('href="javascript:');
    expect(notices.some((notice) => notice.kind === "raw_markup")).toBe(true);
  });

  test("MDX expressions, components and ESM stay literal text", () => {
    const { markup } = html(
      "The core loop is {post, claim, confirm} and {12345 + 67890}.\n\n<Callout type=\"tip\">Hi</Callout>\n\nimport Evil from './evil'\n\nexport const x = 1",
    );
    expect(markup).toContain("{12345 + 67890}");
    expect(markup).not.toContain("80235");
    expect(markup).toContain("{post, claim, confirm}");
    expect(markup).toContain("&lt;Callout");
    expect(markup).toContain("import Evil from");
    expect(markup).not.toMatch(/<callout/i);
  });

  test("links keep an href only for public http(s) and mailto", () => {
    expect(safeHref("https://paynudge.example/pricing")).toBe("https://paynudge.example/pricing");
    expect(safeHref("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    for (const url of ["javascript:alert(1)", "data:text/html,hi", "vbscript:x", "https://u:p@host.example/", "http://localhost:3000/admin", "http://169.254.169.254/latest"]) {
      expect(safeHref(url), url).toBeNull();
    }
    const { markup, notices } = html(
      "[ok](https://site.example/a) [bad](javascript:alert(1)) [creds](https://u:p@site.example) [ref][r]\n\n[r]: data:text/html,boom",
    );
    expect(markup).toContain('href="https://site.example/a"');
    expect(markup).toContain('rel="noopener noreferrer nofollow"');
    expect(markup).toContain("(opens in new tab)");
    expect(markup).not.toMatch(/href="(javascript|data):/);
    expect(markup).not.toContain("u:p@");
    expect(notices.filter((notice) => notice.kind === "unsafe_link")).toHaveLength(3);
  });

  test("images are never fetched", () => {
    const { markup, notices } = html("![tracking pixel](https://tracker.example/p.gif)\n\n![ref image][img]\n\n[img]: https://tracker.example/q.gif");
    expect(markup).not.toMatch(/<img/i);
    expect(markup).not.toContain("tracker.example");
    expect(markup).toContain("Image not loaded in preview: tracking pixel");
    expect(notices.filter((notice) => notice.kind === "image_not_loaded")).toHaveLength(2);
  });

  test("code fences are preserved literally, including markup inside them", () => {
    const { markup } = html("```html\n<script>alert(1)</script>\n{x}\n```");
    expect(markup).toContain("<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;\n{x}</code></pre>");
    expect(markup).toContain(">html</figcaption>");
  });

  test("hostile nesting is depth-limited instead of exhausting the stack", () => {
    const deep = `${"> ".repeat(400)}deep`;
    const { markup, notices } = html(deep);
    expect(markup).toContain("deep");
    expect(notices.some((notice) => notice.kind === "depth_limited")).toBe(true);
  });

  test("bidirectional controls stay inert text", () => {
    const rlo = String.fromCodePoint(0x202e);
    const { markup } = html(`Invoice ${rlo}gnp.exe`);
    expect(markup).toContain(`Invoice ${rlo}gnp.exe`);
  });
});

describe("preview structure", () => {
  test("article headings never produce a second h1; tables keep header semantics", () => {
    const { markup } = html("# Top\n\n## The Problem\n\n| A | B |\n|---|--:|\n| 1 | 2 |");
    expect(markup).not.toContain("<h1");
    expect(markup).toContain('<h2 id="preview-top">');
    expect(markup).toContain('<h2 id="preview-the-problem">');
    expect(markup).toContain('<th scope="col">A</th>');
    expect(markup).toContain('<td class="text-right">2</td>');
  });

  test("claim anchors become labelled buttons next to highlighted text", () => {
    const { markup, claimsShown } = html("Freelancers spend about 6 hours a week chasing late payments, the survey says.", {
      claims: [{ id: "clm-1", anchorText: "spend about 6 hours a week chasing late payments", label: "6 hours a week" }],
    });
    expect(markup).toContain('<mark data-claim-id="clm-1">spend about 6 hours a week chasing late payments</mark>');
    expect(markup).toContain("Show evidence for claim: 6 hours a week");
    expect(claimsShown).toEqual(["clm-1"]);
  });

  test("task lists and footnotes are readable without colour or images", () => {
    const { markup } = html("- [x] done\n- [ ] todo\n\nA claim.[^1]\n\n[^1]: The source.");
    expect(markup).toContain("Done: ");
    expect(markup).toContain("Not done: ");
    expect(markup).toContain('aria-label="Footnotes"');
    expect(markup).toContain("The source.");
  });

  test("a large article renders in reasonable time", () => {
    const section = "## The Problem\n\n" + "A sentence about the problem that repeats. ".repeat(40) + "\n\n";
    const big = section.repeat(120);
    const started = Date.now();
    const { markup } = html(big);
    expect(markup.length).toBeGreaterThan(100_000);
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});
