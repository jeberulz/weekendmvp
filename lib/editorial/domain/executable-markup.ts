import { splitFrontmatter } from "./structure";

/**
 * Markup the public MDX renderer would execute. The receiver uses this to
 * quarantine legacy imports; checks use it to block approval. Pure text
 * analysis: nothing is parsed as MDX or run.
 */

/** Remove inline code spans so their contents are not scanned as markup. */
function stripInlineCode(line: string): string {
  let result = "";
  let index = 0;
  while (index < line.length) {
    if (line[index] !== "`") {
      result += line[index];
      index += 1;
      continue;
    }
    let run = 0;
    while (line[index + run] === "`") run += 1;
    const fence = "`".repeat(run);
    const close = line.indexOf(fence, index + run);
    if (close === -1) {
      result += line.slice(index);
      break;
    }
    result += " ".repeat(close + run - index);
    index = close + run;
  }
  return result;
}

function precededByOddBackslashes(text: string, position: number): boolean {
  let count = 0;
  for (let cursor = position - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) count += 1;
  return count % 2 === 1;
}

/** Visit each line outside fenced code, with its 1-based document line. */
export function forEachProseLine(markdown: string, visit: (line: string, lineNumber: number) => void) {
  const { body, bodyStartLine } = splitFrontmatter(markdown);
  let fence: { char: string; length: number } | null = null;
  body.split("\n").forEach((line, index) => {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      // A closing fence is the same character, at least as long, alone on its line.
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.length &&
        line.trim() === fenceMatch[1]
      ) {
        fence = null;
      }
      return;
    }
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      return;
    }
    visit(line, bodyStartLine + index);
  });
}

/**
 * Find text the public MDX renderer would treat as code: unescaped braces
 * (expressions), tags (`<Component`, `<div`, `<!--`, autolinks) and
 * `import`/`export` lines. `\{` is escaped; `\\{` is an escaped backslash
 * followed by a live brace.
 */
export function findExecutableMarkup(markdown: string): { line: number; reason: string }[] {
  const findings: { line: number; reason: string }[] = [];

  forEachProseLine(markdown, (raw, lineNumber) => {
    if (/^\s{0,3}(?:import|export)\s/.test(raw)) {
      findings.push({ line: lineNumber, reason: "an import/export statement" });
      return;
    }
    const line = stripInlineCode(raw);
    for (let position = 0; position < line.length; position += 1) {
      const char = line[position];
      if ((char === "{" || char === "}") && !precededByOddBackslashes(line, position)) {
        findings.push({ line: lineNumber, reason: `an unescaped “${char}”` });
        return;
      }
      if (char === "<" && !precededByOddBackslashes(line, position) && /[A-Za-z/!?]/.test(line[position + 1] ?? "")) {
        findings.push({ line: lineNumber, reason: "an HTML/JSX tag" });
        return;
      }
    }
  });
  return findings;
}
