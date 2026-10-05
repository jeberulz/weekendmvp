import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../convex");
const validPart = /^[A-Za-z0-9_.]+$/u;

async function sourcePaths(dir, parts = []) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "_generated") continue;
    const next = [...parts, entry.name];
    if (entry.isDirectory()) paths.push(...await sourcePaths(path.join(dir, entry.name), next));
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name)) paths.push(next);
  }
  return paths;
}

test("Convex source module paths contain only deployment-supported characters", async () => {
  const invalid = (await sourcePaths(root))
    .filter((parts) => parts.some((part) => !validPart.test(part)))
    .map((parts) => parts.join("/"));
  assert.deepEqual(invalid, []);
});
