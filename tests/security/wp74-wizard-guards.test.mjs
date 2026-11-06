import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// WP74-S1/S2: the wizard runs before a business exists, so its capability
// guard is the signed-in owner (C-AUTHZ `requireCurrentPlatformUser*`) plus a
// session ownership check, not `requireBusinessAccess`. Every public function
// must still call the C-OPS feature gate directly.

const root = fileURLToPath(new URL("../../", import.meta.url));
const WIZARD_FILES = ["convex/workspace/wizard.ts", "convex/workspace/signals.ts"];
const PUBLIC = new Set(["query", "mutation", "action", "httpAction"]);
const USER_GUARDS = ["requireCurrentPlatformUser", "requireCurrentPlatformUserForMutation"];

async function parse(relative) {
  const source = await readFile(path.join(root, relative), "utf8");
  return ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function publicRegistrations(file) {
  const out = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const init = declaration.initializer;
      if (!init || !ts.isCallExpression(init) || !ts.isIdentifier(init.expression)) continue;
      if (!PUBLIC.has(init.expression.text)) continue;
      const calls = new Set();
      let hasReturns = false;
      const options = init.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        hasReturns = options.properties.some((p) => p.name?.getText(file) === "returns");
      }
      const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.add(node.expression.text);
        ts.forEachChild(node, visit);
      };
      visit(init);
      out.push({ name: declaration.name.getText(file), calls, hasReturns });
    }
  }
  return out;
}

test("every public wizard function has a feature gate, a user guard and a returns validator", async () => {
  let count = 0;
  for (const relative of WIZARD_FILES) {
    const file = await parse(relative);
    for (const registration of publicRegistrations(file)) {
      count += 1;
      const key = `${relative}:${registration.name}`;
      assert.ok(registration.calls.has("assertFeatureEnabled"), `${key} missing assertFeatureEnabled`);
      assert.ok(USER_GUARDS.some((guard) => registration.calls.has(guard)), `${key} missing a C-AUTHZ user guard`);
      assert.ok(registration.hasReturns, `${key} missing a returns validator`);
    }
  }
  assert.ok(count >= 7, "the wizard's public functions were scanned");
});

test("no phone number field appears in the wizard code or the /start UI (D10)", async () => {
  const files = [
    ...WIZARD_FILES,
    "lib/workspace/wizard/defaults.ts",
    "lib/workspace/wizard/labels.ts",
    ...(await listFiles("components/workspace/wizard")),
    ...(await listFiles("app/start")),
  ];
  for (const relative of files) {
    const source = await readFile(path.join(root, relative), "utf8");
    // A field or input, not prose: `phone:`, `phoneNumber =`, `type="tel"`, `autoComplete="tel"`.
    assert.doesNotMatch(source, /\b(?:phone|mobile|sms)\w*\??\s*[:=]|type=["']tel["']|autoComplete=["']tel/i, `${relative} has a phone field`);
  }
});

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(relative)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(relative);
  }
  return out;
}
