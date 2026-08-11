import type { StepCallArgs } from "./runner";

/**
 * WP26-S3. Helpers shared by the seven step modules.
 *
 * The prompts and queries here are deliberately thin. `S3` owns *execution*
 * semantics — retry, resume, cancel, timeout — while the wording that produces
 * report-grade output is tuned in `S5`'s compiler and measured by `S6`'s eval.
 * Building elaborate prompts here would put the quality contract in a file no
 * quality gate reads.
 */

/** The normalized brief, as stored by step 0 and consumed by every later step. */
export type NormalizedBrief = {
  readonly title: string;
  readonly audience: string;
  readonly model: string;
  readonly seedKeywords: readonly string[];
};

export const BRIEF_DOCUMENT_TITLE = "Normalized brief";

/**
 * Reads the brief a previous step stored.
 *
 * Fails closed rather than substituting a default: a later step running against
 * an empty brief would produce research about nothing and store it as a real
 * finding.
 */
export function requireBrief(args: StepCallArgs): NormalizedBrief {
  const doc = args.priorDocuments.find(
    (candidate) => candidate.title === BRIEF_DOCUMENT_TITLE,
  );
  if (!doc) throw new Error("brief step has not completed");
  const parsed: unknown = JSON.parse(doc.body);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { title?: unknown }).title !== "string"
  ) {
    throw new Error("stored brief is not a normalized brief");
  }
  const brief = parsed as NormalizedBrief;
  if (brief.title.trim().length === 0) {
    throw new Error("stored brief has no title");
  }
  return brief;
}

/** Keeps a provider prompt to the fields the brief actually carries. */
export function briefContext(brief: NormalizedBrief): string {
  return [
    `Idea: ${brief.title}`,
    `Audience: ${brief.audience}`,
    `Business model: ${brief.model}`,
  ].join("\n");
}
