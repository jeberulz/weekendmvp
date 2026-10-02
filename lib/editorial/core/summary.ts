import type { IdeaListItem } from "../contracts/views";
import { deriveListItem, evidenceInputsOf, summarizeEvidence, type EvidenceInput } from "./derive";
import type { EditorialState, IdeaRecord } from "./state";

/**
 * What a store keeps per idea so the queue and library can list it without
 * loading revisions. Written after every command that touches the idea.
 * Evidence freshness depends on the current time, so the summary keeps its
 * inputs and the list item's evidence is recomputed when read.
 */
export type IdeaSummary = {
  item: Omit<IdeaListItem, "evidence">;
  evidence: EvidenceInput[];
};

export async function summarizeIdea(state: EditorialState, idea: IdeaRecord): Promise<IdeaSummary> {
  const working = state.revisions.get(idea.workingRevisionId);
  if (!working) throw new Error(`Idea ${idea.id} has no working revision`);
  const { evidence, ...item } = await deriveListItem(state, idea);
  void evidence;
  return { item, evidence: evidenceInputsOf(working) };
}

/**
 * The list item for a stored summary at `nowMs`. A duplicate's title is the
 * other idea's current title when the caller knows it.
 */
export function listItemFromSummary(
  summary: IdeaSummary,
  nowMs: number,
  currentTitles: ReadonlyMap<string, string> = new Map(),
): IdeaListItem {
  const duplicate = summary.item.duplicateOf;
  return {
    ...summary.item,
    duplicateOf: duplicate ? { id: duplicate.id, title: currentTitles.get(duplicate.id) ?? duplicate.title } : null,
    evidence: summarizeEvidence(summary.evidence, nowMs),
  };
}
