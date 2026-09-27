import { splitSections } from "./structure";

export type DiffLine = {
  kind: "same" | "add" | "remove";
  oldNumber: number | null;
  newNumber: number | null;
  text: string;
};

export type DiffResult = {
  lines: DiffLine[];
  added: number;
  removed: number;
  /** True when the edit distance exceeded the cap and a coarse diff was used. */
  truncated: boolean;
};

const DEFAULT_MAX_EDITS = 4_000;

/**
 * Line diff using Myers' O((N+M)·D) algorithm. Beyond `maxEdits` the result
 * degrades to "all removed, all added" rather than spending unbounded time on
 * a pathological pair of documents.
 */
export function diffLines(before: string, after: string, maxEdits = DEFAULT_MAX_EDITS): DiffResult {
  const a = before.replace(/\r\n?/g, "\n").split("\n");
  const b = after.replace(/\r\n?/g, "\n").split("\n");
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxEdits);
  const offset = max + 1;
  const trace: Int32Array[] = [];
  let v: Int32Array = new Int32Array(2 * max + 3);
  let found = -1;

  outer: for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        trace.push(v.slice());
        break outer;
      }
    }
  }

  if (found === -1) {
    const lines: DiffLine[] = [
      ...a.map((text, index) => ({ kind: "remove" as const, oldNumber: index + 1, newNumber: null, text })),
      ...b.map((text, index) => ({ kind: "add" as const, oldNumber: null, newNumber: index + 1, text })),
    ];
    return { lines, added: m, removed: n, truncated: true };
  }

  // Backtrack through the saved frontiers to recover the edit script.
  const reversed: DiffLine[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d -= 1) {
    v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? k + 1 : k - 1;
    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      reversed.push({ kind: "same", oldNumber: x, newNumber: y, text: a[x - 1] });
      x -= 1;
      y -= 1;
    }
    if (x === prevX) {
      reversed.push({ kind: "add", oldNumber: null, newNumber: y, text: b[y - 1] });
      y -= 1;
    } else {
      reversed.push({ kind: "remove", oldNumber: x, newNumber: null, text: a[x - 1] });
      x -= 1;
    }
  }
  while (x > 0 && y > 0) {
    reversed.push({ kind: "same", oldNumber: x, newNumber: y, text: a[x - 1] });
    x -= 1;
    y -= 1;
  }
  const lines = reversed.reverse();
  return {
    lines,
    added: lines.filter((line) => line.kind === "add").length,
    removed: lines.filter((line) => line.kind === "remove").length,
    truncated: false,
  };
}

/** Section titles whose lines changed, in document order. */
export function changedSections(result: DiffResult, before: string, after: string): string[] {
  const sectionAt = (markdown: string) => {
    const blocks = splitSections(markdown).blocks;
    return (line: number) => blocks.find((block) => line >= block.headingLine && line <= block.endLine)?.title ?? "Preamble";
  };
  const oldSection = sectionAt(before);
  const newSection = sectionAt(after);
  const titles: string[] = [];
  for (const line of result.lines) {
    if (line.kind === "same") continue;
    const title = line.kind === "add" ? newSection(line.newNumber ?? 0) : oldSection(line.oldNumber ?? 0);
    if (!titles.includes(title)) titles.push(title);
  }
  return titles;
}

/** Collapse long unchanged runs, keeping `context` lines around each change. */
export function withContext(lines: DiffLine[], context = 3): Array<DiffLine | { kind: "gap"; hidden: number }> {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (line.kind === "same") return;
    for (let offset = -context; offset <= context; offset += 1) {
      const target = index + offset;
      if (target >= 0 && target < lines.length) keep[target] = true;
    }
  });
  const result: Array<DiffLine | { kind: "gap"; hidden: number }> = [];
  let hidden = 0;
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (hidden > 0) result.push({ kind: "gap", hidden });
      hidden = 0;
      result.push(line);
    } else {
      hidden += 1;
    }
  });
  if (hidden > 0) result.push({ kind: "gap", hidden });
  return result;
}
