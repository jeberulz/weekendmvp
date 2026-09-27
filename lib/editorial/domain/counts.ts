import { SECTION_DEFINITIONS } from "../contracts/sections";
import type { ContentCounts } from "../contracts/views";
import { parseArticleMarkdown, walk } from "../markdown/parse";
import { sectionsByKey, splitSections } from "./structure";

/** Stated rate for the reading-time estimate. Length is not a quality score. */
export const READING_WORDS_PER_MINUTE = 238;

const WORD = /[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/**
 * Measured counts for the title bar and inspector. Prose words come from
 * Markdown text nodes only: frontmatter, fenced code, inline code and raw
 * markup are excluded. Prompts are fenced blocks inside the prompts section.
 */
export function measureContent(markdown: string): ContentCounts {
  const { tree, bodyStartLine } = parseArticleMarkdown(markdown);
  const sections = sectionsByKey(splitSections(markdown));
  const prompts = sections.get("prompts") ?? null;

  let proseWords = 0;
  let codeBlocks = 0;
  let promptBlocks = 0;

  walk(tree, (node) => {
    if (node.type === "code") {
      codeBlocks += 1;
      const line = node.position ? bodyStartLine + node.position.start.line - 1 : null;
      if (prompts && line !== null && line > prompts.headingLine && line <= prompts.endLine) {
        promptBlocks += 1;
      }
      return;
    }
    if (node.type === "text") proseWords += countWords(node.value);
  });

  return {
    proseWords,
    readingMinutes: proseWords === 0 ? 0 : Math.max(1, Math.round(proseWords / READING_WORDS_PER_MINUTE)),
    sectionsPresent: SECTION_DEFINITIONS.filter((section) => sections.has(section.key)).length,
    sectionsExpected: SECTION_DEFINITIONS.length,
    prompts: promptBlocks,
    codeBlocks,
  };
}

export function sectionWordCount(body: string): number {
  const { tree } = parseArticleMarkdown(body);
  let words = 0;
  walk(tree, (node) => {
    if (node.type === "text") words += countWords(node.value);
  });
  return words;
}
