import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function publicFunctions(path) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  return [...source.matchAll(/export const\s+(\w+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\s*\(/g)]
    .filter((match) => !match[2].startsWith("internal"))
    .map((match) => match[1])
    .sort();
}

test("lead privacy and retention expose only the reviewed public functions", async () => {
  assert.deepEqual(await publicFunctions("convex/platform/sites/leads.ts"), [
    "deleteContact", "exportPage", "listForProject", "recordSynthetic",
  ]);
  assert.deepEqual(await publicFunctions("convex/platform/sites/retention.ts"), [
    "requestBusinessDeletion",
  ]);
});
