/**
 * Playbook registry.
 *
 * Adding a playbook = adding a config here. The route, metadata, JSON-LD,
 * static params and sitemap entries all read from this map, so there is no
 * second place to remember.
 *
 * `PLAYBOOK_SLUGS` is consumed by `app/sitemap.ts` — the same exported-slugs
 * convention used by `AUDIENCE_SLUGS`, `PROBLEM_SLUGS` and `COLLECTION_SLUGS`.
 */

import type { Playbook } from "@/components/playbooks/types";
import { decisionStack } from "./decision-stack";

export const PLAYBOOKS: Record<string, Playbook> = {
  [decisionStack.slug]: decisionStack,
};

export const PLAYBOOK_SLUGS = Object.keys(PLAYBOOKS);

export function getPlaybook(slug: string): Playbook | undefined {
  return PLAYBOOKS[slug];
}
