/**
 * Editorial DTO v1 size limits. Every string, array and body crossing the
 * editorial boundary is bounded here so an oversized or hostile submission
 * fails validation instead of reaching storage, previews or logs.
 */
export const EDITORIAL_CONTRACT_VERSION = 1 as const;

export const EDITORIAL_LIMITS = {
  idChars: 64,
  slugChars: 80,
  titleChars: 160,
  descriptionChars: 320,
  buyerChars: 200,
  jobChars: 280,
  wedgeChars: 400,
  recommendationReasons: 12,
  recommendationReasonChars: 280,
  /** About 30,000 words: far above any real idea page, far below a dump. */
  markdownChars: 200_000,
  sources: 120,
  claims: 300,
  checks: 200,
  urlChars: 2_048,
  publisherChars: 120,
  sourceTitleChars: 240,
  excerptChars: 1_200,
  contextChars: 2_400,
  verificationReasonChars: 400,
  claimTextChars: 600,
  anchorTextChars: 600,
  sourceRefsPerClaim: 20,
  checkLabelChars: 120,
  checkMessageChars: 600,
  checkLocations: 50,
  policyVersionChars: 64,
  reasonChars: 1_000,
  noteChars: 2_000,
  questionChars: 1_000,
  statementChars: 1_000,
  labelChars: 40,
  labelsPerIdea: 10,
  searchChars: 120,
  pageSizeMax: 100,
  idempotencyKeyChars: 80,
  cursorChars: 400,
  /** An idea's whole working set is loaded per command (WP46-E4c), so revisions are capped. */
  revisionsPerIdea: 40,
  ogSubjectChars: 240,
} as const;

/** Tolerated clock skew for producer-supplied timestamps. */
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
