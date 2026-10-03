/**
 * Plain-text pieces of an idea page's markdown, for its metadata and its
 * JSON-LD (deterministic string parsing; no I/O). Moved verbatim from
 * page.tsx so tests can exercise the same extraction the page uses. The
 * text is not escaped for HTML here: components/primitives/JsonLd escapes
 * it at the sink.
 */

export function stripMd(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

/** First body paragraph of the markdown — metadata stub when Convex is down. */
export function excerpt(markdown: string, max = 160): string {
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (
      !line ||
      line.startsWith("#") ||
      line.startsWith("```") ||
      line.startsWith("---")
    ) {
      continue;
    }
    const plain = stripMd(line);
    if (plain.length <= max) return plain;
    return `${plain.slice(0, max - 1).trimEnd()}…`;
  }
  return "";
}

/** Raw markdown of one `## {heading}` section. */
export function sectionBody(markdown: string, heading: string): string {
  const re = new RegExp(
    `^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "mi",
  );
  const match = re.exec(markdown);
  if (!match) return "";
  const rest = markdown.slice(match.index + match[0].length);
  const next = rest.search(/^##\s+/m);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

export function firstParagraph(block: string): string {
  for (const para of block.split(/\n\s*\n/)) {
    const text = para.trim();
    if (!text || text.startsWith("#") || text.startsWith("```")) continue;
    return stripMd(text.replace(/\n/g, " "));
  }
  return "";
}

/**
 * The 3 numbered items under "**How it works:**" in The Solution —
 * the source of the legacy HowTo schema's step texts.
 */
export function howItWorksSteps(markdown: string): string[] {
  const steps: string[] = [];
  const start = markdown.search(/\*\*How it works:?\*\*/i);
  if (start === -1) return steps;
  for (const line of markdown.slice(start).split("\n")) {
    const match = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (match) steps.push(stripMd(match[1]));
    if (steps.length >= 3) break;
  }
  return steps;
}
