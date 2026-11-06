#!/usr/bin/env node
/**
 * WP71-S3. Prompt-version check (`02` §5.3): fail when a prompt's text or
 * schema changes without a version bump.
 *
 *   node --experimental-strip-types scripts/check-prompt-versions.mjs           # check (CI)
 *   node --experimental-strip-types scripts/check-prompt-versions.mjs --write   # lock new versions
 *   ... --lock <path>       another lock file
 *   ... --base <git-ref>    base for the immutability check (see "Base" below)
 *   ... --no-base           skip the base check
 *
 * It loads the real registry (`convex/ai/registry.ts`, whose imports carry
 * `.ts` extensions for this) and hashes each spec with SHA-256 over canonical
 * JSON (sorted keys). The hashed parts (each also hashed alone, so a failure
 * names what changed):
 * - `system`, `task`, `outputSchema`, `run`: from the registry's
 *   `promptContent`. `run` includes the router's resolved model and input
 *   ceiling, so a `TIER_MODELS` or ceiling change fails a locked version.
 * - `module`: the source of the entry's `module` file and, transitively, every
 *   repo-local relative import it makes at runtime. Left out: type-only
 *   imports, packages, `node_modules`, and exactly
 *   `lib/workspace/contracts/prompts.ts` (C-PROMPT's definitions; what it
 *   decides for a spec is already in `run`). Paths are repo-relative POSIX,
 *   sorted; line endings are normalised. Helpers, constants on any branch, and
 *   `.refine()` / `.superRefine()` on the output schema all live here, so a
 *   change to any of them changes the hash. Comments count too.
 *   NOT hashed: data files a module reads at run time through `readFileSync`,
 *   `fetch`, `new URL(..., import.meta.url)` or similar. Keep prompt text in
 *   source, not in data files.
 *
 * Check mode fails (exit 1) when:
 * - a locked `id@version` has different content (changed without a bump);
 * - a registered `id@version` is not in the lock (run `--write`);
 * - a new version is not above every locked version of that id;
 * - a locked `id@version` is gone from the registry with no `retired` note;
 * - a ref whose lock entry is `retired` is registered again;
 * - an entry's `module` file does not export that exact spec (every field,
 *   including the same `buildUser` and `outputSchema` objects);
 * - base check: an entry in the base lock is missing here or differs in value.
 *   Lock entries are permanent; the only change allowed to one is adding
 *   `retired`. This stops "delete the entry and re-run --write".
 *
 * Base: `--base <ref>` if given; else on a GitHub pull request
 * `origin/$GITHUB_BASE_REF`; else on a push the event's `before` sha (from
 * `$GITHUB_EVENT_PATH`), or, for a new branch (`before` all zeros), the
 * repository's default branch; else `origin/main`. The lock is read with
 * `git show <ref>:convex/ai/prompts/versions.lock.json`. When the ref is not
 * present and `CI` is set, the script runs one
 * `git fetch --depth=1 --no-tags origin <branch-or-sha>` and reads FETCH_HEAD.
 * - The base has no lock file at that path: a notice, and a pass.
 * - The base cannot be read, or its lock does not parse: with `CI` set, a
 *   failure (`base_unavailable` / `base_unreadable`); locally, a notice and the
 *   base check is skipped.
 *
 * `--write` adds lock entries for new versions only. It never rewrites an
 * existing entry and writes nothing while any other problem stands. Retirement
 * notes are added by hand: `"retired": "<why, which WP>"`.
 *
 * No network except that one CI `git fetch` of the base; no env other than
 * `CI`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { SPEC_KEYS } from "../convex/ai/prompts/entry.ts";
import { canonicalJson, listEntries, promptContent, promptContentPartKey, PROMPT_CONTENT_PARTS } from "../convex/ai/registry.ts";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const LOCK_RELATIVE_PATH = "convex/ai/prompts/versions.lock.json";
export const DEFAULT_LOCK_PATH = path.join(ROOT, LOCK_RELATIVE_PATH);
export const DEFAULT_BASE_REF = "origin/main";
export const LOCK_FORMAT = 1;
export const HASH_PARTS = [...PROMPT_CONTENT_PARTS, "module"];

const REF_PATTERN = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)@([1-9][0-9]*)$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const MODULE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];
/**
 * Exact files left out of the `module` part. Only C-PROMPT itself: specs import
 * `definePromptSpec` from it, and every value it decides for a spec (model,
 * caps, ceilings) is already in the `run` part. Any other contract a spec
 * imports at runtime is hashed.
 */
