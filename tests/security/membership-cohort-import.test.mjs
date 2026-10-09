import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import * as convexHash from "../../convex/platform/membership/cohortHash.ts";
import {
  BATCH_SIZE,
  batchIdFor,
  chunk,
  cohortEmailHash,
  hashAddresses,
  normalizeCohortEmail,
  parseAddresses,
} from "../../scripts/lib/cohort-import.mjs";

// WP63-S7. The cohort import never prints, logs or sends an address, hashes
// exactly as Convex does, and refuses to apply without the dry run's batch
// id, a backup and the exact target.

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const script = path.join(root, "scripts", "membership-import-cohorts.mjs");

async function importScript(args, env = {}) {
  try {
    const { stdout, stderr } = await run(process.execPath, [script, ...args], {
      cwd: root,
      env: { PATH: process.env.PATH, ...env },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

async function privateList(text) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wp63-cohort-"));
  const file = path.join(dir, "list.csv");
  await writeFile(file, text);
  return { dir, file };
}

test("the script hashes exactly as Convex does", async () => {
  for (const sample of ["buyer@example.test", "  Buyer@Example.TEST ", "ｂｕｙｅｒ@example.test", "x+tag@y.zz"]) {
    assert.equal(normalizeCohortEmail(sample), convexHash.normalizeCohortEmail(sample));
    assert.equal(cohortEmailHash(sample), await convexHash.cohortEmailHash(sample));
  }
});

test("a plain list or a CSV with an email column, with blanks, bad rows and repeats counted", () => {
  const plain = parseAddresses("a@example.test\n\nB@Example.test\nnot-an-email\na@example.test\n");
  assert.deepEqual(plain, { rows: 4, valid: ["a@example.test", "b@example.test"], invalid: 1, duplicates: 1 });
  const csv = parseAddresses('name,email\n"Ada","ada@example.test"\nBob,BOB@example.test\nNo Email,\n');
  assert.deepEqual(csv, { rows: 3, valid: ["ada@example.test", "bob@example.test"], invalid: 1, duplicates: 0 });
});

test("the batch id fingerprints the whole list, whatever the order", () => {
  const one = hashAddresses(["a@example.test", "b@example.test"]);
  const two = hashAddresses(["B@example.test", "a@example.test", "a@example.test"]);
  assert.deepEqual(one, two);
  assert.match(batchIdFor("buyers", one), /^buyers-[0-9a-f]{16}$/);
  assert.equal(batchIdFor("buyers", one), batchIdFor("buyers", two));
  assert.notEqual(batchIdFor("buyers", one), batchIdFor("buyers", hashAddresses(["a@example.test"])));
  assert.notEqual(batchIdFor("buyers", one), batchIdFor("newsletter", one).replace("newsletter", "buyers").slice(0, 7) + "x");
  assert.throws(() => batchIdFor("everyone", one));
  assert.deepEqual(chunk(Array.from({ length: 401 }, (_, index) => index)).map((part) => part.length), [200, 200, 1]);
  assert.equal(BATCH_SIZE, 200);
});

test("the dry run prints counts and a batch id, never an address", async () => {
  const { dir, file } = await privateList("Ada.Lovelace@example.test\nbob.builder@example.test\nada.lovelace@example.test\nnope\n");
  try {
    const result = await importScript(["--cohort=buyers", `--file=${file}`]);
    assert.equal(result.code, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.unique, 2);
    assert.equal(summary.duplicates, 1);
    assert.equal(summary.invalid, 1);
    assert.equal(summary.action, "dry run only");
    assert.match(summary.batchId, /^buyers-[0-9a-f]{16}$/);
    const output = result.stdout + result.stderr;
    assert.doesNotMatch(output, /@|lovelace|builder|example\.test/i);
    assert.doesNotMatch(output, /[0-9a-f]{64}/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a list inside the repository, outside tmp/, is refused", async () => {
  const result = await importScript(["--cohort=buyers", "--file=package.json"]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /outside the repository or under its ignored tmp\/ directory/);
});

test("apply needs the exact batch id, then a backup, then the exact target", async () => {
  const { dir, file } = await privateList("a@example.test\n");
  try {
    const dry = JSON.parse((await importScript(["--cohort=newsletter", `--file=${file}`])).stdout);
    const base = ["--cohort=newsletter", `--file=${file}`, "--apply"];

    const noConfirm = await importScript(base);
    assert.match(noConfirm.stderr, /--confirm must match this dry run's exact batch id/);

    const wrongConfirm = await importScript([...base, "--confirm=newsletter-0000000000000000"]);
    assert.match(wrongConfirm.stderr, /--confirm must match/);

    const noBackup = await importScript([...base, `--confirm=${dry.batchId}`]);
    assert.match(noBackup.stderr, /provide a verified backend backup/);

    const backup = path.join(dir, "backup.zip");
    await writeFile(backup, "backup");
    const wrongTarget = await importScript([...base, `--confirm=${dry.batchId}`, `--backup=${backup}`, "--target=other"], {
      MEMBERSHIP_COHORT_CONVEX_URL: "https://real-name-123.convex.cloud",
      MEMBERSHIP_COHORT_ADMIN_KEY: "test-admin-key",
    });
    assert.match(wrongTarget.stderr, /set the exact MEMBERSHIP_COHORT_CONVEX_URL/);
    for (const refused of [noConfirm, wrongConfirm, noBackup, wrongTarget]) {
      assert.notEqual(refused.code, 0);
      assert.doesNotMatch(refused.stdout + refused.stderr, /a@example\.test/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the script never prints the parsed list or an address", async () => {
  const source = await readFile(script, "utf8");
  const calls = source.split("console.").slice(1).map((call) => call.slice(0, call.indexOf(");\n")));
  assert.equal(calls.length, 2, "one dry-run summary and one apply summary");
  for (const call of calls) {
    // Counts only: `hashes.length` and `chunk(hashes).length` are numbers, never the list.
    assert.doesNotMatch(call, /parsed\.valid|email|address|\bhashes\b(?!\)?\.length)/);
  }
  assert.deepEqual(source.match(/parsed\.valid(?:\.length)?/g), ["parsed.valid.length", "parsed.valid"]);
  assert.match(source, /client\.mutation\(internal\.platform\.membership\.cohorts\.importBatch, \{ cohort, batchId, emailHashes \}\)/);
});
