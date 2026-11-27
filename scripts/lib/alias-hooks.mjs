/**
 * Module hooks that let plain Node resolve the `@/` alias used across the repo (WP103-S3).
 * Registered by `scripts/audit-guide.mjs` so the audit can load `lib/live/config.ts` and check
 * prices and offer status against the real config.
 *
 *   import { register } from "node:module";
 *   register(pathToFileURL("scripts/lib/alias-hooks.mjs"), { data: { root } });
 *
 * Only `@/...` specifiers are touched. Everything else goes to Node's default resolver.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

let root = process.cwd();

export function initialize(data) {
  if (data?.root) root = data.root;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
