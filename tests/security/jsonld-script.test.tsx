import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { howItWorksSteps } from "../../app/ideas/[slug]/schema-text";
import { JsonLd } from "../../components/primitives/JsonLd";
import { buildGraph, howToSchema } from "../../lib/seo";

/**
 * JSON-LD is written into an inline <script> (components/primitives/JsonLd).
 * JSON.stringify leaves "<", ">", "&" and the line separators U+2028/U+2029
 * raw, so page text that reaches a schema (an idea's How-it-works steps, its
 * Solution summary, its title) could close the script element: a step
 * holding "</script><script>…" was stored script injection on a public page
 * (security re-review of 7a16647, P1). The sink now writes those characters
 * as \u escapes; the parsed JSON is unchanged.
 */

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const UNSAFE_IN_SCRIPT = ["<", ">", "&", LINE_SEPARATOR, PARAGRAPH_SEPARATOR];

const HOSTILE = [
  "</script><script>alert(1)</script>",
  "</SCRIPT ><img src=x onerror=alert(1)>",
  "<!-- an open HTML comment",
  "<script>",
  "a & b &amp; c &lt;",
  `line${LINE_SEPARATOR}separator`,
  `paragraph${PARAGRAPH_SEPARATOR}separator`,
  "]]> --> <files>",
];

const OPEN = '<script type="application/ld+json">';
const CLOSE = "</script>";

/** The text of the one JSON-LD script element JsonLd renders. */
function scriptText(schema: Record<string, unknown>): string {
  const markup = renderToStaticMarkup(<JsonLd schema={schema} />);
  expect(markup.startsWith(OPEN)).toBe(true);
  expect(markup.endsWith(CLOSE)).toBe(true);
  return markup.slice(OPEN.length, markup.length - CLOSE.length);
}

function expectScriptSafe(schema: Record<string, unknown>): void {
  const text = scriptText(schema);
  for (const ch of UNSAFE_IN_SCRIPT) {
    expect(text.includes(ch), `raw ${JSON.stringify(ch)} in the script text`).toBe(false);
  }
  const parsed: unknown = JSON.parse(text);
  expect(parsed).toEqual(schema);
}

describe("JsonLd writes script-safe JSON (security re-review P1)", () => {
  test("hostile strings in nested objects and arrays stay inside the script and parse back unchanged", () => {
    expectScriptSafe({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "HowTo",
          name: HOSTILE[0],
          step: HOSTILE.map((text, i) => ({ "@type": "HowToStep", position: i + 1, name: text, text })),
        },
        { "@type": "Thing", description: HOSTILE.join(" | "), nested: { deeper: { list: [...HOSTILE, { inner: HOSTILE }] } } },
      ],
    });
  });

  test("a How-it-works step with </script> in an idea's MDX ends up inert in the page's HowTo JSON-LD", () => {
    const mdx = [
      "## The Solution",
      "",
      "A quiet reviewer for small teams.",
      "",
      "**How it works:**",
      "",
      "1. **Connect** — link the repository </script><script>alert(1)</script>",
      "2. **Review** — reads \\<files\\> & diffs",
      `3. **Ship** — merges${LINE_SEPARATOR}the fix`,
      "",
      "## Market Research",
    ].join("\n");
    const steps = howItWorksSteps(mdx);
    // The extraction keeps "<" and "/" (stripMd only drops * _ ` and link syntax).
    expect(steps[0]).toContain("</script><script>alert(1)</script>");
    expectScriptSafe(
      buildGraph(
        howToSchema({
          name: "Build AI Code Reviewer MVP",
          description: "Step-by-step guide to building AI Code Reviewer in a weekend.",
          steps: steps.map((text, i) => ({ name: `Step ${i + 1}`, text })),
        }),
      ),
    );
  });
});
