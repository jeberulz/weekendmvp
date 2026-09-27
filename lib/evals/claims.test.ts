/**
 * WP41-S3 tests: claim extraction, source fetching, verification, and the
 * layer orchestrator. Fixture transports only: no key, no network, no spend.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createDiskCache, createMemoryCache, hashKey } from "./cache.ts";
import { buildExtractMessages, listSources, validateClaims, type Claim } from "./claims.ts";
import { fetchSource, htmlToText } from "./fetch-source.ts";
import { claimsFixtureReply, fixtureSourceFetch } from "./fixture-replies.ts";
import { combineChecks, estimatePageWorstCaseUsd, runClaimLayers, type ClaimsConfig, type Section } from "./layers.ts";
import { createEvalLlm } from "./llm.ts";
import { FIXTURE_MODELS, type FixtureChatBody, type FixtureReply } from "./providers/fixtures.ts";
import type { ModelRates } from "./providers/openrouter.ts";
import { containsVerbatim, numberTokens } from "./text.ts";
import { selectPassages, validateVerdicts } from "./verify.ts";

const CONFIG: ClaimsConfig = {
  maxPerPage: 25,
  extractMaxOutputTokens: 3000,
  verifyMaxOutputTokens: 1500,
  windowChars: 600,
  passagesPerClaim: 3,
  maxPassageCharsPerCall: 6000,
  maxVerifyCallsPerPage: 8,
  fetchTimeoutMs: 1000,
  maxSourceBytes: 2_000_000,
  maxSourceTextChars: 200_000,
  minClaimsForShareWarn: 3,
  unsupportedShareWarn: 0.5,
  unreachableShareWarn: 0.4,
};

const MODELS = { extractor: FIXTURE_MODELS[0], verifier: FIXTURE_MODELS[1] };
const FACTUAL = ["The Problem", "Market Research", "Competitive Landscape"];
const GV = "https://www.grandviewresearch.com/industry-analysis/invoicing";
const ACME = "https://acme-invoices.io/pricing";

const SECTIONS: Section[] = [
  { title: "The Problem", content: "Freelancers chase late invoices by hand every **single** month." },
  {
    title: "Market Research",
    content:
      "Grand View puts the invoicing software market at **$4.2 billion** in 2025.\n\nThe market grows 9.1% a year according to analysts.",
  },
  { title: "Competitive Landscape", content: "- **Acme Invoices** — Pricing: $12/month for solo users." },
  { title: "Business Model", content: "Charge $19/month." },
  {
    title: "Sources",
    content: `- [Grand View — invoicing market](${GV})\n- [Acme pricing](${ACME})\n- [Related idea](/ideas/other)`,
  },
];

const longPage = (body: string) =>
  `<html><body><nav>Home Pricing</nav><main><p>${body}</p><p>${"Background text about invoicing tools and small businesses. ".repeat(6)}</p></main><footer>© site</footer></body></html>`;

function claim(id: string, quote: string, value = ""): Claim {
  return { id, quote, type: "other", value, sourceIds: [1] };
}

/** Fixture LLM whose replies can be overridden per task. */
function fixtureLlm(override?: (body: FixtureChatBody) => FixtureReply | undefined) {
  return createEvalLlm({
    mode: "fixture",
    capUsd: 1,
    fixture: {
      models: FIXTURE_MODELS,
      reply: (body) => override?.(body) ?? claimsFixtureReply(body),
    },
  });
}

describe("text helpers", () => {
  it("matches quotes across markdown, curly quotes and dashes", () => {
    const page = "Grand View puts it at **$4.2 billion** — per [the report](https://x.io), it’s growing.";
    expect(containsVerbatim(page, "Grand View puts it at $4.2 billion - per the report, it's growing.")).toBe(true);
    expect(containsVerbatim(page, "Grand View puts it at $5 billion")).toBe(false);
    expect(containsVerbatim(page, "Grand")).toBe(false); // too short to count
  });

  it("extracts number tokens in the forms a source may print them", () => {
    expect(numberTokens("about 456,000 members and $12.5 billion, 3 apps")).toEqual(["456,000", "456000", "12.5"]);
  });
});

