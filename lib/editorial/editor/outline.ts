import { SECTION_DEFINITIONS, type SectionKey } from "../contracts/sections";
import type { ClaimView, ReviewStatus, SectionView } from "../contracts/views";
import { splitSections } from "../domain/structure";
import type { ClaimMarker } from "../markdown/render";

/**
 * Pure helpers for the Markdown editor: the eight-section outline, caret and
 * line arithmetic for section navigation, and claim markers for the preview.
 */

export type OutlineEntry = {
  key: SectionKey;
  title: string;
  /** 1-based heading line in the editor text; null when the heading is missing. */
  line: number | null;
  /** Review status the server derived for the last saved content. */
  status: ReviewStatus;
  issueCount: number;
};

/** Headings come from the live editor text; review status from the saved revision. */
export function buildOutline(markdown: string, saved: readonly SectionView[]): OutlineEntry[] {
  const blocks = splitSections(markdown).blocks;
  return SECTION_DEFINITIONS.map((definition) => {
    const block = blocks.find((candidate) => candidate.key === definition.key) ?? null;
    const view = saved.find((section) => section.key === definition.key) ?? null;
    return {
      key: definition.key,
      title: definition.title,
      line: block ? block.headingLine : null,
      status: view?.review.status ?? "unreviewed",
      issueCount: view?.issueCount ?? 0,
    };
  });
}

/** Character offset at which each 1-based line starts. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

export function offsetOfLine(text: string, line: number): number {
  const starts = lineStarts(text);
  const clamped = Math.min(Math.max(Math.trunc(line), 1), starts.length);
  return starts[clamped - 1];
}

export function lineAtOffset(text: string, offset: number): number {
  let line = 1;
  const end = Math.min(Math.max(offset, 0), text.length);
  for (let index = 0; index < end; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

/**
 * Offset of the next (1) or previous (-1) `##` heading relative to the caret,
 * or null at either end. Headings inside fenced code are not sections.
 */
export function adjacentHeadingOffset(text: string, caret: number, direction: 1 | -1): number | null {
  const current = lineAtOffset(text, caret);
  const headings = splitSections(text).blocks.map((block) => block.headingLine);
  const target =
    direction === 1
      ? headings.find((line) => line > current)
      : [...headings].reverse().find((line) => line < current);
  return target === undefined ? null : offsetOfLine(text, target);
}

export function truncateText(text: string, max: number): string {
  const points = Array.from(text.replace(/\s+/g, " ").trim());
  return points.length <= max ? points.join("") : `${points.slice(0, max - 1).join("").trimEnd()}…`;
}

/** Claims whose exact wording can be highlighted in the preview. */
export function claimMarkers(claims: readonly ClaimView[]): ClaimMarker[] {
  return claims
    .filter((claim) => claim.anchorText.trim().length > 0)
    .map((claim) => ({ id: claim.id, anchorText: claim.anchorText, label: truncateText(claim.text, 90) }));
}
