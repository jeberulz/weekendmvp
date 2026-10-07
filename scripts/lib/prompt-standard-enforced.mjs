import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * The ratchet (WP61): slugs whose prompts already meet the weekend prompt
 * standard and must keep meeting it. Everything else is reported, not blocked,
 * until the backfill reaches it. A missing file means nothing is enforced.
 */
export function readEnforcedSlugs(root = process.cwd()) {
  const file = path.join(root, "ideas/prompt-standard.json");
  if (!existsSync(file)) return new Set();
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return new Set(Array.isArray(parsed.enforced) ? parsed.enforced : []);
}
