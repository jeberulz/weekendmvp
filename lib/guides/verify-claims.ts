import { findContiguousSpan } from "../engine/evidence/quote.ts";

import type { Finding } from "./audit.ts";
import { EXTERNAL_CLAIM_KINDS, type ResearchRecord } from "./research-record.ts";

/**
 * Mechanical checks on a guide's research record (WP103-S4). No judgement here, only things a machine can
 * prove: the record is consistent, the cited page contains the excerpt, first-hand evidence can be
 * reproduced from this repo, and every figure in the guide copy traces to a claim.
 *
 * Reuses the Idea Engine's strict word-level excerpt matcher (`lib/engine/evidence/quote.ts`).
 * Plain Node can load this file.
 */

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();
const figureKey = (value: string) => value.toLowerCase().replace(/[\s,]/g, "");

/** Does the record hold together? Every claim has what its kind needs, and every id points at something. */
export function checkRecordConsistency(record: ResearchRecord): Finding[] {
  const findings: Finding[] = [];
  const add = (rule: string, severity: Finding["severity"], message: string, path?: string) =>
    findings.push({ rule, severity, message, ...(path ? { path } : {}) });

  const usedSources = new Set<string>();
  const usedEvidence = new Set<string>();
  for (const claim of record.claims) {
    const at = `claim:${claim.id}`;
    if (claim.kind === "first-hand") {
      usedEvidence.add(claim.evidenceId);
      if (!record.evidence.some((e) => e.id === claim.evidenceId)) {
        add("claim-evidence-missing", "error", `claim "${claim.id}" points at evidence "${claim.evidenceId}", which is not in the record`, at);
      }
      continue;
    }
    usedSources.add(claim.sourceId);
    if (!record.sources.some((s) => s.id === claim.sourceId)) {
      add("claim-source-missing", "error", `claim "${claim.id}" points at source "${claim.sourceId}", which is not in the record`, at);
    }
    if ((claim.kind === "stat" || claim.kind === "pay") && !claim.display) {
      add("claim-display-missing", "error", `a ${claim.kind} claim needs "display", the figure exactly as the page prints it`, at);
    }
    if (claim.display) {
      if (!collapse(claim.excerpt).includes(collapse(claim.display))) {
        add("claim-display-not-in-excerpt", "error", `claim "${claim.id}": the figure "${claim.display}" is not in its excerpt`, at);
      }
      if (!collapse(claim.text).includes(collapse(claim.display))) {
        add("claim-display-not-in-text", "error", `claim "${claim.id}": the figure "${claim.display}" is not in the sentence the guide uses`, at);
      }
    }
    if ((claim.kind === "pay" || claim.kind === "tool-fact" || claim.kind === "date") && !claim.asOf) {
      add("claim-asof-missing", "error", `a ${claim.kind} claim needs "asOf", the day it was true`, at);
    }
    if (claim.kind === "quote" && !claim.speaker) {
      add("claim-speaker-missing", "error", "a quote needs the speaker named", at);
    }
  }
  for (const source of record.sources) {
    if (!usedSources.has(source.id)) add("source-unused", "warn", `source "${source.id}" backs no claim`, `source:${source.id}`);
  }
  for (const evidence of record.evidence) {
    if (!usedEvidence.has(evidence.id)) add("evidence-unused", "warn", `evidence "${evidence.id}" backs no claim`, `evidence:${evidence.id}`);
  }
  return findings;
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" };

/** Page text from HTML: scripts and styles dropped, tags to spaces, common entities decoded. Enough to find a sentence. */
export function htmlToText(html: string): string {
  return collapse(
    html
      .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match),
  );
}

export type ExcerptResult = {
  claimId: string;
  sourceId: string;
  /** "unreachable" means the page could not be read, so the claim is unverified and cannot stand. */
  status: "found" | "not-found" | "unreachable";
  detail: string;
};

/**
 * Re-fetch each cited page and look for each claim's excerpt in it. A page that cannot be read leaves its
 * claims unverified. `fetchText` is injected so tests run without a network.
 */