describe("claims extraction", () => {
  it("numbers external sources and skips cross-links and duplicates", () => {
    const sources = listSources(SECTIONS[4].content + `\n- [again](${GV})`);
    expect(sources.map((s) => [s.id, s.url])).toEqual([
      [1, GV],
      [2, ACME],
    ]);
  });

  it("puts the page and numbered sources in the prompt", () => {
    const { system, user } = buildExtractMessages({ factualText: "PAGE", sources: listSources(SECTIONS[4].content), maxClaims: 7 });
    expect(system).toContain("At most 7 claims");
    expect(user).toContain(`[1] Grand View — invoicing market — ${GV}`);
  });

  it("drops quotes the page does not contain and invalid source ids", () => {
    const text = "Grand View puts the market at **$4.2 billion** in 2025. Acme charges $12/month.";
    const { claims, dropped } = validateClaims(
      {
        claims: [
          { quote: "Grand View puts the market at $4.2 billion in 2025.", type: "market_size", value: "$4.2B", sourceIds: [1, 9, "2"] },
          { quote: "The market is worth $9 billion.", type: "market_size", sourceIds: [1] },
          { quote: "Acme charges $12/month.", type: "bogus", sourceIds: "1" },
          { quote: "Acme charges $12/month.", type: "pricing", sourceIds: [] },
        ],
      },
      { factualText: text, sourceCount: 2, maxClaims: 25 },
    );
    expect(claims).toHaveLength(2);
    expect(claims[0]).toMatchObject({ id: "c1", type: "market_size", sourceIds: [1, 2] });
    expect(claims[1]).toMatchObject({ type: "other", sourceIds: [] });
    expect(dropped).toEqual([{ quote: "The market is worth $9 billion.", reason: "quote not found verbatim in the page" }]);
  });

  it("survives a reply without a claims array", () => {
    expect(validateClaims({ nope: 1 }, { factualText: "x", sourceCount: 0, maxClaims: 5 }).claims).toEqual([]);
  });
});

describe("fetchSource", () => {
  const options = { timeoutMs: 1000, maxBytes: 100_000, maxTextChars: 50_000 };

  it("strips page chrome and keeps article text", () => {
    const text = htmlToText(longPage("The market reached $4.2 billion in 2025."));
    expect(text).toContain("$4.2 billion");
    expect(text).not.toContain("Home Pricing");
    expect(text).not.toContain("© site");
  });

  it("reports http errors, non-HTML and empty pages without text", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("404")) return new Response("x", { status: 404 });
      if (url.endsWith("pdf")) return new Response("%PDF", { headers: { "content-type": "application/pdf" } });
      return new Response("<html><body><div id=app></div></body></html>", { headers: { "content-type": "text/html" } });
    }) as typeof fetch;
    expect((await fetchSource("https://a.io/404", { ...options, fetchImpl })).status).toBe("http_error");
    expect((await fetchSource("https://a.io/x.pdf", { ...options, fetchImpl })).status).toBe("unreadable");
    expect((await fetchSource("https://a.io/spa", { ...options, fetchImpl })).status).toBe("unreadable");
  });

  it("caches successes but not network errors", async () => {
    const cache = createMemoryCache();
    let calls = 0;
    const ok = (async () => (calls++, new Response(longPage("Figures."), { headers: { "content-type": "text/html" } }))) as typeof fetch;
    await fetchSource(GV, { ...options, fetchImpl: ok, cache });
    await fetchSource(GV, { ...options, fetchImpl: ok, cache });
    expect(calls).toBe(1);

    const down = (async () => {
      calls++;
      throw new Error("ECONNRESET");
    }) as typeof fetch;
    expect((await fetchSource(ACME, { ...options, fetchImpl: down, cache })).status).toBe("network_error");
    await fetchSource(ACME, { ...options, fetchImpl: down, cache });
    expect(calls).toBe(3);
  });
});

describe("verification", () => {
  const source = { id: 1, title: "GV", url: GV };

  it("selects passages near a claim's figures and skips unrelated text", () => {
    const text = `${"Unrelated filler about weather patterns. ".repeat(40)} The invoicing software market was valued at USD 4.2 billion in 2025. ${"More unrelated filler text. ".repeat(40)}`;
    const passages = selectPassages(text, [claim("c1", "the invoicing market is $4.2 billion", "$4.2 billion")], {
      windowChars: 300,
      passagesPerClaim: 2,
      maxChars: 6000,
    });
    expect(passages.length).toBeGreaterThan(0);
    expect(passages.join(" ")).toContain("4.2 billion");
    expect(selectPassages("nothing relevant here at all", [claim("c1", "Acme charges $12/month.")], {
      windowChars: 300,
      passagesPerClaim: 2,
      maxChars: 6000,
    })).toEqual([]);
  });

  it("downgrades verdicts whose evidence is not in the source", () => {
    const text = "The market was valued at USD 4.2 billion in 2025 and grows 9.1% a year.";
    const claims = [claim("c1", "a"), claim("c2", "b"), claim("c3", "c"), claim("c4", "d")];
    const checks = validateVerdicts(
      {
        results: [
          { id: "c1", verdict: "supported", evidence: "valued at USD 4.2 billion in 2025" },
          { id: "c2", verdict: "contradicted", evidence: "valued at USD 9 billion" },
          { id: "c3", verdict: "maybe", evidence: "" },
        ],
      },
      claims,
      source,
      text,
    );
    expect(checks.map((c) => c.status)).toEqual(["supported", "not_found", "not_found", "not_found"]);
    expect(checks[1].note).toMatch(/not in the source/);
    expect(checks[3].note).toBe("verifier gave no answer");
  });

  it("prefers a supporting source over a contradicting one", () => {
    expect(
      combineChecks([
        { claimId: "c1", status: "contradicted", sourceId: 1 },
        { claimId: "c1", status: "supported", sourceId: 2 },
      ])?.sourceId,
    ).toBe(2);
  });
});