export const EXCLUDED_MODULE_FILES = new Set(["lib/workspace/contracts/prompts.ts"]);

function sha256(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function parseRef(ref) {
  const match = REF_PATTERN.exec(ref);
  return match ? { id: match[1], version: Number(match[2]) } : null;
}

// ---------------------------------------------------------------------------
// Module sources
// ---------------------------------------------------------------------------

function scriptKind(fileName) {
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (/\.[cm]?js$/u.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function literalText(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}

/**
 * The relative module specifiers a file imports at runtime. Type-only imports
 * and exports are skipped. A non-literal `import()` / `require()` throws: its
 * target cannot be fingerprinted.
 */
export function relativeRuntimeImports(fileName, source) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  const specifiers = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause?.isTypeOnly) specifiers.push(literalText(node.moduleSpecifier));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (!node.isTypeOnly) specifiers.push(literalText(node.moduleSpecifier));
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      if (!node.isTypeOnly) specifiers.push(literalText(node.moduleReference.expression));
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require")) {
        const text = literalText(node.arguments[0]);
        if (text === null) throw new Error(`${fileName}: a non-literal import()/require() cannot be fingerprinted`);
        specifiers.push(text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers.filter((text) => text !== null && (text.startsWith("./") || text.startsWith("../")));
}

/** The repo-relative path a relative specifier points at (before extension resolution). */
function joinSpecifier(fromRel, specifier) {
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), specifier));
  if (joined === ".." || joined.startsWith("../") || path.posix.isAbsolute(joined)) {
    throw new Error(`${fromRel}: import ${specifier} leaves the repository`);
  }
  return joined;
}

/** Resolves a relative specifier from a repo-relative file to a repo-relative file. */
export function resolveModule(root, fromRel, specifier) {
  const joined = joinSpecifier(fromRel, specifier);
  const candidates = [joined];
  if (joined.endsWith(".js")) candidates.push(`${joined.slice(0, -3)}.ts`, `${joined.slice(0, -3)}.tsx`);
  for (const ext of MODULE_EXTENSIONS) candidates.push(`${joined}${ext}`);
  for (const ext of MODULE_EXTENSIONS) candidates.push(`${joined}/index${ext}`);
  for (const candidate of candidates) {
    const abs = path.join(root, candidate);
    if (existsSync(abs) && statSync(abs).isFile()) return candidate;
  }
  throw new Error(`${fromRel}: cannot resolve import ${specifier}`);
}

function excludedModule(rel) {
  return rel.split("/").includes("node_modules") || EXCLUDED_MODULE_FILES.has(rel);
}

/**
 * `[{ path, source }]` for a module and its repo-local runtime imports,
 * transitively, sorted by path. Sources have `\r\n` normalised to `\n` and no BOM.
 */
