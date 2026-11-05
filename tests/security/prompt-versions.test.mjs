/**
 * WP71-S3. The prompt-version check runs in `npm test` (through the
 * `test:security` glob) until a `check:prompt-versions` script and CI step
 * exist. It proves the check passes on the committed lock, and that it fails
 * on a text, task or schema change with no version bump. Mutations happen on
 * in-memory entries and on temp copies of the lock; no real file changes.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { definePromptSpec } from "../../lib/workspace/contracts/prompts.ts";
import { promptEntry } from "../../convex/ai/prompts/entry.ts";
import { registryProbeSpec } from "../../convex/ai/prompts/registryProbe.ts";
import { listEntries } from "../../convex/ai/registry.ts";
import {
  checkPromptVersions,
  currentHashes,
  DEFAULT_LOCK_PATH,
  parseLock,
  serializeLock,
  withAdditions,
} from "../../scripts/check-prompt-versions.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const script = path.join(root, "scripts/check-prompt-versions.mjs");
const PROBE_REF = "internal-registry-probe@1";
const SAMPLE = { sampleInputs: { label: "registry probe sample" }, internal: true };

async function realLock() {
  return parseLock(await readFile(DEFAULT_LOCK_PATH, "utf8"));
}

function probeWith(overrides) {
  return promptEntry(definePromptSpec({ ...registryProbeSpec, ...overrides }), SAMPLE);
}

function kinds(result) {
  return result.problems.map((problem) => `${problem.kind} ${problem.ref}`);
}

function runCli(args) {
  return spawnSync(process.execPath, ["--no-warnings", "--experimental-strip-types", script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("the committed lock matches every registered prompt", async () => {
  const result = checkPromptVersions(currentHashes(), await realLock());
  assert.deepEqual(result.problems, []);
  assert.ok(Object.keys(currentHashes()).length >= 1);
});

test("the CLI exits 0 on the committed lock", () => {
  const run = runCli([]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /match the lock/);
});

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
  assert.deepEqual(currentHashes([reordered]), currentHashes(listEntries()));
});

test("a system text change without a version bump fails and names the part", async () => {
  const entries = [probeWith({ system: `${registryProbeSpec.system} Be brief.` })];
  const result = checkPromptVersions(currentHashes(entries), await realLock());
  assert.deepEqual(kinds(result), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(result.problems[0].message, /system changed without a version bump/);
  assert.match(result.problems[0].message, /internal-registry-probe@2/);
});

test("a task template change without a version bump fails", async () => {
  const entries = [probeWith({ buildUser: (inputs) => `Echo this label: ${inputs.label}` })];
  const result = checkPromptVersions(currentHashes(entries), await realLock());
  assert.deepEqual(kinds(result), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(result.problems[0].message, /^internal-registry-probe@1: task changed/);
});

test("a constant the template reads is caught through the sample render", async () => {
  // Same source text as the probe's `buildUser`, different value behind it.
  const entry = promptEntry(registryProbeSpec, { ...SAMPLE, sampleInputs: { label: "a different sample" } });
  const result = checkPromptVersions(currentHashes([entry]), await realLock());
  assert.deepEqual(kinds(result), [`changed_without_bump ${PROBE_REF}`]);
});

test("an output schema change without a version bump fails", async () => {
  const entries = [probeWith({ outputSchema: z.object({ echo: z.string().min(1).max(100) }) })];
  const result = checkPromptVersions(currentHashes(entries), await realLock());
  assert.deepEqual(kinds(result), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(result.problems[0].message, /outputSchema changed/);
});

test("a run setting change without a version bump fails", async () => {
  const entries = [probeWith({ maxTokens: 512 })];
  const result = checkPromptVersions(currentHashes(entries), await realLock());
  assert.deepEqual(kinds(result), [`changed_without_bump ${PROBE_REF}`]);
  assert.match(result.problems[0].message, /run changed/);
});

test("a bumped version is unlocked until --write adds it, then passes", async () => {
  const lock = await realLock();
  const entries = [...listEntries(), probeWith({ version: 2, system: `${registryProbeSpec.system} v2.` })];
  const first = checkPromptVersions(currentHashes(entries), lock);
  assert.deepEqual(kinds(first), ["unlocked internal-registry-probe@2"]);

  const next = withAdditions(lock, first.additions);
  assert.equal(next.prompts[PROBE_REF].hash, lock.prompts[PROBE_REF].hash, "an existing hash is never rewritten");
  assert.deepEqual(checkPromptVersions(currentHashes(entries), next).problems, []);
  assert.throws(() => withAdditions(next, first.additions), /refusing to overwrite/);
});

test("a new version at or below a locked version fails", async () => {
  const lock = await realLock();
  const v3 = probeWith({ version: 3, system: `${registryProbeSpec.system} v3.` });
  const withV3 = withAdditions(lock, currentHashes([v3]));
  const v2 = probeWith({ version: 2, system: `${registryProbeSpec.system} v2.` });
  const result = checkPromptVersions(currentHashes([...listEntries(), v2, v3]), withV3);
  assert.deepEqual(kinds(result), ["version_not_increasing internal-registry-probe@2"]);
});

test("a removed spec fails without a retired note and passes with one", async () => {
  const lock = await realLock();
  const removed = checkPromptVersions({}, lock);
  assert.deepEqual(kinds(removed), [`removed_without_note ${PROBE_REF}`]);

  const retired = { ...lock, prompts: { [PROBE_REF]: { ...lock.prompts[PROBE_REF], retired: "test: retired" } } };
  assert.deepEqual(checkPromptVersions({}, retired).problems, []);
  assert.deepEqual(kinds(checkPromptVersions(currentHashes(), retired)), [`retired_ref_reused ${PROBE_REF}`]);
});

test("a malformed lock is refused with a clear message", () => {
  assert.throws(() => parseLock("{"), /not valid JSON/);
  assert.throws(() => parseLock(JSON.stringify({ format: 1, algorithm: "sha256", prompts: { "Bad@1": { hash: "x" } } })), /not an id@version/);
  assert.throws(() => parseLock(JSON.stringify({ format: 1, algorithm: "sha256", prompts: { "a@1": { hash: "x" } } })), /sha256 hash/);
  assert.throws(
    () => parseLock(JSON.stringify({ format: 1, algorithm: "sha256", prompts: { "a@1": { hash: `sha256:${"0".repeat(64)}`, retired: "" } } })),
    /retired must be a non-empty note/,
  );
});

test("the CLI exits 1 on a changed hash, and --write then leaves the lock untouched", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wp71-prompt-lock-"));
  try {
    const lock = await realLock();
    const tampered = structuredClone(lock);
    // The lock records other content than the registry now has: the same as
    // editing the prompt and keeping its version.
    tampered.prompts[PROBE_REF].hash = `sha256:${"0".repeat(64)}`;
    tampered.prompts[PROBE_REF].parts.system = `sha256:${"0".repeat(64)}`;
    const lockPath = path.join(dir, "versions.lock.json");
    const text = serializeLock(tampered);
    await writeFile(lockPath, text, "utf8");

    const check = runCli(["--lock", lockPath]);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /\[changed_without_bump\] internal-registry-probe@1: system changed without a version bump/);

    const write = runCli(["--write", "--lock", lockPath]);
    assert.equal(write.status, 1);
    assert.match(write.stderr, /nothing written/);
    assert.equal(await readFile(lockPath, "utf8"), text);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the CLI --write locks a missing lock file and the result then passes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wp71-prompt-lock-"));
  try {
    const lockPath = path.join(dir, "versions.lock.json");
    assert.equal(runCli(["--lock", lockPath]).status, 1, "check mode needs a lock file");
    const write = runCli(["--write", "--lock", lockPath]);
    assert.equal(write.status, 0, write.stderr);
    assert.equal(await readFile(lockPath, "utf8"), await readFile(DEFAULT_LOCK_PATH, "utf8"));
    assert.equal(runCli(["--lock", lockPath]).status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
