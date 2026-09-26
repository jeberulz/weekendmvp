import type { PackFormat } from "./formats";
import { zipStore } from "./zip";

export { PACK_FORMATS, isPackFormat, type PackFormat } from "./formats";

/**
 * WP44-S11 prompt pack (PRD 6.5): the idea's research and prompts as the
 * files each AI tool reads. Deterministic: no AI call, no clock, no random
 * values, so the same idea always gives the same files.
 */

export type PackInput = {
  slug: string;
  title: string;
  description: string;
  problem: string;
  how: readonly string[];
  stack: readonly string[];
  prompts: readonly { title: string; lines: readonly string[] }[];
  siteUrl: string;
};

export type PackFile = { name: string; text: string };

const BRIEF_TOOLS = { lovable: "Lovable", bolt: "Bolt", v0: "v0", replit: "Replit" } as const;

function fence(lines: readonly string[]): string {
  // A prompt that itself holds ``` gets a longer fence, so it never breaks out.
  const longest = Math.max(2, ...lines.map((line) => (line.match(/`+/g) ?? []).reduce((n, run) => Math.max(n, run.length), 0)));
  const bar = "`".repeat(longest + 1);
  return `${bar}text\n${lines.join("\n")}\n${bar}`;
}

function sourceLine(input: PackInput): string {
  return `From the Weekend MVP research on ${input.title}: ${input.siteUrl}/ideas/${input.slug}`;
}

/** The shared project brief: what, why, how, stack, scope, then the prompts in order. */
function projectBrief(input: PackInput, heading: string): string {
  const parts = [`# ${heading}`, "", input.description];
  if (input.problem) parts.push("", "## The problem", "", input.problem);
  if (input.how.length > 0) parts.push("", "## How it works", "", ...input.how.map((step, i) => `${i + 1}. ${step}`));
  if (input.stack.length > 0) parts.push("", "## Stack", "", ...input.stack.map((item) => `- ${item}`));
  parts.push(
    "",
    "## Scope for this weekend",
    "",
    "- Build the one core feature first. Leave everything else for later.",
    "- Add a landing page and a waitlist on Sunday.",
    "- Keep it small enough to put live by Sunday night.",
  );
  if (input.prompts.length > 0) {
    parts.push("", "## Build steps", "", "Work through these in order.");
    input.prompts.forEach((prompt, i) => parts.push("", `### ${i + 1}. ${prompt.title}`, "", fence(prompt.lines)));
  }
  parts.push("", "---", "", sourceLine(input), "");
  return parts.join("\n");
}

function claudeFile(input: PackInput): PackFile {
  return { name: "CLAUDE.md", text: projectBrief(input, input.title) };
}

function cursorFile(input: PackInput, name: string): PackFile {
  const front = ["---", `description: ${input.title}, project brief and build steps`, "alwaysApply: true", "---", ""];
  return { name, text: front.join("\n") + projectBrief(input, input.title) };
}

function windsurfFile(input: PackInput, name: string): PackFile {
  return { name, text: projectBrief(input, input.title) };
}

function briefFile(input: PackInput, tool: keyof typeof BRIEF_TOOLS, name: string): PackFile {
  return { name, text: projectBrief(input, `Build brief for ${BRIEF_TOOLS[tool]}: ${input.title}`) };
}

function readme(input: PackInput): PackFile {
  const text = [
    `# Prompt pack: ${input.title}`,
    "",
    "Each file holds the same brief and build steps, in the shape each tool reads.",
    "",
    "- `CLAUDE.md`: put it in your project root for Claude Code.",
    `- \`.cursor/rules/${input.slug}.mdc\`: Cursor loads it for every chat in the project.`,
    `- \`.windsurf/rules/${input.slug}.md\`: Windsurf loads it for the project.`,
    "- `briefs/`: paste one into Lovable, Bolt, v0 or Replit to start.",
    "",
    sourceLine(input),
    "",
  ].join("\n");
  return { name: "README.md", text };
}

/** Every file in the pack, in a fixed order. */
export function packFiles(input: PackInput): PackFile[] {
  return [
    readme(input),
    claudeFile(input),
    cursorFile(input, `.cursor/rules/${input.slug}.mdc`),
    windsurfFile(input, `.windsurf/rules/${input.slug}.md`),
    ...(Object.keys(BRIEF_TOOLS) as (keyof typeof BRIEF_TOOLS)[]).map((tool) =>
      briefFile(input, tool, `briefs/${tool}.md`),
    ),
  ];
}

export type PackDownload = { filename: string; contentType: string; body: Uint8Array<ArrayBuffer> };

/** One download: a single file for one tool, or the whole pack as a zip. */
export function buildPromptPack(input: PackInput, format: PackFormat): PackDownload {
  const encoder = new TextEncoder();
  const markdown = (filename: string, file: PackFile): PackDownload => ({
    filename,
    contentType: "text/markdown; charset=utf-8",
    body: encoder.encode(file.text),
  });
  switch (format) {
    case "all":
      return {
        filename: `${input.slug}-prompt-pack.zip`,
        contentType: "application/zip",
        body: zipStore(packFiles(input).map((file) => ({ name: file.name, data: encoder.encode(file.text) }))),
      };
    case "claude":
      return markdown("CLAUDE.md", claudeFile(input));
    case "cursor":
      return markdown(`${input.slug}.mdc`, cursorFile(input, `${input.slug}.mdc`));
    case "windsurf":
      return markdown(`${input.slug}-windsurf-rules.md`, windsurfFile(input, `${input.slug}.md`));
    default:
      return markdown(`${input.slug}-${format}-brief.md`, briefFile(input, format, `${format}.md`));
  }
}
