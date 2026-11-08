/**
 * Pain Engine — on-disk JSON cache for fetched pages/results.
 *
 * Purpose: a retry must not re-fetch (or re-pay for) what a previous attempt
 * already got. Cache entries live under `engine/pain/cache/` and are
 * git-ignored; they are keyed by a hash of the request, never by user data.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface CacheEntry {
  key: string;
  url: string;
  fetchedAt: number;
  ttlSeconds: number;
  body: string;
}

export function cacheKeyFor(url: string, body?: string): string {
  return createHash("sha256")
    .update(url + "\n" + (body ?? ""))
    .digest("hex")
    .slice(0, 32);
}

export function cachePath(cacheDir: string, key: string): string {
  return path.join(cacheDir, `${key}.json`);
}

export function readCache(cacheDir: string, key: string): CacheEntry | null {
  try {
    const raw = fs.readFileSync(cachePath(cacheDir, key), "utf8");
    const entry = JSON.parse(raw) as CacheEntry;
    const ageSeconds = (Date.now() - entry.fetchedAt) / 1000;
    if (ageSeconds > entry.ttlSeconds) return null;
    return entry;
  } catch {
    return null;
  }
}

export function writeCache(
  cacheDir: string,
  key: string,
  url: string,
  ttlSeconds: number,
  body: string,
): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  const entry: CacheEntry = {
    key,
    url,
    fetchedAt: Date.now(),
    ttlSeconds,
    body,
  };
  fs.writeFileSync(cachePath(cacheDir, key), JSON.stringify(entry, null, 2));
}
