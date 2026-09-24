import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildShingleIndex, checkDuplication } from "../../scripts/lib/quality/dupes.mjs";
import { checkIntegrity } from "../../scripts/lib/quality/integrity.mjs";
import { checkSlop, countPhrases } from "../../scripts/lib/quality/lexicon.mjs";
import { checkNumbers, splitUnits } from "../../scripts/lib/quality/numbers.mjs";
import { parseIdea, toProse } from "../../scripts/lib/quality/parse.mjs";
import { renderReport } from "../../scripts/lib/quality/report.mjs";
import { checkSources } from "../../scripts/lib/quality/sources.mjs";
import { evaluateIdea } from "../../scripts/lib/quality/verdict.mjs";
import { checkVerbosity, splitSentences } from "../../scripts/lib/quality/verbosity.mjs";
import { slugsFromPaths } from "../../scripts/evals-run.mjs";

const config = JSON.parse(fs.readFileSync(new URL("../../evals/config.json", import.meta.url), "utf8"));
const lexicon = JSON.parse(fs.readFileSync(new URL("../../evals/slop-lexicon.json", import.meta.url), "utf8"));

const FACTUAL = { factualSections: config.factualSections, sourcesTitle: "Sources" };

// A page that passes the structural contract, written in plain short
// sentences, with every number linked or attributed.
function words(n, seed = "builders ship small tools") {
  const out = [];
  for (let i = 0; i < n; i++) out.push(`${seed} ${i}.`);
  return out.join(" ");
}

function page({
  problem = `Freelancers lose track of invoices every month. ${words(40, "They chase late payers by hand")}`,
  market = `Grand View puts the market at **$4.2 billion** in 2025. ${words(40, "Demand keeps rising each quarter")}`,
  competitive = "- **Acme Invoices** — Pricing: $12/month.\n- **Beta Bills** — Pricing: $20/month.\n- **Gamma Pay** — Pricing: free.",
  sources = "- [Grand View — invoicing market](https://www.grandviewresearch.com/industry-analysis/invoicing)\n- [Acme Invoices pricing](https://acme.example-invoices.io/pricing)\n- [Beta Bills pricing](https://betabills.co/pricing)",
  extra = "",
} = {}) {
  return `---
slug: "test-idea"
title: "Test idea"
---

## The Problem

${problem}

## The Solution

${words(60, "The tool reads a bank feed and flags")}

**How it works:**

1. **Connect** — Link a bank account.
2. **Match** — Pair payments to invoices.
3. **Nudge** — Send a polite reminder.

## Market Research

${market}

## Competitive Landscape

${competitive}

## Business Model

${words(40, "Charge a flat monthly fee per seat")}

## Recommended Tech Stack

${words(20, "Use Next.js and Postgres for the core")}

## AI Prompts to Build This

\`\`\`text
TODO: describe [your product] here. Delve into the details.
\`\`\`

## Sources

${sources}
${extra}`;
}

function evaluate(raw, slug = "test-idea", dupIndex) {
  return evaluateIdea({ slug, raw, config, lexicon, dupIndex });
}

test("toProse drops code, headings, link URLs and bold markers", () => {
  const prose = toProse("## Head\nSee [Grand View](https://x.com) **now** `code` it’s\n```\nhidden\n```");
  assert.ok(!prose.includes("Head"));
  assert.ok(!prose.includes("https://"));
  assert.ok(!prose.includes("hidden"));
  assert.ok(!prose.includes("**"));
  assert.ok(prose.includes("Grand View"));
  assert.ok(prose.includes("it's"), "curly apostrophe is normalised");
});

test("parseIdea excludes prompt and source sections from prose", () => {
  const parsed = parseIdea(page(), "test-idea", { excludeSections: config.excludeFromProseSections });
  assert.ok(!parsed.prose.includes("Delve"));
  assert.ok(!parsed.prose.includes("grandviewresearch"));
  assert.ok(parsed.wordCount > 0);
});

test("countPhrases matches whole words only, hyphens included", () => {
  const hits = countPhrases("We leverage data. It was leveraged. A non-robust robust plan.", ["leverage", "robust"]);
  const byPhrase = Object.fromEntries(hits.map((h) => [h.phrase, h.count]));
  assert.equal(byPhrase.leverage, 1);
  assert.equal(byPhrase.robust, 1);
});