describe("runClaimLayers", () => {
  const base = { slug: "test-idea", sections: SECTIONS, models: MODELS, config: CONFIG, factualSections: FACTUAL, sourcesTitle: "Sources" };

  it("layer 1 extracts claims without fetching any source", async () => {
    const llm = fixtureLlm();
    const result = await runClaimLayers({ ...base, layers: 1, llm, sourceFetch: fixtureSourceFetch({ [GV]: 500, [ACME]: 500 }) });
    expect(result.metrics.claims).toBeGreaterThan(0);
    expect(result.metrics.sourcesChecked).toBe(0);
    expect(llm.ledger().map((e) => e.label)).toEqual(["extract test-idea"]);
  });

  it("marks a claim supported when the cited source states it", async () => {
    const llm = fixtureLlm();
    const result = await runClaimLayers({
      ...base,
      layers: 2,
      llm,
      sourceFetch: fixtureSourceFetch({
        [GV]: longPage("Grand View puts the invoicing software market at $4.2 billion in 2025."),
      }),
    });
    const gv = result.claims.find((c) => c.quote.includes("$4.2 billion"));
    expect(gv?.status).toBe("supported");
    expect(result.fails).toEqual([]);
    expect(result.metrics.costUsd).toBeGreaterThan(0);
  });

  it("fails a page whose cited source contradicts a figure", async () => {
    const llm = fixtureLlm((body) => {
      const system = body.messages[0].content;
      if (!system.includes("VERIFY_CLAIMS")) return undefined;
      return {
        text: JSON.stringify({
          results: [{ id: "c1", verdict: "contradicted", evidence: "market was valued at USD 1.1 billion in 2025" }],
        }),
      };
    });
    const result = await runClaimLayers({
      ...base,
      layers: 2,
      llm,
      sourceFetch: fixtureSourceFetch({
        [GV]: longPage("The invoicing software market was valued at USD 1.1 billion in 2025, Grand View says."),
      }),
    });
    expect(result.fails[0]).toMatchObject({ check: "claims.contradicted" });
    expect(result.fails[0].message).toContain("grandviewresearch.com says");
    expect(result.metrics.contradicted).toBe(1);
  });

  it("labels uncited claims unsourced and unreadable sources unverifiable", async () => {
    const llm = fixtureLlm((body) =>
      body.messages[0].content.includes("EXTRACT_CLAIMS")
        ? {
            text: JSON.stringify({
              claims: [
                { quote: "The market grows 9.1% a year according to analysts.", type: "growth_rate", value: "9.1%", sourceIds: [] },
                { quote: "Pricing: $12/month for solo users.", type: "pricing", value: "$12/month", sourceIds: [2] },
                { quote: "Freelancers chase late invoices by hand every single month.", type: "other", value: "", sourceIds: [] },
              ],
            }),
          }
        : undefined,
    );
    const result = await runClaimLayers({ ...base, layers: 2, llm, sourceFetch: fixtureSourceFetch({ [ACME]: 403 }) });
    expect(result.claims.map((c) => c.status)).toEqual(["unsourced", "unverifiable", "unsourced"]);
    expect(result.claims[1].note).toBe("source http_error 403");
    expect(result.warns.map((w) => w.check).sort()).toEqual(["claims.unsupported", "sources.unreachable"]);
  });

  it("re-runs an unchanged page from cache for $0", async () => {
    const cache = createMemoryCache();
    const sourceFetch = fixtureSourceFetch({ [GV]: longPage("Grand View puts the invoicing software market at $4.2 billion in 2025.") });
    const first = await runClaimLayers({ ...base, layers: 2, llm: fixtureLlm(), cache, sourceFetch });
    const llm = fixtureLlm();
    const second = await runClaimLayers({ ...base, layers: 2, llm, cache, sourceFetch });
    expect(first.metrics.costUsd).toBeGreaterThan(0);
    expect(second.metrics.costUsd).toBe(0);
    expect(llm.ledger()).toHaveLength(0);
    expect(second.claims).toEqual(first.claims);
  });

  it("estimates a positive worst case that grows with layer 2", () => {
    const rates: ModelRates = { id: "m", name: "m", promptUsd: 0.0000005, completionUsd: 0.0000015, requestUsd: 0, contextLength: null, supportedParameters: null };
    const args = { sections: SECTIONS, config: CONFIG, factualSections: FACTUAL, sourcesTitle: "Sources", rates: { extractor: rates, verifier: rates } };
    const l1 = estimatePageWorstCaseUsd({ ...args, layers: 1 });
    const l2 = estimatePageWorstCaseUsd({ ...args, layers: 2 });
    expect(l1).toBeGreaterThan(0);
    expect(l2).toBeGreaterThan(l1);
  });
});

