import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { extractIdea } from "@/lib/home/extract";
import type { IdeaExtract, Prompt, Tier } from "@/lib/home/types";
import { readMdxFile } from "@/lib/mdx";

/**
 * WP44-S9 and S11. Parts of an idea's MDX the dashboard needs: its build
 * prompts (weekend plans), the brief for a prompt pack, and its pricing tiers
 * (compare). Cached with the rest of the idea content.
 */
async function extractOf(slug: string): Promise<IdeaExtract | null> {
  "use cache";
  cacheTag("ideas");
  cacheLife("hours");
  const file = await readMdxFile("content/ideas", slug);
  return file ? extractIdea(file.content) : null;
}

export async function getIdeaPrompts(slug: string): Promise<Prompt[]> {
  return (await extractOf(slug))?.prompts ?? [];
}

export async function getIdeaPackContent(slug: string) {
  const extract = await extractOf(slug);
  return {
    problem: extract?.problem ?? "",
    how: extract?.how ?? [],
    stack: extract?.stack ?? [],
    prompts: extract?.prompts ?? [],
  };
}

export async function getIdeaTiers(slug: string): Promise<Tier[]> {
  return (await extractOf(slug))?.tiers ?? [];
}
