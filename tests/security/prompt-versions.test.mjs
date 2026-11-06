/**
 * WP71-S3. The prompt-version check runs in `npm test` (through the
 * `test:security` glob) until a `check:prompt-versions` script and CI step
 * exist. It proves the check passes on the committed lock, and that it fails
 * on a text, task, module (helpers, refinements) or schema change with no
 * version bump, and on a lock entry rewritten against the base branch.
 * Mutations happen on in-memory entries, temp module trees and temp copies of
 * the lock; no real file changes. The base check runs with an injected git
 * runner and env, and CLI subprocesses run with `--no-base` and no CI env.
 * The one exception is the last test, which runs only when `CI` is set: the
 * real, read-only base check (real git, and a shallow fetch if needed).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { definePromptSpec, inputLaneFor, TIER_MAX_INPUT_TOKENS, TIER_MODELS } from "../../lib/workspace/contracts/prompts.ts";
import { promptEntry } from "../../convex/ai/prompts/entry.ts";
import { registryProbeSpec } from "../../convex/ai/prompts/registryProbe.ts";
import { listEntries, promptContent } from "../../convex/ai/registry.ts";
import {
  checkPromptVersions,
  C_PROMPT_VALUE_IMPORTS,
  compareWithBase,
  cPromptValueImports,
  currentHashes,
  DEFAULT_LOCK_PATH,
  EXCLUDED_MODULE_FILES,
  hashEntry,
  isCi,
  main,
  readBaseLockFromGit,
  resolveBase,
  moduleSources,
  parseLock,
  relativeRuntimeImports,
  serializeLock,
  verifyEntryModules,
  withAdditions,
} from "../../scripts/check-prompt-versions.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const script = path.join(root, "scripts/check-prompt-versions.mjs");
const PROBE_REF = "internal-registry-probe@2";
const PROBE_MODULE = "convex/ai/prompts/registryProbe.ts";
const SAMPLE = { module: PROBE_MODULE, sampleInputs: { label: "registry probe sample" }, internal: true };
const ZERO = `sha256:${"0".repeat(64)}`;

async function realLockText() {
  return readFile(DEFAULT_LOCK_PATH, "utf8");
}

async function realLock() {
  return parseLock(await realLockText());
}

const isProbeRef = (ref) => ref.startsWith("internal-registry-probe@");

/**
 * WP77-S3: the lock now holds real specs too (Wren). The probe-mutation tests
 * compare the probe alone, so they read only the probe's lock entries and
 * registry entries; the committed-lock tests still read everything.
 */
async function probeLock() {
  const lock = await realLock();
  return { ...lock, prompts: Object.fromEntries(Object.entries(lock.prompts).filter(([ref]) => isProbeRef(ref))) };
}

function probeEntries() {
  return listEntries().filter((entry) => isProbeRef(`${entry.spec.id}@${entry.spec.version}`));
}

function probeWith(overrides, options = SAMPLE) {
  return promptEntry(definePromptSpec({ ...registryProbeSpec, ...overrides }), options);
}

function kinds(problems) {
  return problems.map((problem) => `${problem.kind} ${problem.ref}`);
}

/** The CLI with `--no-base` and no CI env: the base check is tested in-process with fakes. */
function runCli(args) {
  const env = { ...process.env };
  for (const key of ["CI", "GITHUB_BASE_REF", "GITHUB_EVENT_PATH"]) delete env[key];
  return spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", script, "--no-base", ...args], {
    cwd: root,
    encoding: "utf8",
    env,
  });
}

const LOCAL = {};
const CI = { CI: "true" };

/**
 * A fake git runner. `refs` maps a ref (or sha) to its lock text, or to null
 * for a commit with no lock file. `fetchable` maps a fetch target to the same.
 * Every call is recorded in `calls`.
 */
function fakeGit({ refs = {}, fetchable = {} } = {}) {
  const state = new Map(Object.entries(refs));
  const calls = [];
  const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
  const fail = (stderr = "") => ({ status: 1, stdout: "", stderr });
  const git = (args) => {
    calls.push(args.join(" "));
    const [command, ...rest] = args;
    if (command === "rev-parse") return state.has(rest.at(-1).replace(/\^\{commit\}$/u, "")) ? ok() : fail();
    if (command === "fetch") {
      const target = rest.at(-1);
      if (!Object.hasOwn(fetchable, target)) return { status: 128, stdout: "", stderr: `fatal: couldn't find remote ref ${target}` };
      state.set("FETCH_HEAD", fetchable[target]);
      return ok();
    }
    const name = rest.at(-1).split(":")[0];
    if (command === "cat-file") return typeof state.get(name) === "string" ? ok() : fail("fatal: path does not exist");
    if (command === "show") return typeof state.get(name) === "string" ? ok(state.get(name)) : fail("fatal: bad object");
    return fail(`unexpected git ${command}`);
  };
  return { git, calls };
}

