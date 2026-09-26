import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { extractIdea } from "@/lib/home/extract";
import type { IdeaExtract, Prompt, Tier } from "@/lib/home/types";
import { readCanonicalIdeaBody } from "@/lib/canonical-idea-body";

/**
 * WP44-S9 and S11. Parts of an idea's MDX the dashboard needs: its build
 * prompts (weekend plans), the brief for a prompt pack, and its pricing tiers
 * (compare). Cached with the rest of the idea content.
 */
async function extractOf(slug: string): Promise<IdeaExtract | null> {
  "use cache";
  cacheTag("ideas");
  cacheLife("hours");
  const body = await readCanonicalIdeaBody(slug);
  return body ? extractIdea(body.content) : null;
}

export async function getIdeaPrompts(slug: string): Promise<Prompt[] | null> {
  return (await extractOf(slug))?.prompts ?? null;
}

export async function getIdeaPackContent(slug: string) {
  const extract = await extractOf(slug);
  if (!extract) return null;
  return {
    problem: extract?.problem ?? "",
    how: extract?.how ?? [],
    stack: extract?.stack ?? [],
    prompts: extract?.prompts ?? [],
  };
}

export async function getIdeaTiers(slug: string): Promise<Tier[]> {
  // Compare is optional enrichment: unknown slugs must still render while
  // the fallback backend is unavailable. Prompt/export callers stay strict.
  try {
    return (await extractOf(slug))?.tiers ?? [];
  } catch {
    return [];
  }
}
