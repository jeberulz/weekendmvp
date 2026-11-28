import { z } from "zod";

import { findContiguousSpan, normalizeForSourceMatch } from "../engine/evidence/quote.ts";

import { recordHash } from "./guide-review.ts";
import { EXTERNAL_CLAIM_KINDS, type ResearchRecord } from "./research-record.ts";
import { htmlToText, verifyEvidence, type EvidenceResult, type EvidenceRunners } from "./verify-claims.ts";

/**
 * Re-check for a guide's research record (WP103-S7). A guide's facts go stale: a vendor rewrites a docs page,
 * a figure changes, a page disappears. This fetches each cited page again and reports what moved, with the old
 * excerpt and the closest passage the page has now, so a person can decide what to change.
 *
 * Read-only on the record and the sealed review. Changing a claim after a re-check is a normal record edit, so it
 * needs a fresh review (`draft --force`). Plain Node can load this file.
 */

/** Days between re-checks for a tool guide. The plan sets 30 for tools that change often. */
export const DEFAULT_RECHECK_DAYS = 30;

/** A page passage that shares at least this share of the old excerpt's words counts as the same sentence, reworded. */
export const DRIFT_MIN_SIMILARITY = 0.5;

export type ClaimRecheckStatus = "unchanged" | "drifted" | "gone" | "unreachable";

export type ClaimRecheck = {
  claimId: string;
  sourceId: string;
  status: ClaimRecheckStatus;
  oldExcerpt: string;
  /** The closest passage on the page now, in the page's own characters. Set when the status is "drifted". */
  newExcerpt?: string;
  /** Share of the old excerpt's words found in the closest passage, 0 to 1. Set when a passage was compared. */
  similarity?: number;
  detail: string;
};

export type PageResult = { text: string } | { error: string };

/**
 * The part of the page that most resembles `excerpt`: the window of words that holds the largest share of the
 * excerpt's words, trimmed of leading and trailing words it does not need. Words compare the way the Source Critic compares
 * them (case, punctuation and whitespace never matter). Returns null when the excerpt is too short to compare.
 */
export function closestPassage(excerpt: string, pageText: string): { text: string; similarity: number } | null {
  const wanted = normalizeForSourceMatch(excerpt).words;
  if (wanted.length < 3) return null;
  const page = normalizeForSourceMatch(pageText);
  if (page.words.length === 0) return null;

  const need = new Map<string, number>();
  for (const word of wanted) need.set(word, (need.get(word) ?? 0) + 1);

  // A little room beyond the old length, so a reworded sentence with extra words still fits in one window.
  const size = Math.min(page.words.length, Math.ceil(wanted.length * 1.25) + 2);
  const have = new Map<string, number>();
  let overlap = 0;
  let best = -1;
  let bestStart = 0;

  for (let i = 0; i < page.words.length; i++) {
    const added = page.words[i];
    const wantedCount = need.get(added);
    const haveCount = have.get(added) ?? 0;
    if (wantedCount !== undefined && haveCount < wantedCount) overlap++;
    have.set(added, haveCount + 1);

    if (i >= size) {
      const dropped = page.words[i - size];
      const left = (have.get(dropped) ?? 1) - 1;
      have.set(dropped, left);
      const droppedWanted = need.get(dropped);
      if (droppedWanted !== undefined && left < droppedWanted) overlap--;
    }
    if (i >= size - 1 && overlap > best) {
      best = overlap;
      bestStart = i - size + 1;
    }
  }

  // Trim the window from both ends. A word goes when the window still holds the same share of the old excerpt's
  // words without it: it is not an excerpt word at all, or the window has another copy of it.
  let start = bestStart;
  let end = bestStart + size - 1;
  const inWindow = new Map<string, number>();
  for (let i = start; i <= end; i++) inWindow.set(page.words[i], (inWindow.get(page.words[i]) ?? 0) + 1);
  const redundant = (word: string) => {
    const wanted = need.get(word);
    return wanted === undefined || (inWindow.get(word) ?? 0) > wanted;
  };
  while (start < end && redundant(page.words[start])) {
    inWindow.set(page.words[start], (inWindow.get(page.words[start]) ?? 1) - 1);
    start++;
  }
  while (end > start && redundant(page.words[end])) {
    inWindow.set(page.words[end], (inWindow.get(page.words[end]) ?? 1) - 1);
    end--;
  }
  const [from, to] = expandToSentence(pageText, page.map[start].start, page.map[end].end);
  return { text: pageText.slice(from, to), similarity: Math.round((best / wanted.length) * 100) / 100 };
}

