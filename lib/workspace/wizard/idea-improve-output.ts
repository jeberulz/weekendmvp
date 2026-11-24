/**
 * WP100. The output shape of `wizard-idea-improve` (`convex/ai/prompts/ideaImprove.v1.ts`).
 *
 * Kept apart from `idea-improve.ts` on purpose: the prompt version lock hashes
 * every repo-local module a prompt imports, so this file imports only zod and
 * the hints shape. A change to the wizard contract does not force a prompt
 * version bump; a change here does, as it should.
 *
 * `text` is the whole improved sentence in whole mode, and only the
 * replacement for the selected words in selection mode. `hints` describe the
 * whole idea after the change.
 */

import { z } from "zod";

import { ownIdeaHintsSchema } from "./idea-hints.ts";

/** Equals `WIZARD_LIMITS.ownIdea` (checked in `tests/platform/wp100-idea-improve.test.ts`). */
export const IDEA_TEXT_MAX = 240;
export const IDEA_IMPROVE_NOTE_MAX = 90;

export const IDEA_IMPROVE_STATUSES = ["improved", "already_clear", "not_an_idea"] as const;

export const ideaImproveOutputSchema = z
  .object({
    status: z.enum(IDEA_IMPROVE_STATUSES),
    text: z.string().max(IDEA_TEXT_MAX),
    changeNote: z.string().max(IDEA_IMPROVE_NOTE_MAX),
    hints: ownIdeaHintsSchema,
  })
  .strict();

export type IdeaImproveOutput = z.infer<typeof ideaImproveOutputSchema>;
