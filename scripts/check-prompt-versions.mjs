#!/usr/bin/env node
/**
 * WP71-S3. Prompt-version check (`02` §5.3): fail when a prompt's text or
 * schema changes without a version bump.
 *
 *   node --experimental-strip-types scripts/check-prompt-versions.mjs           # check (CI)
 *   node --experimental-strip-types scripts/check-prompt-versions.mjs --write   # lock new versions
 *   ... --lock <path>                                                           # another lock file
 *
 * It loads the real registry (`convex/ai/registry.ts`, whose imports carry
 * `.ts` extensions for this) and hashes each spec's content with SHA-256 over
 * the registry's canonical JSON (sorted keys): system text, task template
 * (`buildUser` source and its sample output), output JSON Schema and run
 * settings. Each part is also hashed, so a failure names what changed.
 *
 * Check mode fails (exit 1) when:
 * - a locked `id@version` has different content (changed without a bump);
 * - a registered `id@version` is not in the lock (run `--write`);
 * - a new version is not above every locked version of that id;
 * - a locked `id@version` is gone from the registry and its lock entry has no
 *   `retired` note;
 * - a ref whose lock entry is `retired` is registered again.
 *
 * `--write` adds lock entries for new versions only. It never rewrites an
 * existing hash and writes nothing while any other problem stands. Retirement
 * notes are added by hand: `"retired": "<why, which WP>"`.
 *
 * No network, no env.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  listEntries,
  promptContent,
  promptContentPartKey,
  PROMPT_CONTENT_PARTS,
  canonicalJson,
} from "../convex/ai/registry.ts";

const root = fileURLToPath(new URL("../", import.meta.url));

export const DEFAULT_LOCK_PATH = path.join(root, "convex/ai/prompts/versions.lock.json");
export const LOCK_FORMAT = 1;
const REF_PATTERN = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)@([1-9][0-9]*)$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

function sha256(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function parseRef(ref) {
  const match = REF_PATTERN.exec(ref);
  return match ? { id: match[1], version: Number(match[2]) } : null;
}

/** `{ hash, parts }` for one registry entry. */
export function hashEntry(entry) {
  const content = promptContent(entry);
  const parts = {};
  for (const part of PROMPT_CONTENT_PARTS) parts[part] = sha256(promptContentPartKey(content, part));
  return { hash: sha256(canonicalJson(content)), parts };
}

/** ref → `{ hash, parts }` for every entry. */
export function currentHashes(entries = listEntries()) {
  const out = {};
  for (const entry of entries) {
    const ref = `${entry.spec.id}@${entry.spec.version}`;
    if (Object.hasOwn(out, ref)) throw new Error(`duplicate ref ${ref}`);
    out[ref] = hashEntry(entry);
  }
  return out;
}

export function emptyLock() {
  return { format: LOCK_FORMAT, algorithm: "sha256", prompts: {} };
}

/** Parses and validates the lock file's shape. Throws with a clear message. */
export function parseLock(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`lock file is not valid JSON: ${error.message}`);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("lock file must be an object");
  if (data.format !== LOCK_FORMAT) throw new Error(`lock file format must be ${LOCK_FORMAT}`);
  if (data.algorithm !== "sha256") throw new Error('lock file algorithm must be "sha256"');
  if (typeof data.prompts !== "object" || data.prompts === null || Array.isArray(data.prompts)) {
    throw new Error("lock file prompts must be an object");
  }
  for (const [ref, entry] of Object.entries(data.prompts)) {
    if (!parseRef(ref)) throw new Error(`lock file key ${JSON.stringify(ref)} is not an id@version ref`);
    if (typeof entry !== "object" || entry === null || !HASH_PATTERN.test(entry.hash ?? "")) {
      throw new Error(`lock entry ${ref} needs a sha256 hash`);
    }
    if (entry.retired !== undefined && (typeof entry.retired !== "string" || entry.retired.trim().length === 0)) {
      throw new Error(`lock entry ${ref}: retired must be a non-empty note`);
    }
  }
  return data;
}

function changedParts(locked, now) {
  if (typeof locked.parts !== "object" || locked.parts === null) return [];
  return PROMPT_CONTENT_PARTS.filter((part) => locked.parts[part] !== now.parts[part]);
}

/**
 * Compares current hashes with the lock. Returns `problems` (each with `kind`,
 * `ref`, `message`) and `additions` (refs `--write` may add).
 */