function runMain(argv, { env = LOCAL, git = fakeGit().git, entries, readEventFile } = {}) {
  const stdout = sink();
  const stderr = sink();
  const options = { stdout, stderr, env, git, ...(entries ? { entries } : {}), ...(readEventFile ? { readEventFile } : {}) };
  return main(argv, options).then((code) => ({ code, stdout: stdout.text, stderr: stderr.text }));
}

function sink() {
  let text = "";
  return { write: (chunk) => (text += chunk), get text() { return text; } };
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wp71-prompt-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeTree(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), text, "utf8");
  }
}

// ---------------------------------------------------------------------------
// The committed lock
// ---------------------------------------------------------------------------

test("the committed lock matches every registered prompt", async () => {
  const result = checkPromptVersions(currentHashes(), await realLock());
  assert.deepEqual(result.problems, []);
  assert.deepEqual(await verifyEntryModules(), []);
  assert.ok(Object.keys(currentHashes()).length >= 1);
});

test("the committed lock keeps the retired v1 probe entry and locks v2 (hash format v3)", async () => {
  const lock = await realLock();
  assert.equal(lock.prompts["internal-registry-probe@1"].retired, "hash format v2");
  assert.match(lock.prompts[PROBE_REF].parts.module, /^sha256:[0-9a-f]{64}$/);
});

test("the CLI exits 0 on the committed lock", () => {
  const run = runCli([]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /match the lock/);
});

// ---------------------------------------------------------------------------
// Content changes without a bump
// ---------------------------------------------------------------------------

test("the hash is stable and ignores key order in the spec", () => {
  const reordered = promptEntry(
    definePromptSpec({
      fallbacks: "none",
      mode: "realtime",
      evalSuite: registryProbeSpec.evalSuite,
      cacheLayout: { ttl: "5m", business: "none", system: "stable" },
      outputSchema: registryProbeSpec.outputSchema,
      buildUser: registryProbeSpec.buildUser,
      system: registryProbeSpec.system,
      maxTokens: registryProbeSpec.maxTokens,
      thinking: registryProbeSpec.thinking,
      effort: registryProbeSpec.effort,
      tier: registryProbeSpec.tier,
      version: registryProbeSpec.version,
      id: registryProbeSpec.id,
    }),
    SAMPLE,
  );
  assert.deepEqual(currentHashes([reordered]), currentHashes(probeEntries()));
});

