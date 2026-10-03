import { isResearchWithheld } from "@/components/platform/RetiredResearch";

/**
 * Whether a Builder's Hub row on Saved gets a compare checkbox: only while
 * compare mode is on, and never for a retired engine draft (WP54-S5), whose
 * research is withheld, so there is nothing to compare.
 */
export function isComparable(slug: string, comparing: boolean): boolean {
  return comparing && !isResearchWithheld(slug);
}
