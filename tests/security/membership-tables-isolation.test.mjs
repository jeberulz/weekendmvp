import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Static pins for WP64-S2. The `api` proxy is empty under convex-test, so the
// rule "no public function writes a membership table" is asserted on source.

const root = fileURLToPath(new URL("../../", import.meta.url));
const MEMBERSHIP_DIR = path.join("convex", "platform", "membership");
const TABLES = [
  "billing_customers",
  "plan_subscriptions",
  "membership_orders",
  "plan_grants",
  "founding_seats",
  "billing_events",
];
// WP64-S7 adds the eligibility rules, the cohort hash and the window dates.
const READ_ONLY_MODULES = ["state.ts", "validators.ts", "offer.ts", "cohortHash.ts", "windows.ts"];

async function read(relativePath) {
  return await readFile(path.join(root, relativePath), "utf8");
}

/** Strips comments so a pinned phrase cannot be satisfied by documentation. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function sourceFiles(relativeDir, extensions = [".ts", ".tsx", ".mjs", ".js"]) {
  const out = [];
  async function walk(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_generated" || entry.name === "node_modules") continue;
        await walk(next);
      } else if (
        extensions.some((extension) => entry.name.endsWith(extension)) &&
        !/\.test\.[a-z]+$/.test(entry.name)
      ) {
        out.push(next);
      }
    }
  }
  await walk(relativeDir);
  return out;
}

const inMembership = (file) => file.startsWith(MEMBERSHIP_DIR + path.sep);
const WRITE = /ctx\.db\.(insert|patch|replace|delete)\(/g;
// `query({` registers a public function. `ctx.db.query(` is a read.
const PUBLIC_REGISTRATION = /(?<![.\w])(query|mutation|action|httpAction)\(/;

test("membership table names appear only in the schema and the membership module", async () => {
  const offenders = [];
  for (const dir of ["app", "lib", "components", "convex", "scripts"]) {
    for (const file of await sourceFiles(dir)) {
      if (file === path.join("convex", "schema.ts") || inMembership(file)) continue;
      const source = code(await read(file));
      for (const table of TABLES) {
        if (new RegExp(`["'\`]${table}["'\`]`).test(source)) offenders.push(`${file}: ${table}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("a membership file that writes registers only internal functions", async () => {
  const files = await sourceFiles(MEMBERSHIP_DIR);
  assert.ok(files.length >= 4, "expected to scan the membership module");
  let writers = 0;
  for (const file of files) {
    const source = code(await read(file));
    const writes = source.match(WRITE) ?? [];
    if (writes.length === 0) continue;
    writers += 1;
    assert.doesNotMatch(source, PUBLIC_REGISTRATION, `${file} writes, so it may not register a public function`);
    // The table is always named, so the first pin above sees every write.
    const named = source.match(/ctx\.db\.(insert|patch|replace|delete)\(\s*"[a-z_]+"/g) ?? [];
    assert.equal(named.length, writes.length, `${file}: every write names its table as a string literal`);
  }
  assert.ok(writers >= 2, "expected the seat seed and comp grants to be scanned");
});

test("membership reads are bounded: no .collect() anywhere in the module", async () => {
  for (const file of await sourceFiles(MEMBERSHIP_DIR)) {
    assert.doesNotMatch(code(await read(file)), /\.collect\(/, `${file} must use .take(n)`);
  }
});

test("state and validators are read-only and clock-free, and so is the resolver", async () => {
  for (const name of READ_ONLY_MODULES) {
    const file = path.join(MEMBERSHIP_DIR, name);
    const source = code(await read(file));
    assert.doesNotMatch(source, WRITE, `${file} must not write`);
    assert.doesNotMatch(source, /Date\.now\(|new Date\(/, `${file} must not read the clock`);
    assert.doesNotMatch(source, /internalMutation|internalAction|internalQuery/, `${file} registers nothing`);
    assert.doesNotMatch(source, PUBLIC_REGISTRATION, `${file} registers nothing`);
  }
  for (const file of ["convex/platform/planResolver.ts", "convex/platform/entitlements.ts"]) {
    assert.doesNotMatch(code(await read(file)), /Date\.now\(|new Date\(/, `${file} must not read the clock`);
  }
  assert.match(
    code(await read("convex/platform/planResolver.ts")),
    /readMembershipState\(ctx, ownerId\)\)\.plan/,
    "resolvePlan reads the membership state",
  );
});

test("outside the module, only the read-only membership modules are imported", async () => {
  const offenders = [];
  for (const dir of ["app", "lib", "components", "convex", "scripts"]) {
    for (const file of await sourceFiles(dir)) {
      if (inMembership(file)) continue;
      const source = code(await read(file));
      // Only the Convex module counts. `app/api/platform/membership/` is the route contract.
      for (const match of source.matchAll(/from\s+"((?:[^"]*convex\/platform|\.{1,2})\/membership\/([^"/]+))"/g)) {
        if (!READ_ONLY_MODULES.map((name) => name.replace(/\.ts$/, "")).includes(match[2])) {
          offenders.push(`${file}: ${match[1]}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("the client-facing billing summary has no Stripe field", async () => {
  const state = code(await read(path.join(MEMBERSHIP_DIR, "state.ts")));
  const start = state.indexOf("export const billingSummaryValidator");
  const end = state.indexOf("export type BillingSummary");
  assert.ok(start > 0 && end > start, "billingSummaryValidator must be defined in state.ts");
  assert.doesNotMatch(state.slice(start, end), /stripe|customer|livemode|orderId|ownerId/i);
  const entitlements = code(await read("convex/platform/entitlements.ts"));
  assert.match(entitlements, /billing: billingSummaryValidator/);
  assert.match(entitlements, /billing: membership\.billing/);
});
