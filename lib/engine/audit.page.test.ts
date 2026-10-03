/**
 * The whole page holds only audited facts (WP54 ruling R10; final review
 * P1-1, P2-4, P2-7, P3-11; security review P2).
 *
 * The unbound-figure guard runs on every section, not only the three factual
 * ones. Figures are allowlisted only where the compiler puts record values:
 * linked evidence renderings and evidence rows (never a bare rendering), the
 * keyword, tier and unit-economics rows that equal the record, the Year-One
 * lines, source titles, bare years and digits inside names. Fenced code,
 * footnotes, images and link definitions are refused outside the build
 * prompts, and inside a prompt fence a figure must be a record value or an
 * evidence rendering. Evidence rows keep the compiler's labels, and the
 * proposal labels stay on the page.
 */

import { afterEach, describe, expect, it } from "vitest";

import { auditPage, cleanupTempDirs, compiledPage, pageBody, replaceOnce } from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord, EV, FIXTURE_PAGES } from "./__fixtures__/recordV2.ts";
import { auditEngineArtifact } from "./artifact-audit.ts";
import type { MarketStatEvidence } from "./evidence/contract.ts";
import { escapeMdxText } from "./evidence/quote.ts";
import { renderEvidenceInline } from "./evidence/tokens.ts";
import { mdLink, proposalLabels } from "./page-format.ts";

afterEach(cleanupTempDirs);

function errorsOf(result: { errors: string[] }): string {
  return result.errors.join("\n");
}

const FIRST_PROBLEM_END = "the onboarding of new contributors.";
const SOLUTION_END = "Everything else stays out of the thread.";

/** The MDX of an evidence rendering as the compiler prints it in a row or link. */
function renderingMdx(item: Parameters<typeof renderEvidenceInline>[0]): string {
  return escapeMdxText(renderEvidenceInline(item));
}

