import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const schemaModules = ["workspace", "ai", "growth"];

async function parse(relativePath) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  return ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function tableDefinitions(file) {
  const definitions = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isObjectLiteralExpression(declaration.initializer)) continue;
      for (const property of declaration.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        definitions.push({ name: property.name.getText(file), initializer: property.initializer });
      }
    }
  }
  return definitions;
}

function schemaCallChain(initializer, file) {
  const indexes = [];
  let call = initializer;
  while (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "index") {
    const indexName = call.arguments[0]?.text;
    const fields = call.arguments[1];
    assert.ok(ts.isArrayLiteralExpression(fields), "index fields must be an array literal");
    indexes.push({ name: indexName, fields: fields.elements.map((field) => field.text) });
    call = call.expression.expression;
  }
  assert.ok(ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === "defineTable", `expected defineTable in ${file.fileName}`);
  assert.ok(ts.isObjectLiteralExpression(call.arguments[0]), `expected flat table validator in ${file.fileName}`);
  return { fields: call.arguments[0].properties, indexes };
}

test("every Phase 0 table has a flat validator, D22 ownership and owner-first index", async () => {
  let count = 0;
  for (const domain of schemaModules) {
    const file = await parse(`convex/schema/${domain}.ts`);
    for (const table of tableDefinitions(file)) {
      count += 1;
      const { fields, indexes } = schemaCallChain(table.initializer, file);
      const ownerField = fields.find((field) => field.name?.getText(file) === "ownerId");
      assert.ok(ownerField, `${table.name} missing ownerId`);
      const ownerOptional = /\bv\.optional\s*\(/.test(ownerField.initializer.getText(file));
      assert.equal(ownerOptional, table.name === "ai_usage", `${table.name}.ownerId ownership follows D22`);
      assert.ok(indexes.some((index) => index.fields[0] === "ownerId"), `${table.name} missing owner-first index`);
      for (const index of indexes) {
        assert.ok(index.name?.startsWith("by_"), `${table.name} has an unnamed index`);
      }
    }
  }
  assert.equal(count, 26, "the complete architecture §4.2 table inventory must be present");
});

const WORKSPACE_RUNTIME_DIRS = ["workspace", "crew", "studio", "ai", "growth", "ops"];
const ADMIN_CONTROLS = new Set([
  "convex/ops/settings.ts:readForAdmin",
  "convex/ops/settings.ts:setCohortMember",
  "convex/ops/settings.ts:updateForAdmin",
  // Owner ruling: read-only spend monitoring stays available after shutdown.
  "convex/ops/spend.ts:readDaily",
]);
const PUBLIC_REGISTRATIONS = new Set(["query", "mutation", "action", "httpAction"]);

function publicRegistrations(file) {
  const registrations = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!ts.isCallExpression(initializer) || !ts.isIdentifier(initializer.expression)) continue;
      if (!PUBLIC_REGISTRATIONS.has(initializer.expression.text)) continue;
      const calls = new Set();
      function visit(node) {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.add(node.expression.text);
        ts.forEachChild(node, visit);
      }
      visit(initializer);
      registrations.push({ name: declaration.name.getText(file), calls });
    }
  }
  return registrations;
}

test("workspace public Convex functions check both the feature and the capability", async () => {
  const seen = [];
  for (const domain of WORKSPACE_RUNTIME_DIRS) {
    for (const relative of await sourceFiles(path.join("convex", domain))) {
      const file = await parse(relative);
      for (const registration of publicRegistrations(file)) {
        const key = `${relative}:${registration.name}`;
        seen.push(key);
        if (ADMIN_CONTROLS.has(key)) {
          assert.ok(registration.calls.has("requireSuperAdmin"), `${key} missing super-admin guard`);
          continue;
        }
        assert.ok(registration.calls.has("assertFeatureEnabled"), `${key} missing feature gate`);
        assert.ok(registration.calls.has("requireBusinessAccess") || registration.calls.has("requireSuperAdmin"), `${key} missing capability guard`);
      }
    }
  }
  for (const control of ADMIN_CONTROLS) assert.ok(seen.includes(control), `${control} was not scanned`);
});

test("workspace guard scanner ignores comments and rejects unguarded functions", () => {
  const file = ts.createSourceFile("fixture.ts", `
    export const bad = mutation({ handler: async () => {
      // assertFeatureEnabled(ctx, "workspace"); requireBusinessAccess(ctx, projectId, "owner");
      return null;
    }});
  `, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const [registration] = publicRegistrations(file);
  assert.equal(registration.name, "bad");
  assert.equal(registration.calls.has("assertFeatureEnabled"), false);
  assert.equal(registration.calls.has("requireBusinessAccess"), false);
});

async function sourceFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(path.join(root, dir), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "_generated") files.push(...await sourceFiles(relative));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(relative);
    }
  }
  return files;
}

const PROVIDER_SDK = /^(?:@anthropic-ai\/sdk|openai|@google\/generative-ai|@google\/genai|@fal-ai\/client|replicate)(?:\/|$)/;

function providerImports(file) {
  const imports = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imports.filter((specifier) => PROVIDER_SDK.test(specifier));
}

test("provider import scanner catches static, subpath, dynamic and require forms", () => {
  const source = `
    import Anthropic from "@anthropic-ai/sdk";
    import type { Client } from "@anthropic-ai/sdk/resources";
    const loaded = import("openai/resources");
    const required = require("@google/genai");
  `;
  const file = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(providerImports(file), [
    "@anthropic-ai/sdk", "@anthropic-ai/sdk/resources", "openai/resources", "@google/genai",
  ]);
});

test("provider SDKs may be imported only by AI provider adapters", async () => {
  const offenders = [];
  for (const relative of await sourceFiles("convex")) {
    const file = await parse(relative);
    for (const specifier of providerImports(file)) {
      if (!relative.startsWith(path.join("convex", "ai", "providers") + path.sep)) {
        offenders.push(`${relative}: ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