test("a system text change without a version bump fails and names the part", async () => {
  const entries = [probeWith({ system: `${registryProbeSpec.system} Be brief.` })];
  const { problems } = checkPromptVersions(currentHashes(entries), await probeLock());
  assert.deepEqual(kinds(problems), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(problems[0].message, /system changed without a version bump/);
  assert.match(problems[0].message, /internal-registry-probe@3/);
});

test("a task template change without a version bump fails", async () => {
  const entries = [probeWith({ buildUser: (inputs) => `Echo this label: ${inputs.label}` })];
  const { problems } = checkPromptVersions(currentHashes(entries), await probeLock());
  assert.deepEqual(kinds(problems), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(problems[0].message, /^internal-registry-probe@2: task changed/);
});

test("the task part includes the sample render (different sample inputs change it)", async () => {
  const entry = promptEntry(registryProbeSpec, { ...SAMPLE, sampleInputs: { label: "a different sample" } });
  const { problems } = checkPromptVersions(currentHashes([entry]), await probeLock());
  assert.deepEqual(kinds(problems), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(problems[0].message, /: task changed/);
});

test("an output schema change without a version bump fails", async () => {
  const entries = [probeWith({ outputSchema: z.object({ echo: z.string().min(1).max(100) }) })];
  const { problems } = checkPromptVersions(currentHashes(entries), await probeLock());
  assert.deepEqual(kinds(problems), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(problems[0].message, /outputSchema changed/);
});

test("a run setting change without a version bump fails", async () => {
  const entries = [probeWith({ maxTokens: 512 })];
  const { problems } = checkPromptVersions(currentHashes(entries), await probeLock());
  assert.deepEqual(kinds(problems), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(problems[0].message, /run changed/);
});

test("a module source change without a version bump fails and names the module part", async () => {
  await withTempDir(async (dir) => {
    const source = await readFile(path.join(root, PROBE_MODULE), "utf8");
    await writeTree(dir, { [PROBE_MODULE]: source.replace("version: 2,", "version: 2, // edited") });
    const lock = await probeLock();
    const { problems } = checkPromptVersions({ [PROBE_REF]: hashEntry(probeEntries()[0], { root: dir }) }, lock);
    assert.deepEqual(kinds(problems), [`changed_without_bump ${PROBE_REF}`]);
    assert.match(problems[0].message, /: module changed without a version bump/);
  });
});

// ---------------------------------------------------------------------------
// The module part
// ---------------------------------------------------------------------------

const SPEC_MODULE = [
  'import { z } from "zod";',
  'import type { Shape } from "./types.ts";',
  'import { definePromptSpec } from "../lib/workspace/contracts/prompts.ts";',
  'import { RULES } from "./helper.ts";',
  'export { HELPER_NOTE } from "./helper.ts";',
  "export const out = z.object({ echo: z.string() }).refine((v) => v.echo.length < 50);",
  "export const pick = (long) => (long ? RULES.long : RULES.short);",
  "",
].join("\n");

const TREE = {
  "p/spec.ts": SPEC_MODULE,
  "p/helper.ts": 'import { deep } from "./deep";\nexport const RULES = { short: "Be brief.", long: "Be thorough." };\nexport const HELPER_NOTE = deep;\n',
  "p/deep.ts": 'import { RULES } from "./helper.ts";\nexport const deep = "deep";\nexport const loop = RULES;\n',
  "p/types.ts": "export type Shape = { a: string };\n",
  "lib/workspace/contracts/prompts.ts": "export const definePromptSpec = (s) => s;\n",
};

function tempEntry() {
  return promptEntry(registryProbeSpec, { ...SAMPLE, module: "p/spec.ts" });
}

test("moduleSources follows runtime relative imports, sorted, and skips types, packages and contracts", async () => {
  await withTempDir(async (dir) => {
    await writeTree(dir, TREE);
    const sources = moduleSources(dir, "p/spec.ts");
    assert.deepEqual(
      sources.map((item) => item.path),
      ["p/deep.ts", "p/helper.ts", "p/spec.ts"],
      "cycles end, extensionless imports resolve, type-only and contract imports are skipped",
    );
  });
});

test("a constant on a branch the sample never reaches changes the module part", async () => {
  await withTempDir(async (dir) => {
    await writeTree(dir, TREE);
    const before = hashEntry(tempEntry(), { root: dir });
    // `RULES.long` is only read when `long` is true; the probe's sample never is.
    await writeTree(dir, { "p/helper.ts": TREE["p/helper.ts"].replace("Be thorough.", "Be exhaustive.") });
    const after = hashEntry(tempEntry(), { root: dir });
    assert.notEqual(after.parts.module, before.parts.module);
    assert.notEqual(after.hash, before.hash);
    assert.equal(after.parts.task, before.parts.task, "the task part alone would have missed this");
  });
});

test("a .refine() change in the spec module changes the module part", async () => {
  await withTempDir(async (dir) => {
    await writeTree(dir, TREE);
    const before = hashEntry(tempEntry(), { root: dir });
    await writeTree(dir, { "p/spec.ts": SPEC_MODULE.replace("length < 50", "length < 40") });
    // A refinement is invisible to JSON Schema, so only the module part catches it.
    const after = hashEntry(tempEntry(), { root: dir });
    assert.notEqual(after.parts.module, before.parts.module);
    assert.equal(after.parts.outputSchema, before.parts.outputSchema);
  });
});

test("a transitive import change counts; type-only, contract and line-ending changes do not", async () => {
  await withTempDir(async (dir) => {
    await writeTree(dir, TREE);
    const base = hashEntry(tempEntry(), { root: dir }).parts.module;

    await writeTree(dir, { "p/deep.ts": TREE["p/deep.ts"].replace('"deep"', '"deeper"') });
    assert.notEqual(hashEntry(tempEntry(), { root: dir }).parts.module, base);
    await writeTree(dir, { "p/deep.ts": TREE["p/deep.ts"] });

    await writeTree(dir, {
      "p/types.ts": "export type Shape = { b: number };\n",
      "lib/workspace/contracts/prompts.ts": "export const definePromptSpec = (s) => ({ ...s });\n",
      "p/spec.ts": SPEC_MODULE.replace(/\n/gu, "\r\n"),
    });
    assert.equal(hashEntry(tempEntry(), { root: dir }).parts.module, base);
  });
});

test("only C-PROMPT itself is excluded; any other contract a spec imports at runtime is hashed", async () => {
  assert.deepEqual([...EXCLUDED_MODULE_FILES], ["lib/workspace/contracts/prompts.ts"]);
  await withTempDir(async (dir) => {
    await writeTree(dir, {
      ...TREE,
      "p/spec.ts": `${SPEC_MODULE}import { LIMIT } from "../lib/workspace/contracts/other.ts";\nexport const limit = LIMIT;\n`,
      "lib/workspace/contracts/other.ts": "export const LIMIT = 5;\n",
    });
    const paths = moduleSources(dir, "p/spec.ts").map((item) => item.path);
    assert.ok(paths.includes("lib/workspace/contracts/other.ts"));
    assert.ok(!paths.includes("lib/workspace/contracts/prompts.ts"));
    const before = hashEntry(tempEntry(), { root: dir }).parts.module;
    await writeTree(dir, { "lib/workspace/contracts/other.ts": "export const LIMIT = 6;\n" });
    assert.notEqual(hashEntry(tempEntry(), { root: dir }).parts.module, before);
  });
});

test("spec modules may import only definePromptSpec and types from C-PROMPT", async () => {
  assert.deepEqual([...C_PROMPT_VALUE_IMPORTS], ["definePromptSpec"]);
  const C = "../lib/workspace/contracts/prompts.ts";
  const isC = (specifier) => specifier === C;
  const allowed = [
    `import { definePromptSpec } from "${C}";`,
    `import { definePromptSpec as d, type PromptSpec } from "${C}";`,
    `import type { TIER_MODELS } from "${C}";`,
    `export type { PromptSpec } from "${C}";`,
    `import "${C}";`,
    'import { TIER_MODELS } from "./elsewhere.ts";',
  ];
  for (const source of allowed) assert.deepEqual(cPromptValueImports("p/spec.ts", source, isC), [], source);
  const refused = [
    [`import { TIER_MODELS } from "${C}";`, ["TIER_MODELS"]],
    [`import { definePromptSpec, maxInputTokensForSpec as m } from "${C}";`, ["maxInputTokensForSpec"]],
    [`import contract from "${C}";`, ["default"]],
    [`import * as contract from "${C}";`, ["* (namespace)"]],
    [`export * from "${C}";`, ["* (re-export)"]],
    [`export { TIER_MAX_TOKENS } from "${C}";`, ["TIER_MAX_TOKENS"]],
    [`import c = require("${C}");`, ["import = require()"]],
    [`const c = await import("${C}");`, ["import()/require()"]],
  ];
  for (const [source, found] of refused) assert.deepEqual(cPromptValueImports("p/spec.ts", source, isC), found, source);

  await withTempDir(async (dir) => {
    // Through a helper and without the .ts extension: still refused.
    await writeTree(dir, {
      ...TREE,
      "p/helper.ts": `import { TIER_MODELS } from "../lib/workspace/contracts/prompts";
${TREE["p/helper.ts"]}export const m = TIER_MODELS;
`,
    });
    assert.throws(() => moduleSources(dir, "p/spec.ts"), /p\/helper\.ts: a prompt module may import only definePromptSpec and types.*found TIER_MODELS/);
    assert.throws(() => hashEntry(tempEntry(), { root: dir }), /found TIER_MODELS/);
  });
});

test("a TIER_MODELS or input-ceiling change fails the locked @2 on the run part", async () => {
  const lock = await probeLock();
  const lane = inputLaneFor(registryProbeSpec.tier, registryProbeSpec.mode);
  const model = TIER_MODELS.fast;
  const ceiling = TIER_MAX_INPUT_TOKENS[lane];
  const runOnly = () => {
    const { problems } = checkPromptVersions(currentHashes(probeEntries()), lock);
    assert.deepEqual(kinds(problems), [`changed_without_bump ${PROBE_REF}`]);
    assert.match(problems[0].message, new RegExp(`^${PROBE_REF}: run changed without a version bump`));
  };
  try {
    TIER_MODELS.fast = "claude-haiku-9-9";
    runOnly();
    TIER_MODELS.fast = model;
    TIER_MAX_INPUT_TOKENS[lane] = ceiling + 1;
    runOnly();
  } finally {
    TIER_MODELS.fast = model;
    TIER_MAX_INPUT_TOKENS[lane] = ceiling;
  }
  assert.deepEqual(checkPromptVersions(currentHashes(probeEntries()), lock).problems, [], "restored tables match the lock again");
});

test("the run part carries the router's resolved model and input ceiling", () => {
  const { run } = promptContent(listEntries()[0]);
  assert.equal(run.provider, "anthropic");
  assert.equal(run.model, "claude-haiku-5-5");
  assert.equal(run.maxInputTokens, 40_000);
  assert.equal(run.tier, "fast");
});

test("an unfingerprintable module is refused with a clear error", async () => {
  assert.throws(() => relativeRuntimeImports("x.ts", "const m = await import(name);"), /non-literal import/);
  assert.throws(() => relativeRuntimeImports("x.ts", "const m = require(`./${name}`);"), /non-literal import/);
  await withTempDir(async (dir) => {
    await writeTree(dir, {
      "p/missing.ts": 'import { a } from "./nowhere";\n',
      "p/outside.ts": 'import { a } from "../../etc/passwd";\n',
    });
    assert.throws(() => moduleSources(dir, "p/missing.ts"), /cannot resolve import \.\/nowhere/);
    assert.throws(() => moduleSources(dir, "p/outside.ts"), /leaves the repository/);
    assert.throws(() => moduleSources(dir, "p/absent.ts"), /does not exist/);
  });
});

test("an entry that overrides a field of the module's spec in index.ts is a problem", async () => {
  // e.g. in prompts/index.ts: promptEntry({ ...registryProbeSpec, buildUser: (i) => render(i) }, { module: PROBE_MODULE })
  const render = (inputs) => `Return JSON whose "echo" field is this label, unchanged:\n${inputs.label}`;
  const overrides = [
    probeWith({ buildUser: (inputs) => render(inputs) }),
    probeWith({ outputSchema: registryProbeSpec.outputSchema.extend({}) }),
    probeWith({ evalSuite: "other-suite" }),
    probeWith({ thinking: { type: "adaptive" } }),
  ];
  for (const entry of overrides) {
    assert.deepEqual(kinds(await verifyEntryModules([entry])), [`module_mismatch ${PROBE_REF}`]);
  }
  assert.deepEqual(await verifyEntryModules([promptEntry(registryProbeSpec, SAMPLE)]), [], "the exported spec itself passes");
});

test("an entry whose module does not export its spec is a problem", async () => {
  const wrong = promptEntry(registryProbeSpec, { ...SAMPLE, module: "convex/ai/prompts/index.ts" });
  assert.deepEqual(kinds(await verifyEntryModules([wrong])), [`module_mismatch ${PROBE_REF}`]);
  assert.throws(() => promptEntry(registryProbeSpec, { ...SAMPLE, module: "../outside.ts" }), /repo-relative/);
  assert.throws(() => promptEntry(registryProbeSpec, { ...SAMPLE, module: "/abs/spec.ts" }), /repo-relative/);
});

// ---------------------------------------------------------------------------
// Lock rules
// ---------------------------------------------------------------------------

test("a bumped version is unlocked until --write adds it, then passes", async () => {
  const lock = await realLock();
  const entries = [...listEntries(), probeWith({ version: 3, system: `${registryProbeSpec.system} v3.` })];
  const first = checkPromptVersions(currentHashes(entries), lock);
  assert.deepEqual(kinds(first.problems), ["unlocked internal-registry-probe@3"]);

  const next = withAdditions(lock, first.additions);
  assert.equal(next.prompts[PROBE_REF].hash, lock.prompts[PROBE_REF].hash, "an existing hash is never rewritten");
  assert.deepEqual(checkPromptVersions(currentHashes(entries), next).problems, []);
  assert.throws(() => withAdditions(next, first.additions), /refusing to overwrite/);
});

test("a new version at or below a locked version fails", async () => {
  const lock = await realLock();
  const v4 = probeWith({ version: 4, system: `${registryProbeSpec.system} v4.` });
  const withV4 = withAdditions(lock, currentHashes([v4]));
  const v3 = probeWith({ version: 3, system: `${registryProbeSpec.system} v3.` });
  const { problems } = checkPromptVersions(currentHashes([...listEntries(), v3, v4]), withV4);
  assert.deepEqual(kinds(problems), ["version_not_increasing internal-registry-probe@3"]);
});

test("a removed spec fails without a retired note and passes with one", async () => {
  const lock = await probeLock();
  assert.deepEqual(kinds(checkPromptVersions({}, lock).problems), [`removed_without_note ${PROBE_REF}`]);

  const retired = structuredClone(lock);
  retired.prompts[PROBE_REF].retired = "test: retired";
  assert.deepEqual(checkPromptVersions({}, retired).problems, []);
  assert.deepEqual(kinds(checkPromptVersions(currentHashes(probeEntries()), retired).problems), [`retired_ref_reused ${PROBE_REF}`]);
});

test("a malformed lock is refused with a clear message", () => {
  assert.throws(() => parseLock("{"), /not valid JSON/);
  assert.throws(() => parseLock(JSON.stringify({ format: 1, algorithm: "sha256", prompts: { "Bad@1": { hash: "x" } } })), /not an id@version/);
  assert.throws(() => parseLock(JSON.stringify({ format: 1, algorithm: "sha256", prompts: { "a@1": { hash: "x" } } })), /sha256 hash/);
  assert.throws(
    () => parseLock(JSON.stringify({ format: 1, algorithm: "sha256", prompts: { "a@1": { hash: ZERO, retired: "" } } })),
    /retired must be a non-empty note/,
  );
});

// ---------------------------------------------------------------------------
// Base comparison (injected locks; no git)
// ---------------------------------------------------------------------------

test("compareWithBase allows new entries and adding retired, nothing else", async () => {
  const base = await probeLock();
  assert.deepEqual(compareWithBase(base, base), []);

  const added = withAdditions(base, { "other-prompt@1": { hash: ZERO, parts: {} } });
  assert.deepEqual(compareWithBase(base, added), [], "new entries are fine");

  const retired = structuredClone(base);
  retired.prompts[PROBE_REF].retired = "superseded";
  assert.deepEqual(compareWithBase(base, retired), [], "adding retired is the one allowed change");

  const reordered = { ...base, prompts: { [PROBE_REF]: { parts: base.prompts[PROBE_REF].parts, hash: base.prompts[PROBE_REF].hash }, "internal-registry-probe@1": base.prompts["internal-registry-probe@1"] } };
  assert.deepEqual(compareWithBase(base, reordered), [], "key order is not a change");
});

test("compareWithBase flags a removed, rehashed or re-noted base entry", async () => {
  const base = await realLock();

  const removed = structuredClone(base);
  delete removed.prompts[PROBE_REF];
  assert.deepEqual(kinds(compareWithBase(base, removed)), [`base_entry_removed ${PROBE_REF}`]);

  const rehashed = structuredClone(base);
  rehashed.prompts[PROBE_REF].hash = ZERO;
  assert.deepEqual(kinds(compareWithBase(base, rehashed)), [`base_entry_changed ${PROBE_REF}`]);

  const reparted = structuredClone(base);
  reparted.prompts[PROBE_REF].parts.system = ZERO;
  assert.deepEqual(kinds(compareWithBase(base, reparted)), [`base_entry_changed ${PROBE_REF}`]);

  const renoted = structuredClone(base);
  renoted.prompts["internal-registry-probe@1"].retired = "a different note";
  assert.deepEqual(kinds(compareWithBase(base, renoted)), ["base_entry_changed internal-registry-probe@1"]);

  const unretired = structuredClone(base);
  delete unretired.prompts["internal-registry-probe@1"].retired;
  assert.deepEqual(kinds(compareWithBase(base, unretired)), ["base_entry_changed internal-registry-probe@1"]);
});

/**
 * The attack: the module's content changes, the PR deletes the lock entry and
 * re-runs --write, so the local lock records the new hash under the old ref.
 * Modelled with a base lock that recorded other content for that ref.
 */
async function rewriteScenario(dir) {
  const base = await realLock();
  base.prompts[PROBE_REF].hash = ZERO;
  base.prompts[PROBE_REF].parts.system = ZERO;
  const stripped = await realLock();
  delete stripped.prompts[PROBE_REF];
  const lockPath = path.join(dir, "versions.lock.json");
  const text = serializeLock(stripped);
  await writeFile(lockPath, text, "utf8");
  return { baseText: serializeLock(base), lockPath, text };
}

test("deleting a lock entry and re-running --write cannot lock changed content under the same ref", async () => {
  await withTempDir(async (dir) => {
    const { baseText, lockPath, text } = await rewriteScenario(dir);
    const { git } = fakeGit({ refs: { "origin/main": baseText } });
    const run = await runMain(["--write", "--lock", lockPath], { git });
    assert.equal(run.code, 1);
    assert.match(run.stderr, /\[base_entry_changed\] internal-registry-probe@2 differs from the origin\/main lock/);
    assert.match(run.stderr, /nothing written/);
    assert.equal(await readFile(lockPath, "utf8"), text);
  });
});

test("CI with a shallow checkout fetches the base once, reads FETCH_HEAD and still catches the rewrite", async () => {
  await withTempDir(async (dir) => {
    const { baseText, lockPath, text } = await rewriteScenario(dir);
    const fake = fakeGit({ fetchable: { main: baseText } });
    const run = await runMain(["--write", "--lock", lockPath], { env: { ...CI, GITHUB_BASE_REF: "main" }, git: fake.git });
    assert.equal(run.code, 1);
    assert.match(run.stderr, /\[base_entry_changed\]/);
    assert.equal(await readFile(lockPath, "utf8"), text);
    assert.deepEqual(fake.calls.filter((call) => call.startsWith("fetch")), ["fetch --depth=1 --no-tags origin main"]);
    assert.ok(fake.calls.includes(`show FETCH_HEAD:convex/ai/prompts/versions.lock.json`));
  });
});

test("CI with a fetched, matching base passes and says it compared", async () => {
  const fake = fakeGit({ fetchable: { main: await realLockText() } });
  const run = await runMain([], { env: { ...CI, GITHUB_BASE_REF: "main" }, git: fake.git });
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /compared with the base lock at origin\/main \(pull request base \(GITHUB_BASE_REF\)\), fetched/);
});

test("an unreadable base: a notice and a pass locally, a failure in CI", async () => {
  const unreachable = fakeGit(); // no refs, nothing fetchable
  const local = await runMain([], { env: LOCAL, git: unreachable.git });
  assert.equal(local.code, 0, local.stderr);
  assert.match(local.stdout, /notice: base check skipped: git ref origin\/main is not available/);
  assert.deepEqual(unreachable.calls.filter((call) => call.startsWith("fetch")), [], "local runs never fetch");

  const ci = await runMain([], { env: CI, git: fakeGit().git });
  assert.equal(ci.code, 1);
  assert.match(ci.stderr, /\[base_unavailable\] cannot read the base lock at origin\/main \(default\).*git fetch origin main.*failed/);
});

test("a base lock that does not parse: a notice locally, a failure in CI", async () => {
  const refs = { "origin/main": "{" };
  const local = await runMain([], { env: LOCAL, git: fakeGit({ refs }).git });
  assert.equal(local.code, 0, local.stderr);
  assert.match(local.stdout, /base check skipped: the origin\/main \(default\) lock is unreadable/);

  const ci = await runMain([], { env: CI, git: fakeGit({ refs }).git });
  assert.equal(ci.code, 1);
  assert.match(ci.stderr, /\[base_unreadable\] the base lock at origin\/main \(default\) does not parse/);
});

test("a base with no lock file: a notice locally, a failure in CI", async () => {
  const local = await runMain([], { env: LOCAL, git: fakeGit({ refs: { "origin/main": null } }).git });
  assert.equal(local.code, 0, local.stderr);
  assert.match(local.stdout, /notice: base check skipped: origin\/main \(default\) has no prompt lock at convex\/ai\/prompts\/versions\.lock\.json/);

  const ci = await runMain([], { env: CI, git: fakeGit({ refs: { "origin/main": null } }).git });
  assert.equal(ci.code, 1);
  assert.match(ci.stderr, /\[base_missing\] the base at origin\/main \(default\) has no prompt lock at convex\/ai\/prompts\/versions\.lock\.json/);

  const fetched = await runMain([], { env: CI, git: fakeGit({ fetchable: { main: null } }).git });
  assert.equal(fetched.code, 1);
  assert.match(fetched.stderr, /\[base_missing\]/);
});

test("a matching base passes in check mode", async () => {
  const run = await runMain([], { git: fakeGit({ refs: { "origin/main": await realLockText() } }).git });
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /compared with the base lock at origin\/main/);
});

test("resolveBase picks --base, then the PR base, then the push before sha, then origin/main", () => {
  const sha = "a".repeat(40);
  const zero = "0".repeat(40);
  const event = (body) => () => JSON.stringify(body);
  const none = () => {
    throw new Error("no event file");
  };
  assert.deepEqual(resolveBase({ explicitRef: "origin/release", env: { GITHUB_BASE_REF: "main" }, readEventFile: none }), {
    ref: "origin/release",
    fetchTarget: "release",
    source: "--base",
  });
  assert.deepEqual(resolveBase({ env: { GITHUB_BASE_REF: "develop" }, readEventFile: none }), {
    ref: "origin/develop",
    fetchTarget: "develop",
    source: "pull request base (GITHUB_BASE_REF)",
  });
  assert.deepEqual(resolveBase({ env: { GITHUB_EVENT_PATH: "/e.json" }, readEventFile: event({ before: sha }) }), {
    ref: sha,
    fetchTarget: sha,
    source: "push event before",
  });
  assert.deepEqual(
    resolveBase({ env: { GITHUB_EVENT_PATH: "/e.json" }, readEventFile: event({ before: zero, repository: { default_branch: "trunk" } }) }),
    { ref: "origin/trunk", fetchTarget: "trunk", source: "new-branch push: default branch" },
  );
  assert.equal(resolveBase({ env: { GITHUB_EVENT_PATH: "/e.json" }, readEventFile: event({ before: zero }) }).ref, "origin/main");
  assert.equal(resolveBase({ env: { GITHUB_EVENT_PATH: "/e.json" }, readEventFile: none }).ref, "origin/main");
  assert.equal(resolveBase({ env: {}, readEventFile: none }).ref, "origin/main");
});

test("a push compares with the before sha, fetched by sha in CI", async () => {
  const sha = "b".repeat(40);
  const fake = fakeGit({ fetchable: { [sha]: await realLockText() } });
  const run = await runMain([], {
    env: { ...CI, GITHUB_EVENT_PATH: "/event.json" },
    git: fake.git,
    readEventFile: () => JSON.stringify({ before: sha }),
  });
  assert.equal(run.code, 0, run.stderr);
  assert.ok(fake.calls.includes(`fetch --depth=1 --no-tags origin ${sha}`));
});

test("isCi and the ref guard", () => {
  assert.equal(isCi({ CI: "true" }), true);
  assert.equal(isCi({ CI: "1" }), true);
  for (const value of [undefined, "", "0", "false", "FALSE"]) assert.equal(isCi({ CI: value }), false);
  assert.equal(readBaseLockFromGit({ ref: "--upload-pack=x", fetchTarget: "x" }, { git: fakeGit().git, ci: true }).status, "unavailable");
});

// ---------------------------------------------------------------------------
// CLI end to end on temp lock copies
// ---------------------------------------------------------------------------

test("the CLI exits 1 on a changed hash, and --write then leaves the lock untouched", async () => {
  await withTempDir(async (dir) => {
    const tampered = await realLock();
    // The lock records other content than the registry now has: the same as
    // editing the prompt and keeping its version.
    tampered.prompts[PROBE_REF].hash = ZERO;
    tampered.prompts[PROBE_REF].parts.system = ZERO;
    const lockPath = path.join(dir, "versions.lock.json");
    const text = serializeLock(tampered);
    await writeFile(lockPath, text, "utf8");

    const check = runCli(["--no-base", "--lock", lockPath]);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /\[changed_without_bump\] internal-registry-probe@2: system changed without a version bump/);

    const write = runCli(["--no-base", "--write", "--lock", lockPath]);
    assert.equal(write.status, 1);
    assert.match(write.stderr, /nothing written/);
    assert.equal(await readFile(lockPath, "utf8"), text);
  });
});

test("the CLI --write on a lock with only the retired v1 entry locks v2 and then passes", async () => {
  await withTempDir(async (dir) => {
    const lock = await realLock();
    delete lock.prompts[PROBE_REF];
    const lockPath = path.join(dir, "versions.lock.json");
    await writeFile(lockPath, serializeLock(lock), "utf8");
    assert.equal(runCli(["--no-base", "--lock", lockPath]).status, 1, "v2 is unlocked");
    const write = runCli(["--no-base", "--write", "--lock", lockPath]);
    assert.equal(write.status, 0, write.stderr);
    assert.equal(await readFile(lockPath, "utf8"), await realLockText());
    assert.equal(runCli(["--no-base", "--lock", lockPath]).status, 0);
  });
});

test("the CLI needs a lock file in check mode", async () => {
  await withTempDir(async (dir) => {
    const run = runCli(["--no-base", "--lock", path.join(dir, "absent.json")]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /cannot read lock file/);
  });
});

/**
 * The real base check, in CI only. `npm test` runs this file through the
 * `test:security` glob, so until Codex adds a `check:prompt-versions` CI step
 * this is what runs the base check in CI: the CLI with the real environment
 * and no `--no-base`, so it resolves the base (PR base, push `before`, or the
 * default branch), fetches it if the shallow checkout lacks it, and compares.
 * No `--write`, so the run is read-only; the lock bytes are checked unchanged.
 *
 * Accepted output: "compared with the base lock" and the match line, nothing
 * else (a skipped base check, any notice, or stderr output fails). `main` has
 * carried the lock since #184, so a base without one fails in CI.
 */
const COMPARED_LINE = /^check-prompt-versions: compared with the base lock at .+$/u;
const MATCH_LINE = /^check-prompt-versions: [1-9][0-9]* prompt version\(s\) match the lock$/u;

test(
  "CI: the real base check passes on the committed tree",
  {
    skip: isCi(process.env) ? false : "CI is not set; the real base check (git and a possible fetch) runs only in CI",
    timeout: 60_000,
  },
  async () => {
    const before = await realLockText();
    const run = spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", script], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      timeout: 55_000,
    });
    assert.equal(run.error, undefined, String(run.error));
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.equal(run.stderr, "", "no stderr output");
    const lines = run.stdout.trimEnd().split("\n");
    assert.equal(lines.length, 2, run.stdout);
    assert.match(lines[0], COMPARED_LINE, `unexpected base result: ${lines[0]}`);
    assert.match(lines[1], MATCH_LINE);
    assert.equal(await realLockText(), before);
  },
);
