/**
 * WP41-S3. Content-addressed JSON cache for the eval layers.
 *
 * Keys hash everything that can change an answer: page or source text,
 * prompt version, and model. An unchanged page therefore re-runs for $0,
 * and a prompt or model change invalidates exactly what it should.
 *
 * Lives under evals/cache/ (gitignored). Source entries hold extracted
 * text only, never raw HTML, and are never committed (citation-only
 * ruling, docs/wp/RULINGS.md 2026-08-06).
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type JsonCache = {
  get<T>(namespace: string, key: string): T | undefined;
  set(namespace: string, key: string, value: unknown): void;
};

export function hashKey(...parts: string[]): string {
  const h = createHash("sha256");
  for (const part of parts) {
    h.update(String(part.length));
    h.update(":");
    h.update(part);
  }
  return h.digest("hex");
}

type Entry = { storedAt: number; value: unknown };

export function createDiskCache(
  rootDir: string,
  options: { ttlMs: number; now?: () => number },
): JsonCache {
  const now = options.now ?? Date.now;
  const file = (ns: string, key: string) => path.join(rootDir, ns, `${key}.json`);

  return {
    get<T>(ns: string, key: string): T | undefined {
      let entry: Entry;
      try {
        entry = JSON.parse(fs.readFileSync(file(ns, key), "utf8")) as Entry;
      } catch {
        return undefined; // missing or corrupt: treat as a miss
      }
      if (now() - entry.storedAt > options.ttlMs) return undefined;
      return entry.value as T;
    },
    set(ns, key, value) {
      const target = file(ns, key);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ storedAt: now(), value } satisfies Entry));
      fs.renameSync(tmp, target);
    },
  };
}

export function createMemoryCache(): JsonCache {
  const store = new Map<string, unknown>();
  return {
    get: <T>(ns: string, key: string) => store.get(`${ns}/${key}`) as T | undefined,
    set: (ns, key, value) => void store.set(`${ns}/${key}`, value),
  };
}
