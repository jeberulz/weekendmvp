/**
 * Public (logged-out) idea preview: summary, section teasers, SEO title and
 * ungated build prompts. All copy is stitched from existing MDX/manifest
 * fields — never invented. Deep research stays behind the account gate.
 */
import { extractIdea, section } from "@/lib/home/extract";
import { clamp, leadSentences, plainText } from "@/lib/home/text";
import type { Prompt } from "@/lib/home/types";
import { audienceName } from "@/components/ideas/idea-meta";

function firstParagraph(block: string): string {
  for (const para of block.split(/\n\s*\n/)) {
    const text = para.trim();
    if (!text || text.startsWith("#") || text.startsWith("```")) continue;
    return plainText(text.replace(/\n/g, " "));
  }
  return "";
}

export const IDEA_TITLE_SUFFIX = " | Weekend MVP";
/** Practical SERP title budget including the brand suffix. */
export const IDEA_TITLE_MAX = 60;
export const IDEA_META_MAX = 160;
export const SUMMARY_WORD_MIN = 120;
export const SUMMARY_WORD_MAX = 250;

/** Research H2s shown as teasers on the anonymous page (prompts are separate). */
export const PUBLIC_TEASER_HEADINGS = [
  "The Problem",
  "The Solution",
  "Market Research",
  "Competitive Landscape",
  "Business Model",
  "Recommended Tech Stack",
] as const;

export type PublicSectionTeaser = {
  heading: (typeof PUBLIC_TEASER_HEADINGS)[number];
  teaser: string;
};

export type PublicIdeaPreview = {
  summaryParagraphs: string[];
  summaryWordCount: number;
  /** True when source fields could not reach SUMMARY_WORD_MIN. */
  thinSummary: boolean;
  teasers: PublicSectionTeaser[];
  prompts: Prompt[];
  documentTitle: string;
  metaDescription: string;
};

export type PublicPreviewInput = {
  title: string;
  description: string;
  /** Raw markdown body when a public/checked-in source exists; otherwise "". */
  markdown: string;
  audiences?: string[];
  buildTime?: string;
  tools?: string[];
};

function wordCount(text: string): number {
  return (text.match(/[A-Za-z0-9']+/g) ?? []).length;
}

function firstBulletOrParagraph(block: string): string {
  for (const line of block.split("\n")) {
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      const plain = plainText(bullet[1]);
      if (plain) return plain;
    }
  }
  return firstParagraph(block);
}

/**
 * Query-shaped document title from existing title/description only.
 * Short product stubs prefer the description lead; long titles are clamped
 * so the rendered `<title>` stays near the SERP budget with the brand suffix.
 */
export function ideaDocumentTitle(title: string, description: string): string {
  const budget = IDEA_TITLE_MAX - IDEA_TITLE_SUFFIX.length;
  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  // Under ~28 chars the H1 is usually a brand stub; description is the
  // query-shaped promise already written for the page.
  const head = trimmedTitle.length >= 28 ? trimmedTitle : trimmedDesc || trimmedTitle;
  // Reserve one character for clamp()'s ellipsis so the full title fits.
  return `${clamp(head, Math.max(8, budget - 1))}${IDEA_TITLE_SUFFIX}`;
}

export function ideaMetaDescription(description: string): string {
  // clamp() may append an ellipsis after cutting at `max`; reserve one char.
  return clamp(description.trim(), IDEA_META_MAX - 1);
}

export function sectionTeasers(markdown: string): PublicSectionTeaser[] {
  if (!markdown.trim()) return [];
  const out: PublicSectionTeaser[] = [];
  for (const heading of PUBLIC_TEASER_HEADINGS) {
    const body = section(markdown, heading);
    if (!body) continue;
    const teaser = clamp(firstBulletOrParagraph(body), 180);
    if (!teaser) continue;
    out.push({ heading, teaser });
  }
  return out;
}

/**
 * 120–250 word public summary from existing extract fields. Structural glue
 * ("Built for…", "Suggested stack…") only joins named metadata; prose comes
 * from the MDX/manifest text already on the idea.
 */
export function buildPublicSummary(input: {
  description: string;
  problem: string;
  marketTexts: string[];
  stack: string[];
  audiences: string[];
  buildTime?: string;
  solutionLead?: string;
}): { paragraphs: string[]; wordCount: number; thin: boolean } {
  const paragraphs: string[] = [];
  let words = 0;

  const push = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const w = wordCount(t);
    if (words + w > SUMMARY_WORD_MAX && words >= SUMMARY_WORD_MIN) return;
    paragraphs.push(t);
    words += w;
  };

  if (input.problem) {
    push(leadSentences(input.problem, 4, 900));
  } else if (input.description) {
    push(input.description);
  }

  if (input.audiences.length > 0 && words < SUMMARY_WORD_MAX) {
    push(`Built for ${input.audiences.map(audienceName).join(", ")}.`);
  }

  for (const market of input.marketTexts) {
    if (words >= SUMMARY_WORD_MIN) break;
    push(market);
  }

  if (words < SUMMARY_WORD_MIN && input.solutionLead) {
    push(leadSentences(input.solutionLead, 2, 500));
  }

  if (words < SUMMARY_WORD_MAX) {
    const stackBit =
      input.stack.length > 0
        ? `Suggested stack: ${input.stack.slice(0, 6).join(", ")}.`
        : "";
    const timeBit = input.buildTime
      ? `Weekend scope: about ${input.buildTime} hours.`
      : "";
    const joined = [stackBit, timeBit].filter(Boolean).join(" ");
    if (joined) push(joined);
  }

  if (words < SUMMARY_WORD_MIN && input.description && !paragraphs.includes(input.description)) {
    push(input.description);
  }

  // Soft trim: if we overshot badly, drop trailing paragraphs until ≤ max
  // while keeping at least one.
  while (
    paragraphs.length > 1 &&
    wordCount(paragraphs.join(" ")) > SUMMARY_WORD_MAX
  ) {
    paragraphs.pop();
  }

  const finalWords = wordCount(paragraphs.join(" "));
  return {
    paragraphs,
    wordCount: finalWords,
    thin: finalWords < SUMMARY_WORD_MIN,
  };
}

/** Pure builder — no I/O. Callers supply markdown already cleared for public use. */
export function buildPublicIdeaPreview(input: PublicPreviewInput): PublicIdeaPreview {
  const extract = input.markdown.trim() ? extractIdea(input.markdown) : null;
  const solutionLead = input.markdown
    ? firstParagraph(section(input.markdown, "The Solution"))
    : "";
  const summary = buildPublicSummary({
    description: input.description,
    problem: extract?.problem ?? "",
    marketTexts: (extract?.market ?? []).map((m) => m.text),
    stack: extract?.stack ?? input.tools ?? [],
    audiences: input.audiences ?? [],
    buildTime: input.buildTime,
    solutionLead,
  });

  return {
    summaryParagraphs: summary.paragraphs,
    summaryWordCount: summary.wordCount,
    thinSummary: summary.thin,
    teasers: sectionTeasers(input.markdown),
    prompts: extract?.prompts ?? [],
    documentTitle: ideaDocumentTitle(input.title, input.description),
    metaDescription: ideaMetaDescription(input.description),
  };
}