export async function verifyExcerpts(record: ResearchRecord, fetchText: (url: string) => Promise<string>): Promise<ExcerptResult[]> {
  const pages = new Map<string, { text: string } | { error: string }>();
  for (const source of record.sources) {
    try {
      const body = await fetchText(source.url);
      pages.set(source.id, { text: htmlToText(body) });
    } catch (error) {
      pages.set(source.id, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  const results: ExcerptResult[] = [];
  for (const claim of record.claims) {
    if (!(EXTERNAL_CLAIM_KINDS as readonly string[]).includes(claim.kind) || claim.kind === "first-hand") continue;
    const page = pages.get(claim.sourceId);
    if (!page) {
      results.push({ claimId: claim.id, sourceId: claim.sourceId, status: "unreachable", detail: "the source is not in the record" });
    } else if ("error" in page) {
      results.push({ claimId: claim.id, sourceId: claim.sourceId, status: "unreachable", detail: page.error });
    } else {
      const span = findContiguousSpan(claim.excerpt, page.text);
      results.push(
        span.ok
          ? { claimId: claim.id, sourceId: claim.sourceId, status: "found", detail: "the excerpt is on the page" }
          : { claimId: claim.id, sourceId: claim.sourceId, status: "not-found", detail: `the excerpt is not on the page (${span.reason})` },
      );
    }
  }
  return results;
}

/** What a machine can count in this repo. A runner returns null when it cannot tell, like git on a shallow clone. */
export type EvidenceRunners = {
  countFiles: (dir: string, ext: string) => number;
  gitCount: (what: "commits" | "pull-request-merges") => number | null;
};

export type EvidenceResult = {
  evidenceId: string;
  /** "unverifiable" means a person has to confirm it, or the repo cannot answer here. It is never a pass. */
  status: "verified" | "mismatch" | "unverifiable";
  detail: string;
};

export function verifyEvidence(record: ResearchRecord, runners: EvidenceRunners): EvidenceResult[] {
  return record.evidence.map((evidence): EvidenceResult => {
    const v = evidence.verify;
    if (v.type === "owner-statement") {
      return { evidenceId: evidence.id, status: "unverifiable", detail: `owner statement of ${v.statedOn}, a reviewer must confirm it` };
    }
    const observed = v.type === "file-count" ? runners.countFiles(v.dir, v.ext) : runners.gitCount(v.what);
    if (observed === null) {
      return { evidenceId: evidence.id, status: "unverifiable", detail: "the repository cannot answer this here, for example git history on a shallow clone" };
    }
    const ok = v.atLeast ? observed >= v.expect : observed === v.expect;
    return {
      evidenceId: evidence.id,
      status: ok ? "verified" : "mismatch",
      detail: `observed ${observed}, the record says ${v.atLeast ? "at least " : ""}${v.expect}`,
    };
  });
}

/**
 * Figures in prose that read as claims: money, percentages, K/M/B amounts and counts of three digits or more.
 * Years and small structural numbers like "5 steps" are not picked up.
 */
export function figuresIn(text: string): string[] {
  const out: string[] = [];
  const pattern = /[$£€]\s?\d[\d,]*(?:\.\d+)?\s?[KMB]?\b|\d[\d,]*(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\+?|\b\d{3,}\+?/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0].trim();
    if (/^(?:19|20)\d{2}$/.test(raw)) continue;
    out.push(raw);
  }
  return out;
}

/** A figure as a whole token: spaces, commas and a trailing plus dropped, so "$1,200" and "$1200" are one figure. */
const wholeFigure = (value: string) => figureKey(value).replace(/\+$/, "");

/** Every complete figure a piece of text states, normalised. "1200" is one figure here, never "200" inside it. */
const figureSet = (...texts: string[]): Set<string> => new Set(texts.flatMap((text) => figuresIn(text).map(wholeFigure)));

/**
 * Every figure in the guide copy must trace to a claim or be listed as structure, and every claim's sentence
 * should be in the copy. Run only when the guide has a research record.
 *
 * A figure matches only as a whole token. A claim that says 1200 does not back a 200 in the copy.
 */
export function checkCopyAgainstRecord(record: ResearchRecord, copy: readonly string[]): Finding[] {
  const findings: Finding[] = [];
  const backed = new Set<string>();
  for (const claim of record.claims) {
    for (const value of figureSet(claim.text)) backed.add(value);
    if (claim.kind !== "first-hand" && claim.display) {
      backed.add(wholeFigure(claim.display));
      for (const value of figureSet(claim.display)) backed.add(value);
    }
  }
  // "allowedNumbers" is free text like "5 steps" or "$300K", so read the figures out of each entry too.
  const allowed = new Set<string>(record.allowedNumbers.map(wholeFigure));
  for (const value of figureSet(...record.allowedNumbers)) allowed.add(value);

  const seen = new Set<string>();
  for (const text of copy) {
    for (const figure of figuresIn(text)) {
      const key = wholeFigure(figure);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!backed.has(key) && !allowed.has(key)) {
        findings.push({
          rule: "copy-number-unmapped",
          severity: "error",
          message: `the guide copy says "${figure}", which no claim in the research record backs and "allowedNumbers" does not list`,
        });
      }
    }
  }

  const joined = collapse(copy.join(" ")).toLowerCase();
  for (const claim of record.claims) {
    if (!joined.includes(collapse(claim.text).toLowerCase())) {
      findings.push({
        rule: "claim-unused",
        severity: "warn",
        message: `claim "${claim.id}" is not in the guide copy word for word, so the record may not match what the guide says`,
        path: `claim:${claim.id}`,
      });
    }
  }
  return findings;
}
