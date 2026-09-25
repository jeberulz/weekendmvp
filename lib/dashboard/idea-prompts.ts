import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { extractIdea } from "@/lib/home/extract";
import type { Prompt } from "@/lib/home/types";
import { readMdxFile } from "@/lib/mdx";

/**
 * WP44-S9. An idea's build prompts, from the "AI Prompts to Build This"
 * section of its MDX. Cached with the rest of the idea content.
 */
export async function getIdeaPrompts(slug: string): Promise<Prompt[]> {
  "use cache";
  cacheTag("ideas");
  cacheLife("hours");
  const file = await readMdxFile("content/ideas", slug);
  return file ? extractIdea(file.content).prompts : [];
}
