/** WP44-S11. The prompt pack formats, apart from the builder so the client can list them cheaply. */
export const PACK_FORMATS = [
  { id: "all", label: "All tools (.zip)" },
  { id: "claude", label: "Claude Code (CLAUDE.md)" },
  { id: "cursor", label: "Cursor (rules file)" },
  { id: "windsurf", label: "Windsurf (rules file)" },
  { id: "lovable", label: "Lovable brief" },
  { id: "bolt", label: "Bolt brief" },
  { id: "v0", label: "v0 brief" },
  { id: "replit", label: "Replit brief" },
] as const;

export type PackFormat = (typeof PACK_FORMATS)[number]["id"];

export function isPackFormat(value: unknown): value is PackFormat {
  return typeof value === "string" && PACK_FORMATS.some((format) => format.id === value);
}
