/**
 * Final-artifact quote audit (WP54-S4, review finding F2; plan §8).
 *
 * Every test compiles the fixture record, applies one operator-style edit to
 * the MDX and audits it with the real auditor (scripts/audit-idea-mdx.mjs,
 * engine bar, its v2 record). A blockquote and its "— [title](url)" line are
 * one unit: the quote must equal a selected accepted excerpt exactly and the
 * link must be that excerpt's own source.
 */

import { afterEach, describe, expect, it } from "vitest";

import { auditPage, cleanupTempDirs, compiledPage, replaceOnce } from "./__fixtures__/auditHarness.ts";
import { buildFixtureRecord, EV } from "./__fixtures__/recordV2.ts";
import { quoteBlock } from "./compile.ts";

afterEach(cleanupTempDirs);

const HN_URL = "https://news.ycombinator.com/item?id=27515468";
const HN_ATTRIBUTION = `> — [Ask HN: Is AI code review worth it?](${HN_URL})`;
const HN_LINE = '> "We review 12 pull requests a day and the bot comments on every single one of them."';

function errorsOf(result: { errors: string[] }): string {
  return result.errors.join("\n");
}

describe("quotes and their attribution (F2)", () => {
  it("allows SQL enum identifiers in a build prompt but still refuses fabricated prose", async () => {
    const enumLine = "- plan text check plan in ('open_source_maintainer','solo_repository','pull_request_crew')\n";
    const withEnums = compiledPage().replace("```text\n", `\`\`\`text\n${enumLine}`);
    expect((await auditPage(withEnums)).errors).toEqual([]);
    const withProse = replaceOnce(withEnums, enumLine, `${enumLine}- claim: \"our buyers love noisy reviews\"\n`);
    expect(errorsOf(await auditPage(withProse))).toMatch(/quoted text "our buyers love noisy reviews".*not an accepted community quote/);
  });

  it("passes the original page: every selected quote verified with its own source", async () => {
    const result = await auditPage(compiledPage());
    expect(result.errors).toEqual([]);
    expect(result.metrics?.artifact).toMatchObject({ verifiedQuotes: 3 });
  });

  it("fails a fabricated sentence appended inside a verified quotation", async () => {
    const page = replaceOnce(
      compiledPage(),
      "every single one of them.\"\n>",
      "every single one of them. This product increased our engineering revenue by nine million dollars overnight.\"\n>",
    );
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(/blockquote at line \d+: "We review 12 pull requests .*nine million dollars overnight\." is not a selected evidence quote/);
    expect(errors).toMatch(new RegExp(`quote fidelity: selected quote ${EV.quoteHn.id} .* is missing or no longer matches`));
  });

  it("fails a sentence appended as a lazy continuation line without a > marker", async () => {
    const page = replaceOnce(
      compiledPage(),
      `${HN_LINE}\n>`,
      `${HN_LINE}\nThis product increased our engineering revenue by nine million dollars overnight.\n>`,
    );
    const errors = errorsOf(await auditPage(page));
    expect(errors).toMatch(
      /text after the closing quote mark is part of the quote \("This product increased our engineering revenue by nine million dollars overnight\."\)/,
    );
    expect(errors).toMatch(new RegExp(`quote fidelity: selected quote ${EV.quoteHn.id}`));
  });

  it("fails a wrong source URL while the quote text is unchanged", async () => {
    const page = replaceOnce(compiledPage(), HN_ATTRIBUTION, HN_ATTRIBUTION.replace(HN_URL, "https://example.org/fake-source"));
    const errors = errorsOf(await auditPage(page));
    expect(errors).toContain(
      `attribution links to https://example.org/fake-source, but this quote's evidence source is ${HN_URL}`,
    );
    expect(errors).toMatch(new RegExp(`quote fidelity: selected quote ${EV.quoteHn.id}`));
  });

  it("fails the same host with a different thread (HN item?id=…68 vs …69)", async () => {
    const page = replaceOnce(compiledPage(), HN_ATTRIBUTION, HN_ATTRIBUTION.replace("27515468", "27515469"));
    expect(errorsOf(await auditPage(page))).toContain(
      `attribution links to https://news.ycombinator.com/item?id=27515469, but this quote's evidence source is ${HN_URL}`,
    );
  });

  it("fails a missing attribution line", async () => {
    const page = replaceOnce(compiledPage(), `"\n>\n${HN_ATTRIBUTION}`, '"');
    expect(errorsOf(await auditPage(page))).toMatch(/blockquote at line \d+: missing or malformed attribution/);
  });

  it("fails malformed and ambiguous attribution lines", async () => {
    for (const attribution of [
      "> — Ask HN: Is AI code review worth it?",
      `> — [Ask HN](${HN_URL}) and [a mirror](https://lobste.rs/s/abc123/review_noise)`,
      `> Source: [Ask HN](${HN_URL})`,
      "> — [Ask HN](mailto:someone@example.com)",
    ]) {
      const page = replaceOnce(compiledPage(), HN_ATTRIBUTION, attribution);
      expect(errorsOf(await auditPage(page)), attribution).toMatch(/missing or malformed attribution/);
    }
  });

  it("fails a changed number, an inserted negation, reordered fragments and an unsupported ellipsis", async () => {
    for (const changed of [
      '> "We review 15 pull requests a day and the bot comments on every single one of them."',
      '> "We do not review 12 pull requests a day and the bot comments on every single one of them."',
      '> "The bot comments on every single one of them and we review 12 pull requests a day."',
      '> "We review 12 pull requests a day … every single one of them."',
      '> "We review 12 pull requests a day and the bot comments on every single one of them"',
      '> "we review 12 pull requests a day and the bot comments on every single one of them."',
    ]) {
      const page = replaceOnce(compiledPage(), HN_LINE, changed);
      expect(errorsOf(await auditPage(page)), changed).toMatch(/is not a selected evidence quote/);
    }
  });

  it("passes supported Unicode quote marks, non-breaking spaces and re-wrapped lines", async () => {
    const page = replaceOnce(
      compiledPage(),
      HN_LINE,
      "> “We review 12 pull requests a day\n>   and the bot comments on every\n> single one of them.”",
    );
    expect((await auditPage(page)).errors).toEqual([]);
  });

  it("fails a blockquote that joins two accepted sentences of one source into one quote (R8: whole statements, compared strictly)", async () => {
    // Since R8 a quote is one line of its source, so the S4 multiline-excerpt case cannot occur; whitespace
    // variants stay presentation (the test above), while joining two statements is a different quote.
    expect(EV.quoteForum.excerpt).not.toMatch(/\n/);
    const forumLine = `> "${EV.quoteForum.excerpt}"`;
    const joined = `> "${EV.quoteForum.excerpt} ${EV.quoteUnselected.excerpt}"`;
    const errors = errorsOf(await auditPage(replaceOnce(compiledPage(), forumLine, joined)));
    expect(errors).toMatch(/"Our bot leaves forty comments per PR and nobody reads any of them anymore\. We switched the bot off .*" is not a selected evidence quote/);
    expect(errors).toMatch(new RegExp(`quote fidelity: selected quote ${EV.quoteForum.id}`));
    expect(quoteBlock(EV.quoteForum).split("\n")).toHaveLength(3);
  });

  it("does not let a repeated quote inflate the distinct verified-quote count", async () => {
    const record = buildFixtureRecord((r) => {
      r.community.quoteIds = [EV.quoteHn.id, EV.quoteForum.id];
    });
    const page = replaceOnce(compiledPage(record), quoteBlock(EV.quoteForum), quoteBlock(EV.quoteHn));
    const result = await auditPage(page, record);
    const errors = errorsOf(result);
    expect(errors).toMatch(/needs ≥2 distinct verified community quotes \(got 1\); a repeated quote counts once/);
    expect(errors).toMatch(new RegExp(`quote fidelity: selected quote ${EV.quoteForum.id}`));
    expect(result.metrics?.artifact).toMatchObject({ verifiedQuotes: 1 });
  });

  it("fails a blockquote that is an accepted quote the record does not select", async () => {
    const page = replaceOnce(compiledPage(), "## The Solution", `${quoteBlock(EV.quoteUnselected)}\n\n## The Solution`);
    expect(errorsOf(await auditPage(page))).toMatch(/"We switched the bot off .*" is not a selected evidence quote/);
  });

  it("fails Markdown formatting inside a quote, even when the words match", async () => {
    const page = replaceOnce(compiledPage(), '> "We review 12 pull requests', '> "We review **12** pull requests');
    expect(errorsOf(await auditPage(page))).toMatch(/the quote contains Markdown \(strong\)/);
  });

  it("fails a nested blockquote or other block inside a quote", async () => {
    const page = replaceOnce(compiledPage(), `${HN_LINE}\n>`, `${HN_LINE}\n>\n> > nested\n>`);
    expect(errorsOf(await auditPage(page))).toMatch(/must hold only the quote and its attribution line \(found blockquote\)/);
  });
});