export function moduleSources(root, modulePath) {
  const seen = new Map();
  const queue = [modulePath];
  while (queue.length > 0) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    const abs = path.join(root, rel);
    if (!existsSync(abs)) throw new Error(`prompt module ${rel} does not exist`);
    const source = readFileSync(abs, "utf8").replace(/^﻿/u, "").replace(/\r\n?/gu, "\n");
    seen.set(rel, source);
    for (const specifier of relativeRuntimeImports(rel, source)) {
      // Excluded paths (C-PROMPT, node_modules) are skipped before resolution.
      if (excludedModule(joinSpecifier(rel, specifier))) continue;
      const resolved = resolveModule(root, rel, specifier);
      if (!excludedModule(resolved) && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen.keys()].sort().map((rel) => ({ path: rel, source: seen.get(rel) }));
}

// ---------------------------------------------------------------------------
// Hashes
// ---------------------------------------------------------------------------

/** `{ hash, parts }` for one registry entry. */
export function hashEntry(entry, { root = ROOT } = {}) {
  const content = promptContent(entry);
  const modules = moduleSources(root, entry.module);
  const parts = {};
  for (const part of PROMPT_CONTENT_PARTS) parts[part] = sha256(promptContentPartKey(content, part));
  parts.module = sha256(canonicalJson(modules));
  return { hash: sha256(canonicalJson({ ...content, module: modules })), parts };
}

/** ref → `{ hash, parts }` for every entry. */
export function currentHashes(entries = listEntries(), options = {}) {
  const out = {};
  for (const entry of entries) {
    const ref = `${entry.spec.id}@${entry.spec.version}`;
    if (Object.hasOwn(out, ref)) throw new Error(`duplicate ref ${ref}`);
    out[ref] = hashEntry(entry, options);
  }
  return out;
}

const COMPARED_AS_DATA = new Set(["thinking", "cacheLayout"]);

/**
 * True when an exported value is this entry's spec: every C-PROMPT field
 * equal, with `buildUser` and `outputSchema` the very same objects. An entry
 * that overrides `buildUser` (or anything else) in `prompts/index.ts` would
 * otherwise borrow a module's hash without using its code.
 */
function exportsSpec(value, spec) {
  if (typeof value !== "object" || value === null) return false;
  return SPEC_KEYS.every((key) =>
    COMPARED_AS_DATA.has(key) ? canonicalJson(value[key] ?? null) === canonicalJson(spec[key] ?? null) : value[key] === spec[key],
  );
}

/** Problems for entries whose `module` file does not export their exact spec. */
export async function verifyEntryModules(entries = listEntries(), { root = ROOT } = {}) {
  const problems = [];
  for (const entry of entries) {
    const ref = `${entry.spec.id}@${entry.spec.version}`;
    let exported;
    try {
      exported = await import(pathToFileURL(path.join(root, entry.module)).href);
    } catch (error) {
      problems.push({ kind: "module_mismatch", ref, message: `${ref}: cannot load module ${entry.module}: ${error.message}` });
      continue;
    }
    if (!Object.values(exported).some((value) => exportsSpec(value, entry.spec))) {
      problems.push({
        kind: "module_mismatch",
        ref,
        message: `${ref}: module ${entry.module} does not export this exact spec (register the exported spec object unchanged)`,
      });
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Lock
// ---------------------------------------------------------------------------

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
  return HASH_PARTS.filter((part) => locked.parts[part] !== now.parts[part]);
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

/**
 * Every entry in the base lock must be in `lock` with the same value; the one
 * change allowed is adding `retired` to an entry the base had not retired.
 */
export function compareWithBase(baseLock, lock, baseRef = DEFAULT_BASE_REF) {
  const problems = [];
  for (const ref of Object.keys(baseLock.prompts).sort()) {
    const base = baseLock.prompts[ref];
    const now = lock.prompts[ref];
    if (now === undefined) {
      problems.push({
        kind: "base_entry_removed",
        ref,
        message: `${ref} is in the ${baseRef} lock but not in this one. Lock entries are permanent; add "retired": "<why>" instead.`,
      });
      continue;
    }
    let comparable = now;
    if (base.retired === undefined && now.retired !== undefined) {
      comparable = { ...now };
      delete comparable.retired;
    }
    if (canonicalJson(comparable) !== canonicalJson(base)) {
      problems.push({
        kind: "base_entry_changed",
        ref,
        message:
          `${ref} differs from the ${baseRef} lock. A locked entry never changes (only adding "retired" is allowed); ` +
          "restore it and bump the prompt's version instead.",
      });
    }
  }
  return problems;
}

const ZERO_SHA = /^0+$/u;
const SHA = /^[0-9a-f]{7,40}$/u;

/** True when `CI` is set to anything but empty, `0` or `false`. */
export function isCi(env) {
  const value = env.CI;
  return typeof value === "string" && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

function fetchTargetFor(ref) {
  if (SHA.test(ref)) return ref;
  return ref.startsWith("origin/") ? ref.slice("origin/".length) : ref;
}

/**
 * The base to compare with: `{ ref, fetchTarget, source }`. See the file
 * header for the order. A new-branch push (`before` all zeros) compares with
 * the repository's default branch (from the event, else `main`) rather than
 * skipping, so a fresh branch cannot rewrite main's lock entries either.
 */
export function resolveBase({ explicitRef, env, readEventFile }) {
  if (explicitRef) return { ref: explicitRef, fetchTarget: fetchTargetFor(explicitRef), source: "--base" };
  if (env.GITHUB_BASE_REF) {
    return { ref: `origin/${env.GITHUB_BASE_REF}`, fetchTarget: env.GITHUB_BASE_REF, source: "pull request base (GITHUB_BASE_REF)" };
  }
  if (env.GITHUB_EVENT_PATH) {
    let event = null;
    try {
      event = JSON.parse(readEventFile(env.GITHUB_EVENT_PATH));
    } catch {
      event = null;
    }
    const before = event?.before;
    if (typeof before === "string" && /^[0-9a-f]{40}$/u.test(before)) {
      if (!ZERO_SHA.test(before)) return { ref: before, fetchTarget: before, source: "push event before" };
      const branch = typeof event?.repository?.default_branch === "string" ? event.repository.default_branch : "main";
      return { ref: `origin/${branch}`, fetchTarget: branch, source: "new-branch push: default branch" };
    }
  }
  return { ref: DEFAULT_BASE_REF, fetchTarget: fetchTargetFor(DEFAULT_BASE_REF), source: "default" };
}

/** Runs git; never throws. `{ status, stdout, stderr }`. */
export function runGit(args, { root = ROOT } = {}) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.error) return { status: 127, stdout: "", stderr: result.error.message };
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/**
 * Reads the base lock with git. Returns `{ status: "ok", text, fetched }`,
 * `{ status: "missing", fetched }` (no lock file at that path) or
 * `{ status: "unavailable", reason }`. When the ref is absent and `ci` is set,
 * it fetches the base once (depth 1, no tags) and reads FETCH_HEAD.
 */
export function readBaseLockFromGit({ ref, fetchTarget }, { git = runGit, ci = false } = {}) {
  if (ref.startsWith("-") || fetchTarget.startsWith("-")) return { status: "unavailable", reason: `refusing base ref ${ref}` };
  const has = (name) => git(["rev-parse", "--verify", "--quiet", `${name}^{commit}`]).status === 0;
  let readRef = ref;
  let fetched = false;
  if (!has(ref)) {
    if (!ci) return { status: "unavailable", reason: `git ref ${ref} is not available (shallow clone, no remote or no git)` };
    const fetch = git(["fetch", "--depth=1", "--no-tags", "origin", fetchTarget]);
    if (fetch.status !== 0 || !has("FETCH_HEAD")) {
      return {
        status: "unavailable",
        reason: `git ref ${ref} is not available and \`git fetch origin ${fetchTarget}\` failed: ${fetch.stderr.trim() || `exit ${fetch.status}`}`,
      };
    }
    readRef = "FETCH_HEAD";
    fetched = true;
  }
  if (git(["cat-file", "-e", `${readRef}:${LOCK_RELATIVE_PATH}`]).status !== 0) return { status: "missing", fetched };
  const shown = git(["show", `${readRef}:${LOCK_RELATIVE_PATH}`]);
  if (shown.status !== 0) {
    return { status: "unavailable", reason: `cannot read ${LOCK_RELATIVE_PATH} at ${ref}: ${shown.stderr.trim()}` };
  }
  return { status: "ok", text: shown.stdout, fetched };
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

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  // baseRef: undefined = resolve from the environment, null = --no-base.
  const options = { write: false, lockPath: DEFAULT_LOCK_PATH, baseRef: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") options.write = true;
    else if (arg === "--no-base") options.baseRef = null;
    else if (arg === "--lock" || arg === "--base") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      if (arg === "--lock") options.lockPath = path.resolve(value);
      else options.baseRef = value;
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

/**
 * CLI entry. Returns the exit code. `entries`, `env`, `git` and
 * `readEventFile` are injectable, so tests run no git and no network.
 */
export async function main(
  argv = process.argv.slice(2),
  {
    stdout = process.stdout,
    stderr = process.stderr,
    entries = listEntries(),
    env = process.env,
    git = runGit,
    readEventFile = (file) => readFileSync(file, "utf8"),
  } = {},
) {
  let options;
  let lock;
  let current;
  let problems;
  let additions;
  try {
    options = parseArgs(argv);
    lock = await readLock(options.lockPath, options.write);
    current = currentHashes(entries);
    ({ problems, additions } = checkPromptVersions(current, lock));
    problems.push(...(await verifyEntryModules(entries)));
  } catch (error) {
    stderr.write(`check-prompt-versions: ${error.message}\n`);
    return 1;
  }

  const blocking = options.write ? problems.filter((problem) => problem.kind !== "unlocked") : [...problems];
  const next = options.write && blocking.length === 0 ? withAdditions(lock, additions) : lock;

  if (options.baseRef === null) {
    stdout.write("check-prompt-versions: notice: base check skipped (--no-base)\n");
  } else {
    const ci = isCi(env);
    const base = resolveBase({ explicitRef: options.baseRef, env, readEventFile });
    const label = `${base.ref} (${base.source})`;
    const read = readBaseLockFromGit(base, { git, ci });
    if (read.status === "unavailable") {
      if (ci) {
        blocking.push({ kind: "base_unavailable", ref: base.ref, message: `cannot read the base lock at ${label}: ${read.reason}` });
      } else {
        stdout.write(`check-prompt-versions: notice: base check skipped: ${read.reason}\n`);
      }
    } else if (read.status === "missing") {
      stdout.write(`check-prompt-versions: notice: ${label} has no prompt lock yet; nothing to compare\n`);
    } else {
      let baseLock = null;
      try {
        baseLock = parseLock(read.text);
      } catch (error) {
        if (ci) {
          blocking.push({ kind: "base_unreadable", ref: base.ref, message: `the base lock at ${label} does not parse: ${error.message}` });
        } else {
          stdout.write(`check-prompt-versions: notice: base check skipped: the ${label} lock is unreadable (${error.message})\n`);
        }
      }
      if (baseLock !== null) {
        blocking.push(...compareWithBase(baseLock, next, base.ref));
        stdout.write(`check-prompt-versions: compared with the base lock at ${label}${read.fetched ? ", fetched" : ""}\n`);
      }
    }
  }

  if (blocking.length > 0) {
    stderr.write(`check-prompt-versions: ${blocking.length} problem(s)${options.write ? "; nothing written" : ""}\n`);
    for (const problem of blocking) stderr.write(`  [${problem.kind}] ${problem.message}\n`);
    return 1;
  }

  if (options.write) {
    const added = Object.keys(additions);
    if (added.length > 0) {
      await writeFile(options.lockPath, serializeLock(next), "utf8");
      stdout.write(`check-prompt-versions: locked ${added.join(", ")}\n`);
    } else {
      stdout.write("check-prompt-versions: nothing new to lock\n");
    }
    return 0;
  }
  stdout.write(`check-prompt-versions: ${Object.keys(current).length} prompt version(s) match the lock\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