describe("disk cache", () => {
  it("round-trips, expires by TTL, and treats corrupt files as misses", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "evals-cache-"));
    let now = 1_000;
    const cache = createDiskCache(dir, { ttlMs: 100, now: () => now });
    const key = hashKey("a", "b");
    cache.set("extract", key, { claims: [1] });
    expect(cache.get("extract", key)).toEqual({ claims: [1] });
    now += 101;
    expect(cache.get("extract", key)).toBeUndefined();
    fs.writeFileSync(path.join(dir, "extract", `${key}.json`), "{not json");
    expect(cache.get("extract", key)).toBeUndefined();
    expect(hashKey("ab", "c")).not.toBe(hashKey("a", "bc"));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("verify output allowance", () => {
  it("scales with the batch and respects the cap", async () => {
    const { verifyOutputTokens } = await import("./verify.ts");
    expect(verifyOutputTokens(1, 1500)).toBe(270);
    expect(verifyOutputTokens(3, 1500)).toBe(510);
    expect(verifyOutputTokens(25, 1500)).toBe(1500);
  });
});

describe("verbatim guard edges", () => {
  it("ignores punctuation a model adds at either end of a quote", () => {
    const page = "**High-teens CAGR** appears in forecasts through the mid-2030s (Industry Research Biz).";
    expect(containsVerbatim(page, "High-teens CAGR appears in forecasts through the mid-2030s.")).toBe(true);
    expect(containsVerbatim(page, '"High-teens CAGR appears in forecasts"')).toBe(true);
    expect(containsVerbatim(page, "Low-teens CAGR appears in forecasts.")).toBe(false);
  });
});

describe("contradiction confirmer", () => {
  const base = {
    slug: "test-idea",
    sections: SECTIONS,
    config: CONFIG,
    factualSections: FACTUAL,
    sourcesTitle: "Sources",
    layers: 2 as const,
    sourceFetch: fixtureSourceFetch({
      [GV]: longPage("The invoicing software market was valued at USD 1.1 billion in 2025, Grand View says."),
    }),
  };
  const confirmer = { model: FIXTURE_MODELS[2], maxOutputTokens: 500 };
  const contradict = (body: FixtureChatBody): FixtureReply | undefined =>
    body.messages[0].content.includes("VERIFY_CLAIMS")
      ? { text: JSON.stringify({ results: [{ id: "c1", verdict: "contradicted", evidence: "market was valued at USD 1.1 billion in 2025" }] }) }
      : undefined;

  it("keeps a contradiction the confirmer agrees with", async () => {
    const llm = fixtureLlm(contradict);
    const result = await runClaimLayers({ ...base, llm, models: { ...MODELS, confirmer } });
    expect(result.metrics.contradicted).toBe(1);
    expect(result.claims[0].note).toBe(`confirmed by ${confirmer.model}`);
    expect(llm.ledger().some((e) => e.label.startsWith("confirm test-idea"))).toBe(true);
  });

  it("downgrades a contradiction the confirmer does not repeat", async () => {
    const llm = fixtureLlm((body) =>
      body.model === confirmer.model
        ? { text: JSON.stringify({ results: [{ id: "c1", verdict: "not_found", evidence: "" }] }) }
        : contradict(body),
    );
    const result = await runClaimLayers({ ...base, llm, models: { ...MODELS, confirmer } });
    expect(result.metrics.contradicted).toBe(0);
    expect(result.fails).toEqual([]);
    expect(result.claims[0]).toMatchObject({ status: "not_found", note: `contradiction not confirmed by ${confirmer.model}` });
  });

  it("accepts an ellipsis only when the parts sit close together in order", () => {
    const page = "SiteKick — Speed-first AI builder with one-click creation. Pricing: ~$20-$99/month for teams.";
    expect(containsVerbatim(page, "SiteKick — Speed-first AI builder... Pricing: ~$20-$99/month")).toBe(true);
    expect(containsVerbatim(page, "Pricing: ~$20-$99/month... SiteKick — Speed-first")).toBe(false);
    expect(containsVerbatim(page, "SiteKick... $5/month")).toBe(false);
  });
});
