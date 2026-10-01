/**
 * Final-artifact evidence rows and the unbound-figure guard (WP46-S4; plan
 * §7.5–6 F1 defense, contract §9).
 *
 * Market signal and competitor rows must show their evidence's canonical
 * rendering with that evidence's own source. In The Problem, Market Research
 * and Competitive Landscape, a figure in prose that is not a rendering of
 * evidence the record references is an "unbound figure" — a guard against
 * figures typed into the page, not proof that the prose is true.
 */

import { afterEach, describe, expect, it } from "vitest";

import { auditPage, cleanupTempDirs, compiledPage, replaceOnce } from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord, EV, FIXTURE_PAGES } from "./__fixtures__/recordV2.ts";

afterEach(cleanupTempDirs);

function errorsOf(result: { errors: string[] }): string {
  return result.errors.join("\n");
}

const FIRST_PROBLEM_END = "the onboarding of new contributors.";

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

  it("passes a figure that is a selected evidence rendering, plain or linked", async () => {
    const page = replaceOnce(
      compiledPage(),
      FIRST_PROBLEM_END,
      `${FIRST_PROBLEM_END} Adoption already sits at 62% (2025) of developers, in a market of [$1.4 billion (2025)](${FIXTURE_PAGES.report.url}).`,
    );
    expect((await auditPage(page)).errors).toEqual([]);
  });

  it("fails an evidence link whose figure is right but whose source is not", async () => {
    const page = replaceOnce(
      compiledPage(),
      `[$1.4 billion (2025)](${FIXTURE_PAGES.report.url}) and expects`,
      `[$1.4 billion (2025)](${FIXTURE_PAGES.survey.url}) and expects`,
    );
    expect(errorsOf(await auditPage(page))).toContain(
      `evidence link "$1.4 billion (2025)" near line`,
    );
    expect(errorsOf(await auditPage(page))).toMatch(
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
        "**Developers using AI code review assistants (adoption)**",
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
    const page = replaceOnce(
      compiledPage(),
      "$24/user/month, billed annually (Pro) [CodeRabbit pricing]",
      "$19/user/month, billed annually (Pro) [CodeRabbit pricing]",
    );
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(
      /competitor row "CodeRabbit" \(line \d+\): published price "\$19\/user\/month, billed annually \(Pro\)" is not an accepted price for CodeRabbit/,
    );
    expect(errors).toContain(`accepted price "$24/user/month, billed annually (Pro)" (${EV.pricePro.id}) is missing from the row`);
  });

  it("fails a price moved to another competitor", async () => {
    const graphite = "$40/user/month (Team) [Graphite pricing](https://graphite.dev/pricing)";
    const qodo = "$30/user/month, billed annually (Teams) [Qodo pricing](https://www.qodo.ai/pricing)";
    const page = replaceOnce(replaceOnce(compiledPage(), graphite, "@@GRAPHITE@@"), qodo, graphite).replace("@@GRAPHITE@@", qodo);
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(/competitor row "Graphite" .*: price "\$30\/user\/month, billed annually \(Teams\)" is Qodo's accepted price, not Graphite's/);
    expect(errors).toMatch(/competitor row "Qodo" .*: price "\$40\/user\/month \(Team\)" is Graphite's accepted price, not Qodo's/);
  });

  it("fails a changed market figure", async () => {
    const page = replaceOnce(compiledPage(), "$1.4 billion (2025) ([AI code review", "$1.9 billion (2025) ([AI code review");
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(/market signal row at line \d+: "\$1\.9 billion \(2025\)" is not the rendering of a selected market stat/);
    expect(errors).toContain(`market signal fidelity: selected stat ${EV.statMeasured.id} ("$1.4 billion (2025)") has no matching row`);
  });

  it("fails a market signal row whose figure is right but whose source is not", async () => {
    const page = replaceOnce(
      compiledPage(),
      `62% (2025) ([Developer tools survey 2025](${FIXTURE_PAGES.survey.url}))`,
      `62% (2025) ([Developer tools survey 2025](${FIXTURE_PAGES.report.url}))`,
    );
    expect(errorsOf(await auditPage(page))).toContain(
      `"62% (2025)" links to ${FIXTURE_PAGES.report.url}, but its evidence source is ${FIXTURE_PAGES.survey.url}`,
    );
  });

  it("requires (via host) on a secondary price and refuses it on a first-party price", async () => {
    const unlabelled = replaceOnce(
      compiledPage(),
      "$12/user/month (Pro) (via reviews.example.com) [Best AI",
      "$12/user/month (Pro) [Best AI",
    );
    expect(errorsOf(await auditPage(unlabelled))).toMatch(
      /competitor row "Sourcery" .*: secondary price "\$12\/user\/month \(Pro\)" must be labelled "\(via reviews\.example\.com\)"/,
    );
    const mislabelled = replaceOnce(
      compiledPage(),
      "$40/user/month (Team) [Graphite pricing]",
      "$40/user/month (Team) (via graphite.dev) [Graphite pricing]",
    );
    expect(errorsOf(await auditPage(mislabelled))).toMatch(
      /competitor row "Graphite" .*: first-party price "\$40\/user\/month \(Team\)" is labelled "\(via graphite\.dev\)"/,
    );
  });

  it("allows a shared secondary URL when each price is separately bound and labelled", async () => {
    const page = compiledPage();
    expect(page.match(/\(via reviews\.example\.com\) \[Best AI code review tools\]/g)).toHaveLength(2);
    expect((await auditPage(page)).errors).toEqual([]);
  });

  it("fails a first-party pricing URL that backs a second competitor", async () => {
    const coderabbitUrl = FIXTURE_PAGES.coderabbit.url;
    const record = buildFixtureRecord(
      (r) => {
        const onCodeRabbit = r.evidence.accepted.find(
          (e) => e.kind === "competitor_price" && e.vendor === "Graphite" && e.sourceUrl === coderabbitUrl,
        );
        const graphite = r.competitors.find((c) => c.name === "Graphite");
        if (!onCodeRabbit || !graphite) throw new Error("fixture: Graphite price on the CodeRabbit page not accepted");
        graphite.priceIds = [onCodeRabbit.id];
      },
      {
        pages: { coderabbit: { text: `${FIXTURE_PAGES.coderabbit.text}\nGraphite charges $40/user/month for its Team plan.` } },
        extraCandidates: {
          competitorPrices: [
            {
              vendor: "Graphite",
              sourceUrl: coderabbitUrl,
              supportingText: "Graphite charges $40/user/month for its Team plan.",
              plan: "Team",
              priceText: "$40/user/month",
            },
          ],
        },
      },
    );
    const page = compiledPage(record);
    expect(page).toContain("$40/user/month (Team) (via coderabbit.ai) [CodeRabbit pricing](https://www.coderabbit.ai/pricing)");
    expect(errorsOf(await auditPage(page, record))).toMatch(
      /pricing URL https:\/\/www\.coderabbit\.ai\/pricing backs CodeRabbit, Graphite; a first-party URL may back one competitor/,
    );
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
