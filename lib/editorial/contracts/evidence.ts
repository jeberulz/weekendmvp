import { z } from "zod";

import { EDITORIAL_LIMITS as L } from "./limits";
import {
  calendarDateSchema,
  editorialIdSchema,
  multiLineText,
  publicHttpUrlSchema,
  singleLineText,
  utcTimestampSchema,
} from "./primitives";
import { SECTION_KEYS, type SectionKey } from "./sections";

export const SOURCE_TYPES = [
  "first_party_pricing",
  "vendor_page",
  "community_discussion",
  "news",
  "research_report",
  "government_data",
  "review_site",
  "search_summary",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  first_party_pricing: "First-party pricing",
  vendor_page: "Vendor page",
  community_discussion: "Community discussion",
  news: "News",
  research_report: "Research report",
  government_data: "Government data",
  review_site: "Review site",
  search_summary: "Search summary",
  other: "Other",
};

/**
 * Machine verification of a source excerpt, as reported by the engine.
 * `provisional` means only a search answer backs it; `changed` means the page
 * no longer matches the verified excerpt. None of these is a human review.
 */
export const SOURCE_VERIFICATION_STATUSES = [
  "verified",
  "unverified",
  "unavailable",
  "changed",
  "provisional",
] as const;
export type SourceVerificationStatus = (typeof SOURCE_VERIFICATION_STATUSES)[number];

export const CLAIM_KINDS = ["observed", "derived", "assumed"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CLAIM_TOPICS = [
  "market_size",
  "pricing",
  "competitor",
  "pain",
  "usage",
  "economics",
  "other",
] as const;
export type ClaimTopic = (typeof CLAIM_TOPICS)[number];

export const CLAIM_VERIFICATION_STATUSES = [
  "verified",
  "unverified",
  "unavailable",
  "changed",
  "provisional",
  "not_applicable",
] as const;
export type ClaimVerificationStatus = (typeof CLAIM_VERIFICATION_STATUSES)[number];

/**
 * Who established a verification result. Set by the receiving adapter, never
 * read from a submission: `engine_receipt` requires a validated WP45 receipt
 * (E5); fixtures are always `fixture_simulated`; anything else is `none`.
 */
export const VERIFICATION_AUTHORITIES = ["engine_receipt", "fixture_simulated", "none"] as const;
export type VerificationAuthority = (typeof VERIFICATION_AUTHORITIES)[number];

export const sourceVerificationInputSchema = z.strictObject({
  status: z.enum(SOURCE_VERIFICATION_STATUSES),
  reason: singleLineText(L.verificationReasonChars).nullable(),
  checkedAt: utcTimestampSchema.nullable(),
});

export const editorialSourceInputSchema = z
  .strictObject({
    id: editorialIdSchema,
    url: publicHttpUrlSchema,
    publisher: singleLineText(L.publisherChars).nullable(),
    title: singleLineText(L.sourceTitleChars).nullable(),
    sourceType: z.enum(SOURCE_TYPES),
    /** Unknown stays null; never back-filled with the retrieval date. */
    publishedAt: calendarDateSchema.nullable(),
    retrievedAt: utcTimestampSchema.nullable(),
    excerpt: multiLineText(L.excerptChars).nullable(),
    context: multiLineText(L.contextChars).nullable(),
    verification: sourceVerificationInputSchema,
  })
  .superRefine((source, ctx) => {
    if (source.verification.status === "verified") {
      if (source.excerpt === null || source.retrievedAt === null) {
        ctx.addIssue({
          code: "custom",
          path: ["verification", "status"],
          message: "A verified source needs its excerpt and retrieval time",
        });
      }
      if (source.verification.checkedAt === null) {
        ctx.addIssue({
          code: "custom",
          path: ["verification", "checkedAt"],
          message: "A verified source needs the time it was checked",
        });
      }
    }
    if (source.sourceType === "search_summary" && source.verification.status === "verified") {
      ctx.addIssue({
        code: "custom",
        path: ["verification", "status"],
        message: "A search summary is provisional, not verified",
      });
    }
  });

export const claimVerificationInputSchema = z.strictObject({
  status: z.enum(CLAIM_VERIFICATION_STATUSES),
  reason: singleLineText(L.verificationReasonChars).nullable(),
});

export const editorialClaimInputSchema = z
  .strictObject({
    id: editorialIdSchema,
    text: multiLineText(L.claimTextChars),
    /** Exact wording in the article; editing it marks the claim changed. */
    anchorText: multiLineText(L.anchorTextChars),
    section: z.enum(SECTION_KEYS as [SectionKey, ...SectionKey[]]),
    kind: z.enum(CLAIM_KINDS),
    topic: z.enum(CLAIM_TOPICS),
    material: z.boolean(),
    sourceIds: z.array(editorialIdSchema).max(L.sourceRefsPerClaim),
    contradictingSourceIds: z.array(editorialIdSchema).max(L.sourceRefsPerClaim),
    verification: claimVerificationInputSchema,
  })
  .superRefine((claim, ctx) => {
    const assumed = claim.kind === "assumed";
    if (assumed && claim.verification.status !== "not_applicable") {
      ctx.addIssue({
        code: "custom",
        path: ["verification", "status"],
        message: "An assumption is not verified; use not_applicable",
      });
    }
    if (!assumed && claim.verification.status === "not_applicable") {
      ctx.addIssue({
        code: "custom",
        path: ["verification", "status"],
        message: "Only assumptions may be not_applicable",
      });
    }
    if (claim.verification.status === "verified" && claim.sourceIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceIds"],
        message: "A verified claim needs at least one supporting source",
      });
    }
    const supporting = new Set(claim.sourceIds);
    if (claim.contradictingSourceIds.some((id) => supporting.has(id))) {
      ctx.addIssue({
        code: "custom",
        path: ["contradictingSourceIds"],
        message: "A source cannot both support and contradict a claim",
      });
    }
  });

export type EditorialSourceInput = z.infer<typeof editorialSourceInputSchema>;
export type EditorialClaimInput = z.infer<typeof editorialClaimInputSchema>;

/** Stored source: the submitted fields plus receiver-established facts. */
export type EditorialSource = EditorialSourceInput & {
  excerptHash: string | null;
  verificationAuthority: VerificationAuthority;
};

export type EditorialClaim = EditorialClaimInput & {
  verificationAuthority: VerificationAuthority;
};