test("checkSlop reports banned phrases and watch density", () => {
  const prose = "Let us delve into this. It is a game-changer. A robust, seamless, innovative plan.";
  const slop = checkSlop(prose, 100, lexicon);
  assert.deepEqual(slop.banned.map((h) => h.phrase).sort(), ["delve", "game-changer"]);
  assert.equal(slop.watchCount, 3);
  assert.equal(slop.watchPer1k, 30);
});

test("splitSentences splits list items and sentences, drops fragments", () => {
  const s = splitSentences("First sentence has five words. Second one also has five.\n- A list item with no period\n- $12/month");
  assert.equal(s.length, 3);
});

test("checkVerbosity measures length, long share and repeats", () => {
  const long = `${"word ".repeat(40).trim()}.`;
  const repeat = "This exact sentence appears twice in the page body.";
  const prose = `${long} Short sentence here now. ${repeat} ${repeat}`;
  const v = checkVerbosity(prose, 100, 5, { longSentenceWords: 35 });
  assert.equal(v.sentenceCount, 4);
  assert.equal(v.longest.words, 40);
  assert.equal(v.longSentenceShare, 0.25);
  assert.equal(v.fillerPer1k, 50);
  assert.equal(v.repeated.length, 1);
});

test("splitUnits treats each list item as its own unit", () => {
  const units = splitUnits("Intro paragraph.\n\n- **A** — $5\n- **B** — $6\n\nOutro.");
  assert.deepEqual(units, ["Intro paragraph.", "- **A** — $5", "- **B** — $6", "Outro."]);
});

test("checkNumbers classes evidence and ignores years and small integers", () => {
  const sections = [
    {
      title: "The Problem",
      content:
        "Teams spend 12 hours on this in 2025.\n\n" +
        "About 456,000 members discuss it on r/Posture.\n\n" +
        "Spend topped $240 billion and grew 8.2% last year.\n\n" +
        "A [Pew survey](https://pewresearch.org/x) found 61% agree.",
    },
    {
      title: "Competitive Landscape",
      content: "- **Acme Invoices** — Pricing: $12/month.\n- **Nobody Co** — Pricing: about $9 inferred.",
    },
    { title: "Business Model", content: "Charge $99/month for 1,000 seats." },
    { title: "Sources", content: "- [Acme Invoices pricing](https://acme.io/pricing)" },
  ];
  const n = checkNumbers(sections, FACTUAL);
  assert.equal(n.claims, 6, "12 hours and 2025 are not claims; Business Model is skipped");
  assert.equal(n.linked, 1);
  assert.equal(n.named, 1);
  assert.equal(n.listed, 1);
  assert.equal(n.unsourced, 3);
  assert.equal(n.hedged.length, 1);
  assert.equal(n.hedged[0].marker, "inferred");
});

test("checkSources flags placeholders, homepages, duplicates, invalid links", () => {
  const s = checkSources(
    [
      "- [A](https://www.example.com/report)",
      "- [B](https://grandviewresearch.com/)",
      "- [C](https://pew.org/study#top)",
      "- [C again](https://pew.org/study)",
      "- [D](ftp://files.org/x)",
      "- [Related idea](/ideas/other-idea)",
      "- [E](https://ideabrowser.com/idea/1)",
    ].join("\n"),
    config.sources,
  );
  assert.equal(s.linkCount, 6, "site-relative cross-link is ignored");
  assert.deepEqual(s.placeholder, ["https://www.example.com/report"]);
  assert.deepEqual(s.homepageOnly, ["https://grandviewresearch.com/"]);
  assert.deepEqual(s.duplicates, ["https://pew.org/study"]);
  assert.deepEqual(s.invalid, ["ftp://files.org/x"]);
  assert.equal(s.distinctDomains, 4);
  assert.equal(s.ideabrowserShare, 0.2);
});

test("checkIntegrity catches placeholders and model chatter, not app names", () => {
  const bad = checkIntegrity("Pricing is TBD. As an AI language model I think this is lorem ipsum. Saves XX% time.");
  assert.deepEqual(bad.placeholders.map((h) => h.match).sort(), ["TBD", "XX%", "lorem ipsum"]);
  assert.equal(bad.leaks.length, 1);
  const ok = checkIntegrity("Another todo app. The AI cannot clear every wall. You would have saved $X last week.");
  assert.equal(ok.placeholders.length, 0);
  assert.equal(ok.leaks.length, 0);
});

