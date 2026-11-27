import { z } from "zod";

/**
 * Research record for a guide (WP103-S4). Every factual claim a guide makes is one entry here, tied either
 * to an outside source with a verbatim excerpt, or to first-hand evidence that can be reproduced.
 *
 * Mirrors the Idea Engine's Source Critic contract, but is its own type so the engine's records stay
 * untouched. Plain Node can load this file (no `@/` alias).
 */

export const RECORD_CONTRACT_VERSION = 1 as const;

/** What a claim is about. Each kind has its own review checks (see `guide-review.ts`). */
export const CLAIM_KINDS = ["stat", "pay", "tool-fact", "date", "quote", "first-hand"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

/** Claims that rest on an outside page, so they need a source and a verbatim excerpt. */
export const EXTERNAL_CLAIM_KINDS = ["stat", "pay", "tool-fact", "date", "quote"] as const;

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z][a-z0-9-]*$/, "ids are lowercase words joined by hyphens");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dates look like 2026-11-27");

export const sourceSchema = z.object({
  id,
  url: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname.length > 0;
    } catch {
      return false;
    }
  }, "a source url must be https with a host"),
  publisher: text,
  title: text,
  /** The day someone last opened the page and read the excerpt on it. */
  dateChecked: isoDate,
  /** When the page says it was published or updated, if it says. */
  published: isoDate.optional(),
});

/** First-hand evidence is checked against this repo or stated by the owner, never taken from the web. */
export const evidenceSchema = z.object({
  id,
  label: text,
  verify: z.discriminatedUnion("type", [
    /** Count files with an extension in a repo folder, like the idea pages in `content/ideas`. */
    z.object({
      type: z.literal("file-count"),
      dir: z.string().regex(/^[\w./()[\]-]+$/, "dir is a repo-relative folder").refine((v) => !v.startsWith("/") && !v.includes(".."), "dir must stay inside the repo"),
      ext: z.string().regex(/^\.[a-z0-9]+$/, "ext looks like .mdx"),
      expect: z.number().int().nonnegative(),
      /** True means the claim says "at least"; false means exactly. */
      atLeast: z.boolean(),
    }),
    /** Count commits, or merged pull requests, in this repo's history. */
    z.object({
      type: z.literal("git-count"),
      what: z.enum(["commits", "pull-request-merges"]),
      expect: z.number().int().nonnegative(),
      atLeast: z.boolean(),
    }),
    /** Something only the owner can say, like "built solo". A reviewer confirms it. Nothing checks it by machine. */
    z.object({ type: z.literal("owner-statement"), statement: text, statedOn: isoDate }),
  ]),
});

const claimBase = { id, text };

export const claimSchema = z.discriminatedUnion("kind", [
  z.object({
    ...claimBase,
    kind: z.enum(["stat", "pay", "tool-fact", "date", "quote"]),
    sourceId: id,
    /** Words copied from the page. The audit re-fetches the page and looks for them. */
    excerpt: text.min(12, "an excerpt is a sentence or a clear phrase, not a word"),
    /** The figure exactly as the page prints it, like "$220K". Needed for stat and pay. */
    display: text.optional(),
    /** The day the figure or fact was true. Needed for pay, tool-fact and date. */
    asOf: isoDate.optional(),
    /** Who said it. Needed for quote. */
    speaker: text.optional(),
  }),
  z.object({ ...claimBase, kind: z.literal("first-hand"), evidenceId: id }),
]);

export const researchRecordSchema = z
  .object({
    contractVersion: z.literal(RECORD_CONTRACT_VERSION),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    sources: z.array(sourceSchema),
    evidence: z.array(evidenceSchema),
    claims: z.array(claimSchema).min(1),
    /** Figures in the guide copy that are structure, not claims, like "5 steps". Listed so they are a choice. */
    allowedNumbers: z.array(text).default([]),
  })
  .superRefine((record, ctx) => {
    const dup = (label: string, ids: string[]) => {
      for (const value of new Set(ids.filter((v, i) => ids.indexOf(v) !== i))) {
        ctx.addIssue({ code: "custom", message: `${label} id "${value}" is used more than once`, path: [label] });
      }
    };
    dup("sources", record.sources.map((s) => s.id));
    dup("evidence", record.evidence.map((e) => e.id));
    dup("claims", record.claims.map((c) => c.id));
  });

export type Source = z.infer<typeof sourceSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type ResearchRecord = z.infer<typeof researchRecordSchema>;

/** The claim's outside source, or its first-hand evidence, whichever it rests on. */
export function claimBasis(record: ResearchRecord, claim: Claim): { source?: Source; evidence?: Evidence } {
  if (claim.kind === "first-hand") return { evidence: record.evidence.find((e) => e.id === claim.evidenceId) };
  return { source: record.sources.find((s) => s.id === claim.sourceId) };
}
