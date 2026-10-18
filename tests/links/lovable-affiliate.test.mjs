import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/check-lovable-affiliate.mjs");

test("check:lovable-affiliate passes on the current tree", () => {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `expected exit 0, got ${result.status}\n${result.stdout}\n${result.stderr}`,
  );
  assert.match(result.stdout, /check:lovable-affiliate — ok/);
});