export function checkPromptVersions(current, lock) {
  const problems = [];
  const additions = {};
  const locked = lock.prompts;

  const highestLocked = new Map();
  for (const ref of Object.keys(locked)) {
    const { id, version } = parseRef(ref);
    highestLocked.set(id, Math.max(highestLocked.get(id) ?? 0, version));
  }

  for (const ref of Object.keys(current).sort()) {
    const now = current[ref];
    const entry = locked[ref];
    if (entry === undefined) {
      const { id, version } = parseRef(ref);
      const highest = highestLocked.get(id) ?? 0;
      if (version <= highest) {
        problems.push({
          kind: "version_not_increasing",
          ref,
          message: `${ref} is new, but ${id}@${highest} is already locked. A new version must be above ${highest}.`,
        });
        continue;
      }
      problems.push({
        kind: "unlocked",
        ref,
        message: `${ref} is not in the lock. Run: node --experimental-strip-types scripts/check-prompt-versions.mjs --write`,
      });
      additions[ref] = now;
      continue;
    }
    if (entry.retired !== undefined) {
      problems.push({
        kind: "retired_ref_reused",
        ref,
        message: `${ref} was retired (${entry.retired}) and cannot be registered again. Use a new version.`,
      });
      continue;
    }
    if (entry.hash !== now.hash) {
      const { id, version } = parseRef(ref);
      const parts = changedParts(entry, now);
      const what = parts.length > 0 ? parts.join(", ") : "content";
      problems.push({
        kind: "changed_without_bump",
        ref,
        message:
          `${ref}: ${what} changed without a version bump. Keep ${ref} as it was, or bump the version ` +
          `to ${id}@${Math.max(version, highestLocked.get(id) ?? 0) + 1} and run --write. ` +
          `(locked ${entry.hash}, now ${now.hash})`,
      });
    }
  }

  for (const ref of Object.keys(locked).sort()) {
    if (Object.hasOwn(current, ref)) continue;
    if (locked[ref].retired === undefined) {
      problems.push({
        kind: "removed_without_note",
        ref,
        message: `${ref} is locked but no longer registered. Restore it, or add "retired": "<why>" to its lock entry.`,
      });
    }
  }

  return { problems, additions };
}

/** The lock with `additions` added, keys sorted. Never rewrites an existing entry. */
export function withAdditions(lock, additions) {
  const prompts = { ...lock.prompts };
  for (const [ref, value] of Object.entries(additions)) {
    if (Object.hasOwn(prompts, ref)) throw new Error(`refusing to overwrite lock entry ${ref}`);
    prompts[ref] = { hash: value.hash, parts: value.parts };
  }
  const sorted = {};
  for (const ref of Object.keys(prompts).sort()) sorted[ref] = prompts[ref];
  return { format: LOCK_FORMAT, algorithm: "sha256", prompts: sorted };
}

export function serializeLock(lock) {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

function parseArgs(argv) {
  const options = { write: false, lockPath: DEFAULT_LOCK_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") options.write = true;
    else if (arg === "--lock") {
      const value = argv[i + 1];
      if (value === undefined) throw new Error("--lock needs a path");
      options.lockPath = path.resolve(value);
      i += 1;
    } else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

async function readLock(lockPath, allowMissing) {
  let text;
  try {
    text = await readFile(lockPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" && allowMissing) return emptyLock();
    throw new Error(`cannot read lock file ${lockPath}: ${error.message}`);
  }
  return parseLock(text);
}

/** CLI entry. Returns the exit code. */
export async function main(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  let lock;
  let current;
  try {
    options = parseArgs(argv);
    lock = await readLock(options.lockPath, options.write);
    current = currentHashes();
  } catch (error) {
    stderr.write(`check-prompt-versions: ${error.message}\n`);
    return 1;
  }

  const { problems, additions } = checkPromptVersions(current, lock);
  const blocking = options.write ? problems.filter((problem) => problem.kind !== "unlocked") : problems;

  if (blocking.length > 0) {
    stderr.write(`check-prompt-versions: ${blocking.length} problem(s)${options.write ? "; nothing written" : ""}\n`);
    for (const problem of blocking) stderr.write(`  [${problem.kind}] ${problem.message}\n`);
    return 1;
  }

  const count = Object.keys(current).length;
  if (options.write) {
    const added = Object.keys(additions);
    if (added.length > 0) {
      await writeFile(options.lockPath, serializeLock(withAdditions(lock, additions)), "utf8");
      stdout.write(`check-prompt-versions: locked ${added.join(", ")}\n`);
    } else {
      stdout.write("check-prompt-versions: nothing new to lock\n");
    }
    return 0;
  }
  stdout.write(`check-prompt-versions: ${count} prompt version(s) match the lock\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