/** How far, in characters, a passage may grow to reach the end of its sentence, so page menus cannot leak in. */
const SENTENCE_REACH = 110;

/**
 * Grow a passage to the whole sentence the page wrote, so a reader sees the page's own wording and not a cut.
 * A side only grows when the sentence boundary is close. Page text has no line breaks, so a menu can run on
 * for a long way without a full stop, and then the passage is left as it was.
 */
function expandToSentence(pageText: string, from: number, to: number): [number, number] {
  const after = pageText.slice(to, to + SENTENCE_REACH).match(/^[^.!?]*[.!?](?=\s|$)/);
  const end = after ? to + after[0].length : to;
  const before = pageText.slice(Math.max(0, from - SENTENCE_REACH), from);
  const stops = [...before.matchAll(/[.!?]\s+/g)];
  const last = stops.at(-1);
  const start = last ? Math.max(0, from - SENTENCE_REACH) + (last.index ?? 0) + last[0].length : from;
  return [start, end];
}

/** Compare every outside claim's excerpt with the page it cites. First-hand claims have no page, so they are skipped. */
export function recheckClaims(record: ResearchRecord, pages: ReadonlyMap<string, PageResult>): ClaimRecheck[] {
  const results: ClaimRecheck[] = [];
  for (const claim of record.claims) {
    if (claim.kind === "first-hand" || !(EXTERNAL_CLAIM_KINDS as readonly string[]).includes(claim.kind)) continue;
    const base = { claimId: claim.id, sourceId: claim.sourceId, oldExcerpt: claim.excerpt };
    const page = pages.get(claim.sourceId);
    if (!page) {
      results.push({ ...base, status: "unreachable", detail: "the source is not in the record" });
      continue;
    }
    if ("error" in page) {
      results.push({ ...base, status: "unreachable", detail: page.error });
      continue;
    }
    if (findContiguousSpan(claim.excerpt, page.text).ok) {
      results.push({ ...base, status: "unchanged", detail: "the excerpt is still on the page" });
      continue;
    }
    const near = closestPassage(claim.excerpt, page.text);
    if (near && near.similarity >= DRIFT_MIN_SIMILARITY) {
      results.push({
        ...base,
        status: "drifted",
        newExcerpt: near.text,
        similarity: near.similarity,
        detail: `the excerpt is not on the page as written, the closest passage shares ${Math.round(near.similarity * 100)}% of its words`,
      });
    } else {
      results.push({
        ...base,
        status: "gone",
        ...(near ? { similarity: near.similarity } : {}),
        detail: "the page has no passage close to the excerpt, so the sentence was removed or the page changed a lot",
      });
    }
  }
  return results;
}

