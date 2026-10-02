import { sectionKeyForTitle, type SectionKey } from "../contracts/sections";

export type FrontmatterSplit = {
  frontmatter: string | null;
  body: string;
  /** 1-based line in the full document where `body` starts. */
  bodyStartLine: number;
};

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** Split a leading `---` YAML block from the body. It is metadata, not prose. */
export function splitFrontmatter(markdown: string): FrontmatterSplit {
  const text = normalizeNewlines(markdown);
  if (!text.startsWith("---\n")) return { frontmatter: null, body: text, bodyStartLine: 1 };
  const lines = text.split("\n");
  for (let index = 1; index < Math.min(lines.length, 200); index += 1) {
    if (lines[index] === "---" || lines[index] === "...") {
      return {
        frontmatter: lines.slice(1, index).join("\n"),
        body: lines.slice(index + 1).join("\n"),
        bodyStartLine: index + 2,
      };
    }
  }
  return { frontmatter: null, body: text, bodyStartLine: 1 };
}

export type SectionBlock = {
  title: string;
  key: SectionKey | null;
  /** 1-based line of the `##` heading in the full document. */
  headingLine: number;
  /** 1-based last line of the section (inclusive). */
  endLine: number;
  body: string;
};

export type SectionSplit = {
  preamble: string;
  blocks: SectionBlock[];
};

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const H2 = /^ {0,3}##(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;

/**
 * Split an article into `##` sections. Headings inside fenced code are text,
 * so a prompt that contains `## Example` never creates a phantom section.
 */
export function splitSections(markdown: string): SectionSplit {
  const { body, bodyStartLine } = splitFrontmatter(markdown);
  const lines = body.split("\n");
  const blocks: SectionBlock[] = [];
  const preamble: string[] = [];
  let current: { title: string; headingLine: number; lines: string[] } | null = null;
  let fence: { char: string; length: number } | null = null;

  const finish = (endLine: number) => {
    if (!current) return;
    blocks.push({
      title: current.title,
      key: sectionKeyForTitle(current.title),
      headingLine: current.headingLine,
      endLine,
      body: current.lines.join("\n").replace(/\s+$/, ""),
    });
  };

  lines.forEach((line, index) => {
    const lineNumber = bodyStartLine + index;
    const fenceMatch = FENCE_OPEN.exec(line);
    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.length &&
        line.trim() === fenceMatch[1]
      ) {
        fence = null;
      }
    } else if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
    } else {
      const heading = H2.exec(line);
      if (heading && !line.trimStart().startsWith("###")) {
        finish(lineNumber - 1);
        current = { title: (heading[1] ?? "").trim(), headingLine: lineNumber, lines: [] };
        return;
      }
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  });
  finish(bodyStartLine + lines.length - 1);

  return { preamble: preamble.join("\n"), blocks };
}

/** First block for each known section key, in document order. */
export function sectionsByKey(split: SectionSplit): Map<SectionKey, SectionBlock> {
  const map = new Map<SectionKey, SectionBlock>();
  for (const block of split.blocks) {
    if (block.key && !map.has(block.key)) map.set(block.key, block);
  }
  return map;
}

/** Whitespace-insensitive containment, used to find claim wording in a section. */
export function containsNormalized(haystack: string, needle: string): boolean {
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  const target = normalize(needle);
  return target.length > 0 && normalize(haystack).includes(target);
}
