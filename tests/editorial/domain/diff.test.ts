import { describe, expect, test } from "vitest";

import { changedSections, diffLines, withContext } from "@/lib/editorial/domain/diff";

function apply(before: string, result: ReturnType<typeof diffLines>) {
  const reconstructedOld = result.lines.filter((line) => line.kind !== "add").map((line) => line.text).join("\n");
  const reconstructedNew = result.lines.filter((line) => line.kind !== "remove").map((line) => line.text).join("\n");
  return { reconstructedOld, reconstructedNew };
}

describe("line diff", () => {
  test("identical documents have no changes", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result.added + result.removed).toBe(0);
    expect(result.lines.every((line) => line.kind === "same")).toBe(true);
  });

  test("the edit script reconstructs both sides exactly, with correct line numbers", () => {
    const before = "one\ntwo\nthree\nfour\nfive";
    const after = "one\nTWO\nthree\nfive\nsix";
    const result = diffLines(before, after);
    const { reconstructedOld, reconstructedNew } = apply(before, result);
    expect(reconstructedOld).toBe(before);
    expect(reconstructedNew).toBe(after);
    expect(result.added).toBe(2);
    expect(result.removed).toBe(2);
    expect(result.lines.find((line) => line.text === "TWO")).toMatchObject({ kind: "add", newNumber: 2 });
    expect(result.lines.find((line) => line.text === "four")).toMatchObject({ kind: "remove", oldNumber: 4 });
  });

  test("randomised edits always reconstruct", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let round = 0; round < 40; round += 1) {
      const before = Array.from({ length: 30 }, (_, i) => `line ${Math.floor(random() * 8)} ${i % 5}`);
      const after = before.filter(() => random() > 0.2).map((line) => (random() > 0.85 ? `${line} edited` : line));
      if (random() > 0.5) after.splice(Math.floor(random() * after.length), 0, "inserted");
      const result = diffLines(before.join("\n"), after.join("\n"));
      const { reconstructedOld, reconstructedNew } = apply(before.join("\n"), result);
      expect(reconstructedOld).toBe(before.join("\n"));
      expect(reconstructedNew).toBe(after.join("\n"));
    }
  });

  test("beyond the edit cap the diff degrades safely instead of running unbounded", () => {
    const before = Array.from({ length: 50 }, (_, i) => `a${i}`).join("\n");
    const after = Array.from({ length: 50 }, (_, i) => `b${i}`).join("\n");
    const result = diffLines(before, after, 10);
    expect(result.truncated).toBe(true);
    expect(result.added).toBe(50);
    expect(result.removed).toBe(50);
  });

  test("changed sections are named, and long unchanged runs collapse", () => {
    const before = "## The Problem\nsame\nsame\nsame\nsame\nsame\nsame\nsame\nsame\n## Market Research\nold figure";
    const after = "## The Problem\nsame\nsame\nsame\nsame\nsame\nsame\nsame\nsame\n## Market Research\nnew figure";
    const result = diffLines(before, after);
    expect(changedSections(result, before, after)).toEqual(["Market Research"]);
    const collapsed = withContext(result.lines, 2);
    // The heading and seven of the eight unchanged lines fall outside the two-line context.
    expect(collapsed[0]).toEqual({ kind: "gap", hidden: 8 });
  });
});
