import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// WP74-S1/S2/S4: the wizard (and creating the business) runs before a business exists, so its capability
// guard is the signed-in owner (C-AUTHZ `requireCurrentPlatformUser*`) plus a
// session ownership check, not `requireBusinessAccess`. Every public function
// must still call the C-OPS feature gate directly.

const root = fileURLToPath(new URL("../../", import.meta.url));
const WIZARD_FILES = ["convex/workspace/wizard.ts", "convex/workspace/signals.ts", "convex/workspace/business.ts"];
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

// Exact map: entry points take the signed-in user; every function on an
// existing session takes the session-ownership guard (`ownedWizardSession`,
// swapped for C-AUTHZ `requireOwnedWizardSession` once Codex adds it).
const SESSION_GUARDS = ["ownedWizardSession", "requireOwnedWizardSession"];
const EXPECTED = new Map([
  ["convex/workspace/wizard.ts:getWizardAccess", USER_GUARDS],
  ["convex/workspace/wizard.ts:startOrResume", USER_GUARDS],
  ["convex/workspace/wizard.ts:getSession", SESSION_GUARDS],
  ["convex/workspace/wizard.ts:saveStep", SESSION_GUARDS],
  ["convex/workspace/wizard.ts:skipStep", SESSION_GUARDS],
  ["convex/workspace/wizard.ts:rewriteStep", SESSION_GUARDS],
  ["convex/workspace/wizard.ts:goBack", SESSION_GUARDS],
  // WP74-S4: creating the business is the last pre-business call.
  ["convex/workspace/business.ts:createBusiness", SESSION_GUARDS],
]);

test("every public wizard function has the feature gate, its exact guard and a returns validator", async () => {
  const seen = [];
  for (const relative of WIZARD_FILES) {
    const file = await parse(relative);
    for (const registration of publicRegistrations(file)) {
      const key = `${relative}:${registration.name}`;
      seen.push(key);
      const guards = EXPECTED.get(key);
      assert.ok(guards, `${key} is a public wizard function missing from the guard map`);
      assert.ok(registration.calls.has("assertFeatureEnabled"), `${key} missing assertFeatureEnabled`);
      assert.ok(guards.some((guard) => registration.calls.has(guard)), `${key} missing ${guards.join(" or ")}`);
      assert.ok(registration.hasReturns, `${key} missing a returns validator`);
    }
  }
  assert.deepEqual(seen.sort(), [...EXPECTED.keys()].sort());
});

test("the local session guard authenticates the user and checks ownership", async () => {
  const file = await parse("convex/workspace/wizard.ts");
  const fn = file.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "ownedWizardSession");
  if (!fn) return; // Replaced by the C-AUTHZ helper: authz.ts owns this guarantee then.
  const text = fn.getText(file);
  assert.match(text, /requireCurrentPlatformUserForMutation\(ctx\)/);
  assert.match(text, /requireCurrentPlatformUser\(ctx\)/);
  assert.match(text, /session\.ownerId !== user\._id/);
  // Even the linked-session path (WP74-S4) refuses an abandoned session.
  assert.match(text, /session\.abandonedAt === undefined/);
});

test("createBusiness checks the account before writing and never writes business_members (Codex item h)", async () => {
  const source = await readFile(path.join(root, "convex/workspace/business.ts"), "utf8");
  const insert = source.indexOf('ctx.db.insert("projects"');
  for (const guard of ["isVerified(user)", "isDisposableEmailDomain(", "BUSINESS_LIMIT_REACHED", "pickTenantSlug(", "wizardAnswersSchema.safeParse("]) {
    const at = source.indexOf(guard);
    assert.ok(at !== -1 && at < insert, `${guard} must run before the project insert`);
  }
  assert.doesNotMatch(source, /insert\("business_members"/);
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