/** Fetch every cited page once. A page that cannot be read is recorded with its error and never counts as unchanged. */
export async function fetchPages(record: ResearchRecord, fetchText: (url: string, sourceId: string) => Promise<string>): Promise<Map<string, PageResult>> {
  const pages = new Map<string, PageResult>();
  for (const source of record.sources) {
    try {
      pages.set(source.id, { text: htmlToText(await fetchText(source.url, source.id)) });
    } catch (error) {
      pages.set(source.id, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return pages;
}

export type EvidenceRecheck = {
  results: EvidenceResult[];
  /** Counts that were checked and no longer hold. */
  mismatch: string[];
  /** Counts a machine should be able to check but the repository could not answer, like git history on a shallow clone. */
  unchecked: string[];
};

/**
 * Reproduce first-hand evidence again. An owner statement can never be checked by a machine, so it is not a gap.
 * A count the repository could not answer is one: the re-check is incomplete, and it must not look finished.
 */
export function recheckEvidence(record: ResearchRecord, runners: EvidenceRunners): EvidenceRecheck {
  const results = verifyEvidence(record, runners);
  const typeOf = (id: string) => record.evidence.find((e) => e.id === id)?.verify.type;
  return {
    results,
    mismatch: results.filter((r) => r.status === "mismatch").map((r) => r.evidenceId),
    unchecked: results.filter((r) => r.status === "unverifiable" && typeOf(r.evidenceId) !== "owner-statement").map((r) => r.evidenceId),
  };
}

const DAY_MS = 24 * 3600 * 1000;

/** How long ago a re-check ran, and whether the next one is overdue. `last` undefined means it never ran. */
export function recheckSchedule(last: string | undefined, everyDays: number, now: number): { neverChecked: boolean; daysSince: number | null; overdueByDays: number } {
  if (!last) return { neverChecked: true, daysSince: null, overdueByDays: 0 };
  const daysSince = Math.floor((now - Date.parse(last)) / DAY_MS);
  return { neverChecked: false, daysSince, overdueByDays: Math.max(0, daysSince - everyDays) };
}

const text = z.string().trim().min(1);

/** The file `--write` leaves next to the record. It is not part of the record, so writing it never makes a review stale. */
export const recheckFileSchema = z.object({
  contractVersion: z.literal(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** Hash of the record that was checked. A different hash now means the record changed after this re-check. */
  recordHash: z.string().regex(/^[0-9a-f]{64}$/),
  checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T/),
  everyDays: z.number().int().min(1).max(365),
  counts: z.object({
    unchanged: z.number().int().nonnegative(),
    drifted: z.number().int().nonnegative(),
    gone: z.number().int().nonnegative(),
    unreachable: z.number().int().nonnegative(),
    evidenceMismatch: z.number().int().nonnegative(),
    evidenceUnchecked: z.number().int().nonnegative(),
  }),
  claims: z.array(
    z.object({
      claimId: text,
      sourceId: text,
      status: z.enum(["unchanged", "drifted", "gone", "unreachable"]),
      oldExcerpt: text,
      newExcerpt: text.optional(),
      similarity: z.number().min(0).max(1).optional(),
      detail: text,
    }),
  ),
});

export type RecheckFile = z.infer<typeof recheckFileSchema>;

export function buildRecheckFile(input: { record: ResearchRecord; claims: readonly ClaimRecheck[]; evidenceMismatch: number; evidenceUnchecked: number; checkedAt: string; everyDays: number }): RecheckFile {
  const count = (status: ClaimRecheckStatus) => input.claims.filter((claim) => claim.status === status).length;
  return {
    contractVersion: 1,
    slug: input.record.slug,
    recordHash: recordHash(input.record),
    checkedAt: input.checkedAt,
    everyDays: input.everyDays,
    counts: { unchanged: count("unchanged"), drifted: count("drifted"), gone: count("gone"), unreachable: count("unreachable"), evidenceMismatch: input.evidenceMismatch, evidenceUnchecked: input.evidenceUnchecked },
    claims: input.claims.map((claim) => ({ ...claim })),
  };
}

/** True when the re-check found nothing that needs a person: no drift, no gone sentence, no unreadable page, no wrong or unchecked count. */
export function recheckIsClean(file: Pick<RecheckFile, "counts">): boolean {
  const { drifted, gone, unreachable, evidenceMismatch, evidenceUnchecked } = file.counts;
  return drifted + gone + unreachable + evidenceMismatch + evidenceUnchecked === 0;
}

/** False when something could not be checked at all. An incomplete re-check must not be saved, or it would reset the cadence clock. */
export function recheckIsComplete(file: Pick<RecheckFile, "counts">): boolean {
  return file.counts.unreachable + file.counts.evidenceUnchecked === 0;
}
