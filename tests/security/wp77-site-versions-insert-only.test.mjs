import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// WP77-S1 review fix (P2-1). C-APPROVAL pins a `publish` approval to a
// `site_versions` row id, and that row has no write timestamp. So its content
// fields must be insert-only: nothing may patch or replace them, or an approved
// version could be re-pointed at other content. Status transitions
// (`status`, `publishedAt`, `retiredAt`) stay allowed. The real fix is the
// `approvals.subjectVersion` fingerprint requested from Codex; this scan holds
// the line until then.
//
// Rules over every non-test Convex module:
// 1. `db.replace("site_versions", ...)` and `db.patch("site_versions", ...)`
//    with anything but status keys are refused.
// 2. Untyped `db.patch(id, ...)` / `db.replace(id, ...)` (the table is not
//    visible statically) are refused when the value is not a plain object
//    literal, spreads, or sets a site-version content key, unless allowlisted.
// Receivers: `<expr>.db`, a bare `db`, any name typed as a database writer
// (`DatabaseWriter`, `GenericDatabaseWriter`, `MutationCtx["db"]`), a renamed
// destructure of `db` and an alias of `<expr>.db`. Computed keys count as
// non-literal. Limit: a generic wrapper taking (table, id, value) and calling
// patch on an untyped receiver is not seen.

const root = fileURLToPath(new URL("../../", import.meta.url));

const STATUS_KEYS = new Set(["status", "publishedAt", "retiredAt"]);
const CONTENT_KEYS = new Set(["documentId", "landingSpec", "storageId", "siteConfigId", "version"]);

/** `file:function` keys reviewed as not touching `site_versions`. */
const ALLOWLIST = new Map([
  ["convex/articles.ts:upsertBySlug", "articles upsert, whole-row patch of the articles table"],
  ["convex/ideas.ts:upsertBySlug", "ideas upsert, whole-row patch of the ideas table"],
  ["convex/newsletter.ts:upsertBySlug", "newsletter upsert, whole-row patch of the newsletter table"],
  ["convex/seed.ts:upsertBySlug", "content seed upsert into content tables"],
]);

function enclosingName(node, file) {
  for (let current = node.parent; current; current = current.parent) {
    if ((ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) && current.name) return current.name.getText(file);
    if (ts.isVariableDeclaration(current)) return current.name.getText(file);
  }
  return "<module>";
}