describe("unbound figures in every section (R10, P1-1)", () => {
  it("passes the compiled page: its only figures are evidence, proposals, Year-One lines and record values", async () => {
    const result = await auditPage(compiledPage());
    expect(result.errors).toEqual([]);
    expect(result.metrics?.artifact).toMatchObject({ unboundFigures: 0 });
  });

  it("fails figures typed into The Solution, How it works, what not to build, channels, assumptions, the stack and the prompts section", async () => {
    const cases: Array<[string, string, RegExp]> = [
      [SOLUTION_END, `${SOLUTION_END} Teams of 8 review 47 pull requests a week and lose 60% of it.`, /The Solution: unbound figure "47" near line \d+/],
      ["**Connect** — Install the GitHub App on one repository", "**Connect** — Install the GitHub App on 3 repositories", /The Solution: unbound figure "3" near line \d+/],
      ["explains its reasoning.\n\n## Market Research", "explains its reasoning. Skip it until 25 teams pay.\n\n## Market Research", /The Solution: unbound figure "25"/],
      ["- GitHub Marketplace listing aimed at small private repositories", "- GitHub Marketplace listing aimed at the 30% of small private repositories", /Business Model: unbound figure "30%"/],
      ["trials convert after a short evaluation", "trials convert at 25% after a short evaluation", /Business Model: unbound figure "25%"/],
      ["- **Vercel** — previews and production", "- **Vercel** — previews and production for 40,000 teams", /Recommended Tech Stack: unbound figure "40,000"/],
      ["or your AI coding tool.", "or your AI coding tool. Each takes 2 hours.", /AI Prompts to Build This: unbound figure "2"/],
      ["**Unit Economics**", "### 47 teams already pay\n\n**Unit Economics**", /Business Model: unbound figure "47"/],
    ];
    for (const [from, to, expected] of cases) {
      const page = replaceOnce(compiledPage(), from, to);
      expect(errorsOf(await auditPage(page)), to).toMatch(expected);
    }
  });

  it("does not allowlist a bare evidence rendering (P2-4): a figure counts only where the compiler links or rows it", async () => {
    const bare = replaceOnce(
      compiledPage(),
      FIRST_PROBLEM_END,
      `${FIRST_PROBLEM_END} Adoption already sits at ${renderingMdx(EV.statAdoption)} of developers.`,
    );
    expect(errorsOf(await auditPage(bare))).toMatch(/The Problem: unbound figure "62%"/);

    const linked = replaceOnce(
      compiledPage(),
      FIRST_PROBLEM_END,
      `${FIRST_PROBLEM_END} Adoption already sits at ${mdLink(renderEvidenceInline(EV.statAdoption), EV.statAdoption.sourceUrl)} of developers.`,
    );
    expect((await auditPage(linked)).errors).toEqual([]);
  });

  it("fails a competitor's price rendering re-attributed in bare prose (P1)", async () => {
    const page = replaceOnce(
      compiledPage(),
      "Qodo focuses on review agents",
      `Graphite charges ${renderingMdx(EV.pricePro)} for every seat. Qodo focuses on review agents`,
    );
    expect(errorsOf(await auditPage(page))).toMatch(/Competitive Landscape: unbound figure "\$24/);
  });

  it("fails a figure inside a build prompt that is not a record value, but keeps tier prices and evidence renderings", async () => {
    const page = replaceOnce(compiledPage(), "Persist state between screens", "Target 47 reviews a day. Persist state between screens");
    expect(errorsOf(await auditPage(page))).toMatch(/AI Prompts to Build This: unbound figure "47" in a build prompt near line \d+/);
    const clean = compiledPage();
    expect(clean).toContain("Crew at $20/developer/month");
    expect(clean).toContain(renderEvidenceInline(EV.priceGraphite));
  });

  it("ignores digits inside a competitor name (R10 \"names\"), but a stray figure or a name made of a figure hides nothing", () => {
    // Product and tier names are writer text that R6 keeps figure-free; a competitor name is the
    // evidence's vendor name, so "Qodo 2" may appear bare (the landing-page strip, the row).
    const record = buildFixtureRecord();
    const renamed = (name: string) => {
      const tampered = structuredClone(record);
      const competitor = tampered.competitors.find((c) => c.name === "Qodo");
      const price = tampered.evidence.accepted.find((e) => e.id === EV.priceQodo.id);
      if (!competitor || price?.kind !== "competitor_price") throw new Error("fixture: Qodo missing");
      competitor.name = name;
      price.vendor = name;
      const page = compiledPage(record)
        .split(renderEvidenceInline(EV.priceQodo))
        .join(renderEvidenceInline(price))
        .replace("- **Qodo** —", `- **${name}** —`)
        .replace("Qodo: ", `${name}: `);
      return { tampered, page };
    };
    const named = renamed("Qodo 2");
    expect(named.page).toContain("Qodo 2: ");
    expect(auditEngineArtifact(pageBody(named.page), named.tampered).errors).toEqual([]);
    const stray = replaceOnce(named.page, "Qodo focuses on review agents", "Qodo 3 focuses on review agents");
    expect(auditEngineArtifact(pageBody(stray), named.tampered).errors.join("\n")).toMatch(/Competitive Landscape: unbound figure "3"/);
    const figure = renamed("60%");
    expect(auditEngineArtifact(pageBody(figure.page), figure.tampered).errors.join("\n")).toMatch(/AI Prompts to Build This: unbound figure "60%" in a build prompt/);
  });

  it("never allowlists a market stat's model-written subject (security P2)", () => {
    const record = buildFixtureRecord();
    const tampered = structuredClone(record);
    const stat = tampered.evidence.accepted.find((e): e is MarketStatEvidence => e.id === EV.statMeasured.id && e.kind === "market_stat");
    if (!stat) throw new Error("fixture: measured stat missing");
    stat.subject = "AI code review market, already a $9 billion buyer opportunity";
    // The subject sits inside the verified rendering (masked as evidence), so it is checked on its own.
    const page = replaceOnce(compiledPage(record), `- ${renderingMdx(EV.statMeasured)} (`, `- ${renderingMdx(stat)} (`);
    expect(auditEngineArtifact(pageBody(page), tampered).errors.join("\n")).toMatch(
      new RegExp(`Market Research: the subject of stat ${EV.statMeasured.id} \\(".*"\\) carries the figure "\\$9 billion"; a stat's subject is never allowlisted`),
    );
  });
});

describe("evidence rows cannot be relabelled (R7, R10, P3)", () => {
  it("fails a market signal row whose rendering was edited to another subject or metric", async () => {
    const rendering = renderingMdx(EV.statMeasured);
    for (const edited of [rendering.replace("AI code review market", "Revenue lost to noisy reviews"), rendering.replace("market size", "spend")]) {
      expect(edited).not.toBe(rendering);
      const page = replaceOnce(compiledPage(), `- ${rendering} (`, `- ${edited} (`);
      expect(errorsOf(await auditPage(page)), edited).toMatch(/market signal row at line \d+: ".*" is not the rendering of a selected market stat/);
    }
  });
});

describe("page structure: only what the compiler writes (R10, P3-11)", () => {
  it("fails fenced code outside the build prompts (F4)", async () => {
    const page = replaceOnce(compiledPage(), FIRST_PROBLEM_END, `${FIRST_PROBLEM_END}\n\n\`\`\`text\nTeams review pull requests all day.\n\`\`\`\n`);
    expect(errorsOf(await auditPage(page))).toMatch(/fenced code at line \d+ in The Problem: code blocks belong only in "AI Prompts to Build This"/);
  });

  it("fails footnotes, images and reference-style links anywhere (F6)", async () => {
    const footnote = `${replaceOnce(compiledPage(), FIRST_PROBLEM_END, `${FIRST_PROBLEM_END}[^load]`)}\n[^load]: A team of eight reviews pull requests all week.\n`;
    const footErrors = errorsOf(await auditPage(footnote));
    expect(footErrors).toMatch(/footnoteReference at line \d+: an engine page contains no footnote references/);
    expect(footErrors).toMatch(/footnoteDefinition at line \d+: an engine page contains no footnotes/);

    const image = replaceOnce(compiledPage(), FIRST_PROBLEM_END, `${FIRST_PROBLEM_END} ![chart](${FIXTURE_PAGES.report.url})`);
    expect(errorsOf(await auditPage(image))).toMatch(/image at line \d+: an engine page contains no images/);

    const reference = replaceOnce(compiledPage(), FIRST_PROBLEM_END, `${FIRST_PROBLEM_END} See [the report][r].\n\n[r]: ${FIXTURE_PAGES.report.url}\n`);
    const refErrors = errorsOf(await auditPage(reference));
    expect(refErrors).toMatch(/linkReference at line \d+: an engine page contains no reference-style links/);
    expect(refErrors).toMatch(/definition at line \d+: an engine page contains no link definitions/);
  });

  it("fails content before the first section and sections after ## Sources", async () => {
    const page = compiledPage();
    const before = replaceOnce(page, "## The Problem", "A short intro about review queues.\n\n## The Problem");
    expect(errorsOf(await auditPage(before))).toMatch(/content before ## The Problem at line \d+: an engine page starts with its first section/);
    const after = `${page.trimEnd()}\n\n## Explore More\n\nMore ideas like this one.\n`;
    expect(errorsOf(await auditPage(after))).toMatch(/## Explore More at line \d+ comes after ## Sources: an engine page ends with its Sources list/);
  });

  it("keeps every proposal and planning-assumption label on the page", async () => {
    const labels = proposalLabels("SignalPass");
    const cases: Array<[string, string]> = [
      ["The Solution", labels.howItWorks],
      ["The Solution", labels.dontBuildYet],
      ["Business Model", labels.pricing],
      ["Business Model", labels.unitEconomics],
      ["Business Model", labels.yearOne],
      ["Business Model", labels.channels],
      ["Recommended Tech Stack", labels.stack],
    ];
    const page = compiledPage();
    for (const [section, label] of cases) {
      const mdx = escapeMdxText(label);
      expect(page, label).toContain(`\n${mdx}\n`);
      const removed = replaceOnce(page, `\n${mdx}\n`, "\n");
      expect(errorsOf(await auditPage(removed)), label).toContain(
        `${section}: the label "${label}" is missing; proposals and planning assumptions stay labelled as such`,
      );
    }
  });
});
