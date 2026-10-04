import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("../../scripts/seed-convex.mjs", import.meta.url).pathname;
const target = ["--dry-run", "--deployment", "first-squirrel-244", "--only", "ideas"];

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
}

test("an exact-slug dry run prepares one idea and no other seed batches", () => {
  const result = run([...target, "--slug", "dmarc-monitor-agencies-small-business"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /idea slug: dmarc-monitor-agencies-small-business/);
  assert.match(result.stdout, /ideas: 1 total — bodyMode mdx=1/);
  assert.match(result.stdout, /ideas: 1 docs in 1 batch/);
  assert.doesNotMatch(result.stdout, /reference tables:|articles:|newsletters:/);
  assert.match(result.stdout, /dry run complete — nothing written/);
});

test("an exact-slug seed refuses ambiguous scope or an unknown idea", () => {
  for (const args of [
    ["--dry-run", "--only", "ideas", "--slug", "dmarc-monitor-agencies-small-business"],
    ["--dry-run", "--deployment", "first-squirrel-244", "--slug", "dmarc-monitor-agencies-small-business"],
    [...target, "--include-drafts", "--slug", "dmarc-monitor-agencies-small-business"],
  ]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--slug requires --only ideas and an explicit --deployment/);
  }
  const omittedTarget = run(["--dry-run", "--deployment", "--slug", "dmarc-monitor-agencies-small-business", "--only", "ideas"]);
  assert.equal(omittedTarget.status, 1);
  assert.match(omittedTarget.stderr, /--deployment requires a deployment name/);
  const missing = run([...target, "--slug", "missing-idea-slug"]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Expected exactly one public manifest idea/);
});