/** Literal keys of a plain object literal, or null (spread, computed key, method, non-literal). */
function objectKeys(value, file) {
  if (!value || !ts.isObjectLiteralExpression(value)) return null;
  const keys = [];
  for (const property of value.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return null;
    if (!property.name || ts.isComputedPropertyName(property.name)) return null;
    keys.push(property.name.getText(file).replace(/^["']|["']$/g, ""));
  }
  return keys;
}

const WRITER_TYPE = /\b(?:Generic)?DatabaseWriter\b|\[\s*["']db["']\s*\]/;

/**
 * Names in this file that may hold a database writer: `db`, anything typed as a
 * writer (`DatabaseWriter`, `GenericDatabaseWriter`, `MutationCtx["db"]`), a
 * renamed destructure of `db` (`const { db: w } = ctx`) and an alias of
 * `<expr>.db`. Scope-insensitive on purpose: a false positive is reviewed, a
 * miss is a hole.
 */
function writerNames(file) {
  const names = new Set(["db"]);
  function visit(node) {
    if ((ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) &&
      ts.isIdentifier(node.name)) {
      if (node.type && WRITER_TYPE.test(node.type.getText(file))) names.add(node.name.text);
      if (ts.isVariableDeclaration(node) && node.initializer &&
        ts.isPropertyAccessExpression(node.initializer) && node.initializer.name.text === "db") names.add(node.name.text);
    }
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
      const source = node.propertyName && ts.isIdentifier(node.propertyName) ? node.propertyName.text : node.name.text;
      if (source === "db") names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return names;
}

function isWriterReceiver(expression, names) {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text === "db";
  return ts.isIdentifier(expression) && names.has(expression.text);
}

/** Violations in one source file, each `file:function:line reason`. */
function scanSource(relativePath, source) {
  const file = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations = [];
  const allowedHits = new Set();
  const names = writerNames(file);
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.text === "patch" || node.expression.name.text === "replace") &&
      isWriterReceiver(node.expression.expression, names)
    ) {
      const method = node.expression.name.text;
      const [first] = node.arguments;
      const typed = first !== undefined && ts.isStringLiteralLike(first);
      const keys = objectKeys(node.arguments[typed ? 2 : 1], file);
      const where = `${relativePath}:${enclosingName(node, file)}`;
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      let reason = null;
      if (typed) {
        if (first.text === "site_versions") {
          if (method === "replace") reason = "replaces a site_versions row";
          else if (keys === null || keys.some((key) => !STATUS_KEYS.has(key))) reason = "patches site_versions beyond status keys";
        }
      } else if (method === "replace") {
        reason = "untyped replace (table not visible)";
      } else if (keys === null) {
        reason = "untyped patch with a non-literal or spread value";
      } else if (keys.some((key) => CONTENT_KEYS.has(key))) {
        reason = `untyped patch sets a site-version content key (${keys.filter((key) => CONTENT_KEYS.has(key)).join(", ")})`;
      }
      if (reason !== null) {
        if (ALLOWLIST.has(where)) allowedHits.add(where);
        else violations.push(`${where}:${line} ${reason}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { violations, allowedHits };
}

async function sourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "_generated" && entry.name !== "node_modules") files.push(...await sourceFiles(relative));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".d.ts")) {
      files.push(relative);
    }
  }
  return files;
}

test("site_versions content fields are insert-only across Convex code", async () => {
  const violations = [];
  const allowedHits = new Set();
  for (const relative of await sourceFiles("convex")) {
    const result = scanSource(relative.split(path.sep).join("/"), await readFile(path.join(root, relative), "utf8"));
    violations.push(...result.violations);
    for (const hit of result.allowedHits) allowedHits.add(hit);
  }
  assert.deepEqual(violations, [], "site_versions content must never be patched or replaced");
  for (const key of ALLOWLIST.keys()) assert.ok(allowedHits.has(key), `allowlist entry ${key} no longer matches; remove it`);
});

test("the scan catches content rewrites and allows status transitions", () => {
  const { violations } = scanSource("fixture.ts", `
    async function rewriteTyped(ctx, id) { await ctx.db.patch("site_versions", id, { documentId: "old" }); }
    async function replaceTyped(ctx, id, row) { await ctx.db.replace("site_versions", id, row); }
    async function spreadTyped(ctx, id, extra) { await ctx.db.patch("site_versions", id, { status: "ready", ...extra }); }
    async function rewriteUntyped(ctx, version) { await ctx.db.patch(version._id, { landingSpec: "{}" }); }
    async function variableUntyped(ctx, version, value) { await ctx.db.patch(version._id, value); }
    async function replaceUntyped(ctx, version, row) { await ctx.db.replace(version._id, row); }
    async function retire(ctx, version) { await ctx.db.patch(version._id, { status: "retired", retiredAt: 1 }); }
    async function retireTyped(ctx, id) { await ctx.db.patch("site_versions", id, { status: "published", publishedAt: 1 }); }
    async function otherTable(ctx, id) { await ctx.db.patch("social_posts", id, { documentId: "doc" }); }
    async function helperWriter(writer: GenericDatabaseWriter<DataModel>, id) { await writer.patch(id, { documentId: "old" }); }
    async function helperCtxDb(store: MutationCtx["db"], id) { await store.patch("site_versions", id, { landingSpec: "{}" }); }
    async function helperDb(db: DatabaseWriter, id, row) { await db.replace(id, row); }
    async function destructured(ctx, id) { const { db } = ctx; await db.patch(id, { storageId: "s" }); }
    async function renamed(ctx, id) { const { db: tx } = ctx; await tx.patch(id, { version: 9n }); }
    async function aliased(ctx, id) { const w = ctx.db; await w.patch(id, { siteConfigId: "c" }); }
    async function computedKey(ctx, id, field) { await ctx.db.patch(id, { [field]: "old" }); }
    async function computedTyped(ctx, id, field) { await ctx.db.patch("site_versions", id, { [field]: "old" }); }
    async function helperStatus(writer: GenericDatabaseWriter<DataModel>, id) { await writer.patch(id, { status: "retired" }); }
    async function notAWriter(map, id) { map.patch(id, { documentId: "x" }); }
  `);
  const offenders = violations.map((violation) => violation.split(":")[1]);
  assert.deepEqual(offenders, [
    "rewriteTyped", "replaceTyped", "spreadTyped", "rewriteUntyped", "variableUntyped", "replaceUntyped",
    "helperWriter", "helperCtxDb", "helperDb", "destructured", "renamed", "aliased", "computedKey", "computedTyped",
  ]);
});
