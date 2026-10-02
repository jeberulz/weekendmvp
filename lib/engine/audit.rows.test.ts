/**
 * Final-artifact evidence rows and the unbound-figure guard (WP46-S4; plan
 * §7.5–6 F1 defense, contract §9, ruling R10).
 *
 * Market signal and competitor rows must show their evidence's canonical
 * rendering with that evidence's own source. A figure in prose that is not
 * a LINKED rendering of evidence the record uses is an "unbound figure" — a
 * guard against figures typed into the page, not proof that the prose is
 * true. (audit.page.test.ts covers the other sections; this file keeps the
 * three factual ones.) Renderings are computed with renderEvidenceInline,
 * never typed, so the tests follow the evidence module's wording.
 */

import { afterEach, describe, expect, it } from "vitest";

import { auditPage, cleanupTempDirs, compiledPage, pageBody, replaceOnce } from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord, EV, FIXTURE_PAGES, FIXTURE_RETRIEVED_AT } from "./__fixtures__/recordV2.ts";
import { auditEngineArtifact } from "./artifact-audit.ts";
import { acceptEvidence, sha256Hex } from "./evidence/accept.ts";
import type { AcceptedEvidence, ResearchRecordV2 } from "./evidence/contract.ts";
import { escapeMdxText } from "./evidence/quote.ts";
import { renderEvidenceInline } from "./evidence/tokens.ts";
import { marketSignalLabel, mdLink } from "./page-format.ts";

afterEach(cleanupTempDirs);

function errorsOf(result: { errors: string[] }): string {
  return result.errors.join("\n");
}

const FIRST_PROBLEM_END = "the onboarding of new contributors.";

/** An evidence rendering as the compiler prints it (escaped once) and as the auditor reads it. */
function shown(item: AcceptedEvidence): { mdx: string; text: string } {
  const text = renderEvidenceInline(item);
  return { mdx: escapeMdxText(text), text };
}

