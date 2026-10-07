/**
 * The hero build window's per-tool prompt (WP59).
 *
 * Every idea ships one set of prompts that names its own stack, so the prompt
 * cannot be rewritten per tool without authoring 7 variants for each idea.
 * What does differ by tool is what the tool can do with it. An agent in your
 * folder creates files and runs them. A chat cannot see your files. A hosted
 * builder runs its own stack. So each tab adds one lead line that tells that
 * tool how to treat the prompt, and the line is part of the copied text.
 *
 * Picking a different prompt per tool was ruled out: only 84 of 225 ideas have
 * a landing-page prompt in third place and the second prompt has 167 titles.
 *
 * Pure and dependency-free, so the client window and the tests share it.
 */

export const HERO_TOOLS = ["cursor", "claudecode", "claude", "lovable", "v0", "replit", "windsurf"] as const;
export type HeroTool = (typeof HERO_TOOLS)[number];

/** Kept short: on a 390px screen the code window shows about eight rows. */
export const HERO_NOTE_MAX_CHARS = 100;

export const HERO_TOOL_NOTES: Record<HeroTool, string> = {
  cursor: "Work in this Cursor project. Plan first, create the files, run the app, fix errors.",
  claudecode: "Work in this folder. Plan first, create the files, run the app, fix errors, then summarize.",
  claude: "You can't see my files. Give each file as its own code block, with its path first.",
  lovable: "Build the full app in this project. Tell me what you changed from the stack below.",
  v0: "Build the screens first. Use mock data for anything that needs a backend.",
  replit: "Build and run this app here. Use built-in storage and auth if you can. Tell me what you chose.",
  windsurf: "Work in this Windsurf project. Plan first, create the files, run the app, fix errors.",
};

/** The rows the window shows and copies for `tool`: its lead line, then the idea's prompt. */
export function heroPromptLines(tool: HeroTool, lines: readonly string[]): string[] {
  return [HERO_TOOL_NOTES[tool], ...lines];
}
