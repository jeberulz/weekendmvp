/** Publication status comes from the canonical manifest, never a second list.
 * Existing saves/plans stay readable; retirement only removes discovery and
 * new plan entry points. No database backfill or content deletion is needed. */
import manifest from "../../ideas/manifest.json";
const retired = new Set(
  manifest.ideas.filter((idea) => "_retiredAt" in idea && idea._retiredAt).map((idea) => idea.slug),
);
export function isRetiredIdea(slug: string): boolean {
  return retired.has(slug);
}