function re(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

describe("unbound figures in fact-bearing sections (F1 defense)", () => {
  it("passes the compiled page, whose figures are all evidence renderings", async () => {
    const result = await auditPage(compiledPage());
    expect(result.errors).toEqual([]);
    expect(result.metrics?.artifact).toMatchObject({ unboundFigures: 0 });
  });

  it('fails "47 PRs on a team of 8" inserted into The Problem prose', async () => {
    const page = replaceOnce(
      compiledPage(),
      FIRST_PROBLEM_END,
      `${FIRST_PROBLEM_END} One engineer reports reviewing 47 PRs in a week on a team of 8.`,
    );
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(/The Problem: unbound figure "47" near line \d+/);
    expect(errors).toMatch(/The Problem: unbound figure "8" near line \d+/);
    expect(errors).toMatch(/guard, not proof of truth/);
  });

  it('fails "60% … 25%" inserted into The Problem prose', async () => {
    const page = replaceOnce(
      compiledPage(),
      FIRST_PROBLEM_END,
      `${FIRST_PROBLEM_END} Another spends 60% of the week reviewing and only 25% coding.`,
    );
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(/The Problem: unbound figure "60%"/);
    expect(errors).toMatch(/The Problem: unbound figure "25%"/);
  });

  it("fails a spelled-out percentage in The Problem prose", async () => {
    const page = replaceOnce(compiledPage(), FIRST_PROBLEM_END, `${FIRST_PROBLEM_END} Reviews take sixty percent of the week.`);
    expect(errorsOf(await auditPage(page))).toMatch(/The Problem: unbound figure "sixty percent"/);
  });

  it("passes a figure that is a linked evidence rendering with its own source", async () => {
    const page = replaceOnce(
      compiledPage(),
      FIRST_PROBLEM_END,
      `${FIRST_PROBLEM_END} The category already sits at ${mdLink(shown(EV.statMeasured).text, FIXTURE_PAGES.report.url)}.`,
    );
    expect((await auditPage(page)).errors).toEqual([]);
  });

  it("fails the same rendering typed as bare text (ruling R10, review P2-4: renderings are allowlisted only where linked or in rows)", async () => {
    // Replaces the S4 test that passed a plain "62% (2025)": a bare rendering
    // is exactly how a figure gets re-attributed to another claim.
    const page = replaceOnce(compiledPage(), FIRST_PROBLEM_END, `${FIRST_PROBLEM_END} Adoption already sits at ${shown(EV.statAdoption).mdx} of developers.`);
    expect(errorsOf(await auditPage(page))).toMatch(/The Problem: unbound figure "62%"/);
  });

  it("fails an evidence link whose figure is right but whose source is not", async () => {
    const { text } = shown(EV.statMeasured);
    const page = replaceOnce(
      compiledPage(),
      `${mdLink(text, FIXTURE_PAGES.report.url)} and expects`,
      `${mdLink(text, FIXTURE_PAGES.survey.url)} and expects`,
    );
    const errors = errorsOf(await auditPage(page));
    expect(errors).toContain(`evidence link "${text}" near line`);
    expect(errors).toMatch(
      /points to https:\/\/survey\.example\.org\/developer-tools-2025, but its evidence source is https:\/\/research\.example\.com\/ai-code-review-market/,
    );
  });

  it("fails unbound figures in Market Research prose, row labels and competitor notes", async () => {
    const cases: Array<[string, string, RegExp]> = [
      [
        "noisy bots have taught developers to ignore automated comments entirely.",
        "noisy bots have taught developers to ignore automated comments entirely. The market grew 300% last year.",
        /Market Research: unbound figure "300%"/,
      ],
      [
        `**${escapeMdxText(marketSignalLabel(EV.statAdoption))}**`,
        "**Developers using AI code review assistants, up 300% (adoption)**",
        /Market Research: unbound figure "300%"/,
      ],
      [
        "which suits teams already living in its workflow.",
        "which suits teams already living in its workflow and reports 40,000 customers.",
        /Competitive Landscape: unbound figure "40,000"/,
      ],
    ];
    for (const [from, to, expected] of cases) {
      const page = replaceOnce(compiledPage(), from, to);
      expect(errorsOf(await auditPage(page)), to).toMatch(expected);
    }
  });
});

describe("competitor and market signal rows", () => {
  it("fails a changed competitor price", async () => {
    const pro = shown(EV.pricePro);
    const changed = pro.text.replace("$24", "$19");
    const page = replaceOnce(compiledPage(), `${pro.mdx} [CodeRabbit pricing]`, `${escapeMdxText(changed)} [CodeRabbit pricing]`);
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(
      new RegExp(`competitor row "CodeRabbit" \\(line \\d+\\): published price "${re(changed)}" is not an accepted price for CodeRabbit`),
    );
    expect(errors).toContain(`accepted price "${pro.text}" (${EV.pricePro.id}) is missing from the row`);
  });

  it("fails a price moved to another competitor", async () => {
    const graphite = `${shown(EV.priceGraphite).mdx} ${mdLink(FIXTURE_PAGES.graphite.title, FIXTURE_PAGES.graphite.url)}`;
    const qodo = `${shown(EV.priceQodo).mdx} ${mdLink(FIXTURE_PAGES.qodo.title, FIXTURE_PAGES.qodo.url)}`;
    const page = replaceOnce(replaceOnce(compiledPage(), graphite, "@@GRAPHITE@@"), qodo, graphite).replace("@@GRAPHITE@@", qodo);
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(new RegExp(`competitor row "Graphite" .*: price "${re(shown(EV.priceQodo).text)}" is Qodo's accepted price, not Graphite's`));
    expect(errors).toMatch(new RegExp(`competitor row "Qodo" .*: price "${re(shown(EV.priceGraphite).text)}" is Graphite's accepted price, not Qodo's`));
  });

  it("fails a changed market figure", async () => {
    const measured = shown(EV.statMeasured);
    const changed = measured.text.replace("$1.4", "$1.9");
    const page = replaceOnce(compiledPage(), `${measured.mdx} ([AI code review`, `${escapeMdxText(changed)} ([AI code review`);
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(new RegExp(`market signal row at line \\d+: "${re(changed)}" is not the rendering of a selected market stat`));
    expect(errors).toContain(`market signal fidelity: selected stat ${EV.statMeasured.id} ("${measured.text}") has no matching row`);
  });

  it("fails a market signal row whose figure is right but whose source is not", async () => {
    const adoption = shown(EV.statAdoption);
    const page = replaceOnce(
      compiledPage(),
      `${adoption.mdx} (${mdLink(FIXTURE_PAGES.survey.title, FIXTURE_PAGES.survey.url)})`,
      `${adoption.mdx} (${mdLink(FIXTURE_PAGES.survey.title, FIXTURE_PAGES.report.url)})`,
    );
    expect(errorsOf(await auditPage(page))).toContain(
      `"${adoption.text}" links to ${FIXTURE_PAGES.report.url}, but its evidence source is ${FIXTURE_PAGES.survey.url}`,
    );
  });

  it("requires (via host) on a secondary price and refuses it on a first-party price", async () => {
    const sourcery = shown(EV.priceSourcery);
    const unlabelled = replaceOnce(compiledPage(), `${sourcery.mdx} (via reviews.example.com) [Best AI`, `${sourcery.mdx} [Best AI`);
    expect(errorsOf(await auditPage(unlabelled))).toMatch(
      new RegExp(`competitor row "Sourcery" .*: secondary price "${re(sourcery.text)}" must be labelled "\\(via reviews\\.example\\.com\\)"`),
    );
    const graphite = shown(EV.priceGraphite);
    const mislabelled = replaceOnce(compiledPage(), `${graphite.mdx} [Graphite pricing]`, `${graphite.mdx} (via graphite.dev) [Graphite pricing]`);
    expect(errorsOf(await auditPage(mislabelled))).toMatch(
      new RegExp(`competitor row "Graphite" .*: first-party price "${re(graphite.text)}" is labelled "\\(via graphite\\.dev\\)"`),
    );
  });

  it("allows a shared secondary URL when each price is separately bound and labelled", async () => {
    const page = compiledPage();
    expect(page.match(/\(via reviews\.example\.com\) \[Best AI code review tools\]/g)).toHaveLength(2);
    expect((await auditPage(page)).errors).toEqual([]);
  });

  describe("a first-party pricing URL backs one competitor only (ruling R5)", () => {
    const coderabbitUrl = FIXTURE_PAGES.coderabbit.url;
    const graphiteLine = "Graphite charges $40/user/month for its Team plan.";
    const coderabbitText = `${FIXTURE_PAGES.coderabbit.text}\n${graphiteLine}`;
    const graphiteOnCodeRabbit = {
      vendor: "Graphite",
      sourceUrl: coderabbitUrl,
      supportingText: graphiteLine,
      plan: "Team",
      priceText: "$40/user/month",
    };
    const options = {
      pages: { coderabbit: { text: coderabbitText } },
      extraCandidates: { competitorPrices: [graphiteOnCodeRabbit] },
    };
    const R5_DETAIL = "the source is CodeRabbit's own site (coderabbit.ai); a vendor's own site is not evidence for Graphite's price (ruling R5)";

    /** Graphite's price from CodeRabbit's page, accepted as if CodeRabbit were unknown: what R5 forbids in a record. */
    function smuggledPrice(): AcceptedEvidence {
      const item = acceptEvidence({
        candidates: { quotes: [], marketStats: [], competitorPrices: [graphiteOnCodeRabbit] },
        citations: [{ url: coderabbitUrl, title: FIXTURE_PAGES.coderabbit.title }],
        sources: new Map([
          [coderabbitUrl, { status: "read", text: coderabbitText, retrievedAt: FIXTURE_RETRIEVED_AT, textSha256: sha256Hex(coderabbitText) }],
        ]),
      }).accepted[0];
      if (!item) throw new Error("fixture: Graphite price was not accepted without vendor context");
      return item;
    }

    /** The fixture record with Graphite priced only by the smuggled item. */
    function withSmuggledGraphitePrice(record: ResearchRecordV2, smuggled: AcceptedEvidence): void {
      const graphite = record.competitors.find((c) => c.name === "Graphite");
      if (!graphite) throw new Error("fixture: no Graphite competitor");
      record.evidence.accepted.push(smuggled);
      graphite.priceIds = [smuggled.id];
    }

    it("never accepts a rival's price from a competitor's own pricing page", () => {
      const record = buildFixtureRecord(undefined, options);
      expect(
        record.evidence.accepted.some((e) => e.kind === "competitor_price" && e.vendor === "Graphite" && e.sourceUrl === coderabbitUrl),
      ).toBe(false);
      expect(record.evidence.rejected).toContainEqual({
        kind: "competitor_price",
        reason: "ambiguous_attribution",
        sourceUrl: coderabbitUrl,
        candidate: "Graphite: $40/user/month",
        detail: R5_DETAIL,
      });
    });

    it("refuses a record that stores one, so the auditor fails the page on its record", async () => {
      const smuggled = smuggledPrice();
      expect(() => buildFixtureRecord((r) => withSmuggledGraphitePrice(r, smuggled), options)).toThrow(
        `claim: ambiguous_attribution (${R5_DETAIL})`,
      );
      const tampered = structuredClone(buildFixtureRecord(undefined, options));
      withSmuggledGraphitePrice(tampered, smuggled);
      const errors = errorsOf(await auditPage(compiledPage(buildFixtureRecord(undefined, options)), tampered));
      expect(errors).toMatch(/is not a valid contract v2 record: .*claim: ambiguous_attribution \(the source is CodeRabbit's own site/);
    });

    it("still flags a pricing URL that backs two competitors when a record skips the parser (defense in depth)", () => {
      const clean = buildFixtureRecord(undefined, options);
      const tampered = structuredClone(clean);
      withSmuggledGraphitePrice(tampered, smuggledPrice());
      const graphite = shown(EV.priceGraphite).mdx;
      const page = replaceOnce(
        compiledPage(clean),
        `${graphite} ${mdLink(FIXTURE_PAGES.graphite.title, FIXTURE_PAGES.graphite.url)}`,
        `${graphite} (via coderabbit.ai) ${mdLink(FIXTURE_PAGES.coderabbit.title, FIXTURE_PAGES.coderabbit.url)}`,
      );
      expect(auditEngineArtifact(pageBody(page), tampered).errors.join("\n")).toMatch(
        /pricing URL https:\/\/www\.coderabbit\.ai\/pricing backs CodeRabbit, Graphite; a first-party URL may back one competitor/,
      );
    });
  });

  it("fails keyword rows that no longer match the record's provider metrics", async () => {
    const page = replaceOnce(compiledPage(), "- **ai code review** — 2400/mo", "- **ai code review** — 24000/mo");
    expect(errorsOf(await auditPage(page))).toMatch(
      /keyword row at line \d+ "ai code review — 24000\/mo, competition 0\.42, CPC \$6\.50" does not match the record's provider keyword metrics/,
    );
  });

  it("fails a competitor row for a company the record does not name", async () => {
    const page = replaceOnce(compiledPage(), "- **Qodo** —", "- **Qodo AI** —");
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(/competitor row "Qodo AI" .*: not a competitor in the research record/);
    expect(errors).toContain("Competitive Landscape has no row for Qodo");
  });
});