test("checkDuplication finds the most similar other page", () => {
  const shared = "the quick brown fox jumps over the lazy dog again and again";
  const pages = [
    { slug: "a", prose: `${shared} alpha one two three` },
    { slug: "b", prose: `${shared} beta four five six` },
    { slug: "c", prose: "completely different words that share nothing with the others at all" },
  ];
  const idx = buildShingleIndex(pages, 8);
  const a = checkDuplication("a", idx);
  assert.equal(a.maxPairSlug, "b");
  assert.ok(a.maxPairShare > 0.4);
  assert.equal(checkDuplication("c", idx).maxPairShare, 0);
});

test("a clean page passes", () => {
  const r = evaluate(page());
  assert.equal(r.status, "pass", JSON.stringify([...r.fails, ...r.warns], null, 2));
  assert.equal(r.metrics.numbers.named, 1);
  assert.equal(r.metrics.numbers.listed, 2, "Acme and Beta prices; Gamma has no number");
});

test("a seeded bad page fails with every expected check", () => {
  const r = evaluate(
    page({
      problem: `In today's fast-paced world, it's important to note that TODO numbers go here. ${words(40, "They chase late payers by hand")}`,
      market: `The market is worth $9 billion and grows 40% a year and 3,000,000 teams want it. ${words(40, "Demand keeps rising each quarter")}`,
      sources: "- [Report](https://example.com/report)\n- [Report two](https://example.com/other)",
    }),
  );
  assert.equal(r.status, "fail");
  const checks = new Set(r.fails.map((f) => f.check));
  for (const c of ["slop.banned", "integrity.placeholder", "sources.placeholder", "sources.domains"]) {
    assert.ok(checks.has(c), `expected ${c} in ${[...checks].join(", ")}`);
  }
  // 3 market figures + 2 competitor prices whose sources were removed.
  assert.equal(r.metrics.numbers.unsourced, 5);
});

test("structural failures fail the page", () => {
  const r = evaluate(page().replace("## Market Research", "## Market"));
  assert.equal(r.status, "fail");
  assert.ok(r.fails.some((f) => f.check === "structure"));
});

test("placeholders inside prompt code blocks are allowed", () => {
  const r = evaluate(page());
  assert.ok(!r.fails.some((f) => f.check === "integrity.placeholder"));
  assert.ok(!r.fails.some((f) => f.check === "slop.banned"));
});

test("a copied page fails duplication", () => {
  const raw = page();
  const parse = (slug) => parseIdea(raw, slug, { excludeSections: config.excludeFromProseSections });
  const idx = buildShingleIndex([parse("test-idea"), parse("copy-idea")], config.duplication.shingleWords);
  const r = evaluate(raw, "test-idea", idx);
  assert.ok(r.fails.some((f) => f.check === "duplication" && f.message.includes("copy-idea")));
});

test("slugsFromPaths keeps top-level idea MDX only", () => {
  assert.deepEqual(
    slugsFromPaths([
      "content/ideas/new-idea.mdx",
      "content/ideas/_quarantine/old.md",
      "content/ideas/_extraction-report.json",
      "content/articles/some-article.mdx",
      "content/ideas/another.mdx",
      "",
    ]),
    ["another", "new-idea"],
  );
});

test("renderReport ranks failing pages first", () => {
  const md = renderReport(
    [
      { slug: "ok", status: "pass", fails: [], warns: [] },
      { slug: "meh", status: "warn", fails: [], warns: [{ check: "numbers.unsourced", message: "m" }] },
      {
        slug: "bad",
        status: "fail",
        fails: [
          { check: "structure", message: "missing | Sources" },
          { check: "slop.banned", message: "delve" },
        ],
        warns: [],
      },
    ],
    { generatedOn: "2026-09-24" },
  );
  assert.ok(md.includes("| fail | 1 |"));
  assert.ok(md.indexOf("`bad`") < md.indexOf("`meh`"));
  assert.ok(md.includes("missing \\| Sources"), "pipes are escaped in table cells");
});
