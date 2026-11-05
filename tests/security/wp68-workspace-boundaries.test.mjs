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

test("every Phase 0 table has a flat validator, owner field and owner-first index", async () => {
  let count = 0;
  for (const domain of schemaModules) {
    const file = await parse(`convex/schema/${domain}.ts`);
    for (const table of tableDefinitions(file)) {
      count += 1;
      const { fields, indexes } = schemaCallChain(table.initializer, file);
      const ownerField = fields.find((field) => field.name?.getText(file) === "ownerId");
      assert.ok(ownerField, `${table.name} missing ownerId`);
      assert.doesNotMatch(ownerField.initializer.getText(file), /\bv\.optional\s*\(/, `${table.name}.ownerId must be required`);
      assert.ok(indexes.some((index) => index.fields[0] === "ownerId"), `${table.name} missing owner-first index`);
      for (const index of indexes) {
        assert.ok(index.name?.startsWith("by_"), `${table.name} has an unnamed index`);
      }
    }
  }
  assert.equal(count, 26, "the complete architecture §4.2 table inventory must be present");
});

test("every WP68 public Convex function checks a super-admin or business capability", async () => {
  const file = await parse("convex/ops/settings.ts");
  const publicFunctions = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isCallExpression(declaration.initializer)) continue;
      if (!ts.isIdentifier(declaration.initializer.expression)) continue;
      if (!["query", "mutation", "action"].includes(declaration.initializer.expression.text)) continue;
      publicFunctions.push(declaration.name.getText(file));
      const functionBody = declaration.initializer.getText(file);
      assert.match(functionBody, /\b(requireSuperAdmin|requireBusinessAccess)\s*\(/, `${declaration.name.getText(file)} missing an authorization guard`);
    }
  }
  assert.deepEqual(publicFunctions.sort(), ["readForAdmin", "setCohortMember", "updateForAdmin"]);
});

async function sourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "_generated") files.push(...await sourceFiles(relative));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(relative);
    }
  }
  return files;
}

test("provider SDKs may be imported only by AI provider adapters", async () => {
  const offenders = [];
  for (const relative of await sourceFiles("convex")) {
    const file = await parse(relative);
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (!/^(@anthropic-ai\/sdk|openai|@google\/generative-ai)$/.test(specifier)) continue;
      if (!relative.startsWith(path.join("convex", "ai", "providers") + path.sep)) {
        offenders.push(`${relative}: ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
