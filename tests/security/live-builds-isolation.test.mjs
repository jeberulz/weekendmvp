import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// WP63-S8. Static pins: only the operator module writes `live_builds`, it
// registers nothing public, and the member query never writes or reads the
// clock, so a browser clock cannot open a join link early.

const root = fileURLToPath(new URL("../../", import.meta.url));
const QUERY = path.join("convex", "platform", "liveBuilds.ts");
const OPERATOR = path.join("convex", "platform", "liveBuildsOperator.ts");
const RULES = path.join("convex", "platform", "liveBuildRules.ts");

function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function read(relativePath) {
  return code(await readFile(path.join(root, relativePath), "utf8"));
}

async function sourceFiles(relativeDir) {
  const out = [];
  async function walk(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_generated" || entry.name === "node_modules") continue;
        await walk(next);
      } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.[a-z]+$/.test(entry.name)) {
        out.push(next);
      }
    }
  }
  await walk(relativeDir);
  return out;
}

const WRITE = /ctx\.db\.(insert|patch|replace|delete)\(/;
const PUBLIC_REGISTRATION = /(?<![.\w])(query|mutation|action|httpAction)\(/;

// The gated feature is also called "live_builds", so match table access, not the bare string.
const TABLE_ACCESS = /\.(query|insert|patch|replace|delete|get)\(\s*"live_builds"|Doc<"live_builds">|v\.id\("live_builds"\)/;

test("only the member query and the operator module touch the table", async () => {
  const allowed = new Set([QUERY, OPERATOR]);
  const offenders = [];
  for (const dir of ["app", "components", "lib", "convex", "scripts"]) {
    for (const file of await sourceFiles(dir)) {
      if (!allowed.has(file) && TABLE_ACCESS.test(await read(file))) offenders.push(file);
    }
  }
  assert.deepEqual(offenders, []);
  assert.match(await read(QUERY), TABLE_ACCESS);
  assert.match(await read(OPERATOR), TABLE_ACCESS);
});

test("the member query is read-only, clock-free and public", async () => {
  const source = await read(QUERY);
  assert.doesNotMatch(source, WRITE);
  assert.doesNotMatch(source, /Date\.now\(|new Date\(|internalMutation|mutation\(/);
  assert.match(source, /export const list = query\(/);
  assert.match(source, /getEntitlements\(ctx, user\._id\)/);
  assert.match(source, /joinUrl: entitled && hasJoinLink \?/);
  assert.match(source, /replayUrl: entitled && hasReplay \?/);
});

test("the operator module writes but registers nothing public, and names every table it writes", async () => {
  const source = await read(OPERATOR);
  assert.match(source, WRITE);
  assert.doesNotMatch(source, PUBLIC_REGISTRATION);
  const writes = source.match(/ctx\.db\.(insert|patch|replace|delete)\(/g) ?? [];
  const named = source.match(/ctx\.db\.(insert|patch|replace|delete)\(\s*"live_builds"/g) ?? [];
  assert.equal(named.length, writes.length);
  assert.match(source, /ctx\.scheduler\.runAt\(at, internal\.platform\.liveBuildsOperator\.advance, \{ id \}\)/);
});

test("the rules module is pure", async () => {
  const source = await read(RULES);
  assert.doesNotMatch(source, /ctx\.|Date\.now\(|_generated/);
});
