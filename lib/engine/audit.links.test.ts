/**
 * Links, attribution titles, ## Sources and quoted text in the final artifact
 * (WP46 ruling R10; final review P2-2, security review S-P2b).
 *
 * An engine page links only to the evidence sources its record uses, and a
 * link's text is that source's title or the canonical rendering of one of
 * its evidence items (renderEvidenceInline). ## Sources lists exactly the
 * used sources. Outside the verified quote blocks, a double-quoted span of
 * three or more words must be an accepted quote the record uses. Every
 * expectation is computed through the evidence module (renderEvidenceInline,
 * escapeMdxText), never typed as a rendering string.
 */

import { afterEach, describe, expect, it } from "vitest";

import { auditPage, cleanupTempDirs, compiledPage, pageBody, replaceOnce } from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord, EV, FIXTURE_PAGES, FIXTURE_PAGE_SLUG, tok } from "./__fixtures__/recordV2.ts";
import { parseMdxBody, type MdNode } from "./artifact-audit.ts";
import { compileResearchRecord } from "./compile.ts";
import type { ResearchRecordV2 } from "./evidence/contract.ts";
import { escapeMdxText } from "./evidence/quote.ts";
import { renderEvidenceInline } from "./evidence/tokens.ts";
import { mdLink, usedEvidenceIds } from "./page-format.ts";

afterEach(cleanupTempDirs);

function errorsOf(result: { errors: string[] }): string {
  return result.errors.join("\n");
}

const FIRST_PROBLEM_END = "the onboarding of new contributors.";
const HN_URL = FIXTURE_PAGES.hn.url;
const HN_ATTRIBUTION = `> — ${mdLink(FIXTURE_PAGES.hn.title, HN_URL)}`;

/** Every link URL on a page, as the site's parser reads it (autolinks included). */
function pageLinkUrls(mdx: string): string[] {
  const parsed = parseMdxBody(pageBody(mdx));
  if (!parsed.ok) throw new Error(`page does not parse: ${parsed.error}`);
  const urls: string[] = [];
  const walk = (node: MdNode) => {
    if (node.type === "link" && node.url) urls.push(node.url);
    for (const child of node.children) walk(child);
  };
  walk(parsed.root);
  return urls;
}

function compile(record: ResearchRecordV2): string {
  return compileResearchRecord({ record, slug: FIXTURE_PAGE_SLUG, publishedAt: "2026-10-01" }).mdx;
}

/** The fixture plus a token for the figure-free accepted quote (so the page carries its inline link). */
function recordCitingUnselectedQuote(): ResearchRecordV2 {
  return buildFixtureRecord((r, ev) => {
    r.community.summary = `${r.community.summary} Another maintainer described the end state: ${tok(ev.quoteUnselected)}`;
  });
}

describe("every link targets an evidence source the record uses (R10)", () => {
  it("passes the compiled page, whose links all point at the record's evidence sources", async () => {
    const record = buildFixtureRecord();
    const used = usedEvidenceIds(record);
    const usedUrls = new Set(record.evidence.accepted.filter((e) => used.has(e.id)).map((e) => e.sourceUrl));
    const page = compiledPage(record);
    expect(pageLinkUrls(page).length).toBeGreaterThan(0);
    expect(pageLinkUrls(page).filter((url) => !usedUrls.has(url))).toEqual([]);
    expect((await auditPage(page, record)).errors).toEqual([]);
  });

  it("fails a bare URL typed into prose, which GFM turns into a live link", async () => {
    const page = replaceOnce(
      compiledPage(),
      FIRST_PROBLEM_END,
      `${FIRST_PROBLEM_END} Read the full playbook at https://example.invalid/offer before you buy anything.`,
    );
    expect(pageLinkUrls(page)).toContain("https://example.invalid/offer");
    expect(errorsOf(await auditPage(page))).toMatch(
      /link at line [1-9]\d* to https:\/\/example\.invalid\/offer is not an evidence source this record uses/,
    );
  });

  it("fails a markdown link to a page the record does not use, however harmless its title", async () => {
    const page = replaceOnce(compiledPage(), FIRST_PROBLEM_END, `${FIRST_PROBLEM_END} See [a helpful guide](https://example.org/guide).`);
    expect(errorsOf(await auditPage(page))).toMatch(/link at line \d+ to https:\/\/example\.org\/guide is not an evidence source this record uses/);
  });

  it("never lets a bare URL in writer text reach the page as a live link: the compiler escapes it or the audit refuses the page", async () => {
    const record = buildFixtureRecord((r) => {
      if (r.editorial) r.editorial.problemNarrative += " Read the full playbook at https://example.invalid/offer before you buy anything.";
    });
    const page = compile(record);
    const live = pageLinkUrls(page).some((url) => url.includes("example.invalid"));
    const errors = errorsOf(await auditPage(page, record));
    if (live) expect(errors).toMatch(/link at line \d+ to https:\/\/example\.invalid\/offer is not an evidence source/);
    else expect(errors).not.toMatch(/example\.invalid/);
  });

  it("never lets an accepted quote that carries a URL publish a live link (hostile cited page)", async () => {
    const hostile = "Honestly the only fix that worked for us is at https://example.invalid/tool and it saved our quarter.";
    const record = buildFixtureRecord(
      (r) => {
        const quote = r.evidence.accepted.find((e) => e.kind === "community_quote" && e.excerpt.includes("example.invalid"));
        if (!quote) throw new Error("fixture: the hostile quote was not accepted");
        r.community.quoteIds = [quote.id, ...r.community.quoteIds.slice(1)];
      },
      {
        pages: { hn: { text: `${FIXTURE_PAGES.hn.text}\n${hostile}` } },
        extraCandidates: { quotes: [{ sourceUrl: HN_URL, text: hostile }] },
      },
    );
    const page = compile(record);
    const live = pageLinkUrls(page).some((url) => url.includes("example.invalid"));
    const errors = errorsOf(await auditPage(page, record));
    if (live) expect(errors).toMatch(/link at line \d+ to https:\/\/example\.invalid\/tool is not an evidence source/);
    else expect(errors).not.toMatch(/example\.invalid/);
  });
});

