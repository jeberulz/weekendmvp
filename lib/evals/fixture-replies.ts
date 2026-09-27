/**
 * WP41-S3. Deterministic fixture replies for Layers 1-2, and a fixture
 * source website. Used by `--fixture` runs and tests: no key, no network,
 * no spend, and the real extraction, verification and guard code runs.
 *
 * The fixture extractor picks sentences with a figure from the page and
 * maps them to source [1]. The fixture verifier answers "supported" only
 * when an excerpt contains the claim's quote word for word, else
 * "not_found". It never contradicts: tests that need a contradiction pass
 * their own reply.
 */

import { EXTRACT_MARKER } from "./claims.ts";
import type { FixtureChatBody, FixtureReply } from "./providers/fixtures.ts";
import type { Fetcher } from "./providers/openrouter.ts";
import { normaliseForMatch } from "./text.ts";
import { VERIFY_MARKER } from "./verify.ts";

function section(user: string, start: string, end?: string): string {
  const from = user.indexOf(start);
  if (from === -1) return "";
  const rest = user.slice(from + start.length);
  const to = end ? rest.indexOf(end) : -1;
  return to === -1 ? rest : rest.slice(0, to);
}

function fixtureExtract(user: string): FixtureReply {
  const page = section(user, "PAGE TEXT:\n", "\n\nSOURCES:\n");
  const hasSources = !section(user, "SOURCES:\n").trim().startsWith("(none)");
  const sentences = page
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, ""))
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => /\d/.test(s) && s.length >= 8 && s.length <= 300);
  const claims = sentences.slice(0, 5).map((quote) => ({
    quote,
    type: "other",
    value: (quote.match(/[$€£]?\d[\d,.]*\s?(?:%|[a-z]+)?/i) ?? [""])[0],
    sourceIds: hasSources ? [1] : [],
  }));
  return { text: JSON.stringify({ claims }) };
}

function fixtureVerify(user: string): FixtureReply {
  const excerpts = normaliseForMatch(section(user, "EXCERPTS:\n", "\n\nCLAIMS:\n"));
  const results = section(user, "CLAIMS:\n")
    .split("\n")
    .map((line) => line.match(/^(c\d+): (.*?)(?: \[figure: .*\])?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map(([, id, quote]) =>
      excerpts.includes(normaliseForMatch(quote))
        ? { id, verdict: "supported", evidence: quote }
        : { id, verdict: "not_found", evidence: "" },
    );
  return { text: JSON.stringify({ results }) };
}

/** Routes a fixture chat call to the extract or verify fixture. */
export function claimsFixtureReply(body: FixtureChatBody): FixtureReply {
  const system = body.messages.find((m) => m.role === "system")?.content ?? "";
  const user = body.messages.find((m) => m.role === "user")?.content ?? "";
  if (system.startsWith(EXTRACT_MARKER)) return fixtureExtract(user);
  if (system.startsWith(VERIFY_MARKER)) return fixtureVerify(user);
  return { text: '{"ok":true}' };
}

/**
 * A fixture web: every URL serves a generic article with no figures, so
 * fixture claims come back not_found. `pages` overrides a URL's HTML, or
 * gives a status number to fake an error.
 */
export function fixtureSourceFetch(pages: Record<string, string | number> = {}): Fetcher {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const page = pages[url];
    if (typeof page === "number") return new Response("error", { status: page });
    const html =
      page ??
      `<html><body><nav>Menu</nav><main><h1>Fixture source</h1><p>This fixture page stands in for ${url}. It discusses the market in general terms without giving any specific figures, prices, or growth rates, so no claim can be confirmed or refuted from it.</p><p>Offline fixture text only.</p></main></body></html>`;
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  }) as Fetcher;
}
