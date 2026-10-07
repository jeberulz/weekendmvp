import { describe, expect, test } from "vitest";
import { HERO_NOTE_MAX_CHARS, HERO_TOOLS, HERO_TOOL_NOTES, heroPromptLines } from "../../lib/home/hero-prompt";

const lines = ["Create a new project.", "", "Schema:", "- users", "- events"];

describe("hero prompt per tool", () => {
  test("every tab has its own lead line", () => {
    expect(HERO_TOOLS).toHaveLength(7);
    expect(Object.keys(HERO_TOOL_NOTES).sort()).toEqual([...HERO_TOOLS].sort());
    // Two tabs sharing a line is the bug WP59 fixes: the prompt did not change per tool.
    expect(new Set(HERO_TOOLS.map((t) => HERO_TOOL_NOTES[t])).size).toBe(HERO_TOOLS.length);
  });

  test("lead lines are short plain sentences", () => {
    for (const tool of HERO_TOOLS) {
      const note = HERO_TOOL_NOTES[tool];
      expect(note.length, tool).toBeGreaterThan(20);
      expect(note.length, tool).toBeLessThanOrEqual(HERO_NOTE_MAX_CHARS);
      expect(note, tool).toBe(note.trim());
      expect(note, tool).toMatch(/\.$/);
      expect(note, tool).not.toContain("\n");
    }
  });

  test("the lead line comes first and the idea's prompt follows unchanged", () => {
    const input = [...lines];
    for (const tool of HERO_TOOLS) {
      const rows = heroPromptLines(tool, input);
      expect(rows[0]).toBe(HERO_TOOL_NOTES[tool]);
      expect(rows.slice(1)).toEqual(lines);
    }
    expect(input).toEqual(lines);
  });

  test("every tab shows the same number of rows, so switching never mounts a row", () => {
    const counts = new Set(HERO_TOOLS.map((t) => heroPromptLines(t, lines).length));
    expect(counts.size).toBe(1);
  });

  test("tools that cannot touch your files or run their own stack say so", () => {
    expect(HERO_TOOL_NOTES.claude).toMatch(/can't see my files/);
    expect(HERO_TOOL_NOTES.lovable).toMatch(/changed from the stack/);
    expect(HERO_TOOL_NOTES.v0).toMatch(/mock data/);
    expect(HERO_TOOL_NOTES.replit).toMatch(/built-in/);
  });
});