describe("a link's text is its source's title or an evidence rendering (R10, P2-2)", () => {
  it("fails figure-free edits of an inline quote link: a negation, an appended sentence, a replacement", async () => {
    const record = recordCitingUnselectedQuote();
    const rendering = renderEvidenceInline(EV.quoteUnselected);
    const link = mdLink(rendering, EV.quoteUnselected.sourceUrl);
    const page = compile(record);
    expect(page).toContain(link);
    expect((await auditPage(page, record)).errors).toEqual([]);
    for (const edited of [
      rendering.replace("We switched", "We never switched"),
      rendering.replace('difference."', 'difference, and we would pay anything for a tool that fixes it."'),
      '"Legal rejects every single draft that the chat tool writes for us."',
    ]) {
      const mutated = replaceOnce(page, link, mdLink(edited, EV.quoteUnselected.sourceUrl));
      const errors = errorsOf(await auditPage(mutated, record));
      expect(errors, edited).toMatch(/: the text must be that source's title or the rendering of one of its evidence items/);
      expect(errors, edited).toMatch(/is not an accepted community quote this record uses/);
    }
  });

  it("fails an attribution title that is not the evidence source title, with or without figures (P2-2, Q5)", async () => {
    for (const title of ["Ask HN: is AI review worth it", "Survey: 92% of maintainers lose 12 hours a week"]) {
      const page = replaceOnce(compiledPage(), HN_ATTRIBUTION, `> — ${mdLink(title, HN_URL)}`);
      expect(errorsOf(await auditPage(page)), title).toContain(
        `attribution title "${title}" is not the evidence source title "${FIXTURE_PAGES.hn.title}"`,
      );
    }
  });

  it("fails a market signal row or a competitor price whose source title was edited", async () => {
    const statRow = `${escapeMdxText(renderEvidenceInline(EV.statAdoption))} (${mdLink(FIXTURE_PAGES.survey.title, FIXTURE_PAGES.survey.url)})`;
    const statEdited = replaceOnce(compiledPage(), statRow, statRow.replace(FIXTURE_PAGES.survey.title, "Survey of every developer"));
    expect(errorsOf(await auditPage(statEdited))).toMatch(
      /market signal row at line \d+: source title "Survey of every developer" is not the evidence source title "Developer tools survey 2025"/,
    );
    const priceLink = mdLink(FIXTURE_PAGES.graphite.title, FIXTURE_PAGES.graphite.url);
    const priceEdited = replaceOnce(compiledPage(), `${priceLink}.`, `${mdLink("Graphite plans", FIXTURE_PAGES.graphite.url)}.`);
    expect(errorsOf(await auditPage(priceEdited))).toMatch(
      /competitor row "Graphite" \(line \d+\): price ".*" links with title "Graphite plans"; its evidence source title is "Graphite pricing"/,
    );
  });

  it("fails competitor notes that link another competitor's accepted price (R7: notes cite only their own prices)", async () => {
    const theirs = mdLink(renderEvidenceInline(EV.pricePro), EV.pricePro.sourceUrl);
    const page = replaceOnce(
      compiledPage(),
      "which suits teams already living in its workflow.",
      `which suits teams already living in its workflow, and it undercuts ${theirs}.`,
    );
    expect(errorsOf(await auditPage(page))).toMatch(
      /competitor row "Graphite" \(line \d+\): its notes cite CodeRabbit's price ".*"; a competitor's notes may cite only its own prices/,
    );
  });
});

describe("## Sources lists exactly the evidence sources the record uses (R10)", () => {
  const hnSource = `\n- ${mdLink(FIXTURE_PAGES.hn.title, HN_URL)}`;

  it("fails prose added under ## Sources", async () => {
    const page = `${compiledPage()}\nTeams of eight lose a week to reviews, per our survey.\n`;
    expect(errorsOf(await auditPage(page))).toMatch(/## Sources may hold only the list of evidence sources .*found paragraph at line \d+/);
  });

  it("fails a Sources entry for a page the record does not use", async () => {
    const page = `${compiledPage().trimEnd()}\n- [Industry blog](https://example.org/blog)\n`;
    expect(errorsOf(await auditPage(page))).toMatch(/link at line \d+ to https:\/\/example\.org\/blog is not an evidence source this record uses/);
  });

  it("fails a missing Sources entry, an edited Sources title and a repeated entry", async () => {
    const missing = replaceOnce(compiledPage(), hnSource, "");
    expect(errorsOf(await auditPage(missing))).toContain(`## Sources is missing ${HN_URL}, an evidence source the page's record uses`);

    const retitled = replaceOnce(compiledPage(), hnSource, `\n- ${mdLink("Hacker News thread", HN_URL)}`);
    expect(errorsOf(await auditPage(retitled))).toMatch(new RegExp(`## Sources entry at line \\d+: "Hacker News thread" is not the title of ${HN_URL.replace(/[.?]/g, "\\$&")}`));

    const repeated = replaceOnce(compiledPage(), hnSource, `${hnSource}${hnSource}`);
    expect(errorsOf(await auditPage(repeated))).toContain(`## Sources lists ${HN_URL} 2 times`);
  });
});

describe("double-quoted text outside quote blocks must be accepted quote evidence (R10, P2-2)", () => {
  const fabricated = "Legal rejects every single draft that the chat tool writes for us.";

  it("fails a fabricated quote as a paragraph, a list item and a table cell (Q2, Q3, Q4)", async () => {
    const hn = mdLink(FIXTURE_PAGES.hn.title, HN_URL);
    for (const block of [
      `“${fabricated}” — ${hn}`,
      `- “${fabricated}” — ${hn}`,
      `| What maintainers say | Source |\n| --- | --- |\n| “${fabricated}” | ${hn} |`,
    ]) {
      const page = replaceOnce(compiledPage(), FIRST_PROBLEM_END, `${FIRST_PROBLEM_END}\n\n${block}\n`);
      expect(errorsOf(await auditPage(page)), block).toMatch(
        /The Problem: quoted text "Legal rejects every single draft .*" near line \d+ is not an accepted community quote this record uses/,
      );
    }
  });

  it("fails straight, typographic and guillemet quotes in any section, prompt fences included", async () => {
    const cases: Array<[string, string, RegExp]> = [
      ["Everything else stays out of the thread.", `Everything else stays out of the thread. One beta user called it "the reviewer we always wanted".`, /The Solution: quoted text "the reviewer we always wanted"/],
      ["which suits teams already living in its workflow.", "which suits teams already living in its workflow, or «the only bot we kept» as one buyer said.", /Competitive Landscape: quoted text "the only bot we kept"/],
      ["Deliverables: wordmark and a small mark", 'Tagline: "The quiet reviewer every small team trusts." Deliverables: wordmark and a small mark', /AI Prompts to Build This: quoted text "The quiet reviewer every small team trusts\."/],
    ];
    for (const [from, to, expected] of cases) {
      const page = replaceOnce(compiledPage(), from, to);
      expect(errorsOf(await auditPage(page)), to).toMatch(expected);
    }
  });

  it("passes a used quote's linked rendering, the same quote in plain text, and short quoted words", async () => {
    const record = recordCitingUnselectedQuote();
    const page = replaceOnce(
      compile(record),
      "Everything else stays out of the thread.",
      `Everything else stays out of the thread. One maintainer said it plainly: ${escapeMdxText(renderEvidenceInline(EV.quoteUnselected))} Teams call the bot "noise" or a “helper”.`,
    );
    expect((await auditPage(page, record)).errors).toEqual([]);
  });
});
