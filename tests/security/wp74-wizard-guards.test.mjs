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
      let handler = null;
      const options = init.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        hasReturns = options.properties.some((p) => p.name?.getText(file) === "returns");
        const prop = options.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(file) === "handler");
        handler = prop?.initializer ?? null;
      }
      const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.add(node.expression.text);
        ts.forEachChild(node, visit);
      };
      visit(init);
      out.push({ name: declaration.name.getText(file), calls, hasReturns, handler });
    }
  }
  return out;
}

/** Every call to `name` anywhere under `node`. */
function callsNamed(node, name) {
  const found = [];
  const visit = (child) => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === name) found.push(child);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function readsDb(node) {
  let found = false;
  const visit = (child) => {
    if (ts.isPropertyAccessExpression(child) && child.name.text === "db") found = true;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/**
 * The session guard, checked strictly: the handler's block body holds exactly
 * one `requireOwnedWizardSession` call, as the unconditional top-level
 * statement `const session = await requireOwnedWizardSession(ctx, args.sessionId[, { allowLinked: true }])`,
 * and nothing before it reads `ctx.db`. The third argument, when present, must
 * be an inline object whose only property is `allowLinked: true` (no
 * shorthand, spread or identifier). Returns whether `allowLinked` was passed.
 */
function sessionGuard(key, handler, file) {
  assert.ok(handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)), `${key} handler must be an inline function`);
  assert.ok(handler.body && ts.isBlock(handler.body), `${key} handler must have a block body`);
  const guards = callsNamed(handler, "requireOwnedWizardSession");
  assert.equal(guards.length, 1, `${key} must call requireOwnedWizardSession exactly once`);
  const [guard] = guards;
  const statements = handler.body.statements;
  const index = statements.findIndex((statement) => {
    if (!ts.isVariableStatement(statement)) return false;
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) return false;
    const [declaration, ...rest] = statement.declarationList.declarations;
    return rest.length === 0 && ts.isIdentifier(declaration.name) && declaration.name.text === "session" &&
      declaration.initializer !== undefined && ts.isAwaitExpression(declaration.initializer) &&
      declaration.initializer.expression === guard;
  });
  assert.ok(index !== -1, `${key} must assign the guard unconditionally at the top level: const session = await requireOwnedWizardSession(...)`);
  for (const earlier of statements.slice(0, index)) {
    assert.ok(!readsDb(earlier), `${key} reads ctx.db before the session guard`);
  }
  const [ctxArg, idArg, options, ...extra] = guard.arguments;
  assert.equal(extra.length, 0, `${key} passes extra arguments to the session guard`);
  assert.ok(ctxArg && ts.isIdentifier(ctxArg) && ctxArg.text === "ctx", `${key} guard must take ctx`);
  assert.equal(idArg?.getText(file), "args.sessionId", `${key} guard must take args.sessionId`);
  if (options === undefined) return false;
  assert.ok(ts.isObjectLiteralExpression(options) && options.properties.length === 1, `${key} guard options must be an inline { allowLinked: true }`);
  const [property] = options.properties;
  assert.ok(
    ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === "allowLinked" &&
      property.initializer.kind === ts.SyntaxKind.TrueKeyword,
    `${key} guard options must be exactly { allowLinked: true }`,
  );
  return true;
}

// Exact map: entry points take the signed-in user; every function on an
// existing session takes C-AUTHZ `requireOwnedWizardSession` (the local
// `ownedWizardSession` stand-in was removed once #209 merged).
const SESSION_GUARDS = ["requireOwnedWizardSession"];
// Only these may accept a session that already made its business.
const ALLOW_LINKED = new Set(["convex/workspace/wizard.ts:getSession", "convex/workspace/business.ts:createBusiness"]);
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
      if (guards === SESSION_GUARDS) {
        const allowLinked = sessionGuard(key, registration.handler, file);
        assert.equal(allowLinked, ALLOW_LINKED.has(key), `${key} allowLinked must be ${ALLOW_LINKED.has(key)}`);
      }
    }
  }
  assert.deepEqual(seen.sort(), [...EXPECTED.keys()].sort());
});

test("the session guard is the shared C-AUTHZ helper, with no local stand-in", async () => {
  for (const relative of ["convex/workspace/wizard.ts", "convex/workspace/business.ts"]) {
    const file = await parse(relative);
    const local = file.statements.find((s) => ts.isFunctionDeclaration(s) && /WizardSession$/.test(s.name?.text ?? ""));
    assert.equal(local, undefined, `${relative} defines its own wizard session guard`);
    const imported = file.statements.some((s) =>
      ts.isImportDeclaration(s) &&
      s.moduleSpecifier.getText(file) === '"../platform/authz"' &&
      /\brequireOwnedWizardSession\b/.test(s.importClause?.getText(file) ?? ""));
    assert.ok(imported, `${relative} must import requireOwnedWizardSession from ../platform/authz`);
  }
});

test("createBusiness checks the account before writing and never writes business_members (Codex item h)", async () => {
  const source = await readFile(path.join(root, "convex/workspace/business.ts"), "utf8");
  const insert = source.indexOf('ctx.db.insert("projects"');
  for (const guard of [
    "isVerified(user)",
    "emailAddressDomain(",
    "EMAIL_INVALID",
    "isDisposableEmailDomain(",
    "BUSINESS_LIMIT_REACHED",
    "pickTenantSlug(",
    "NAME_RESERVED",
    "wizardAnswersSchema.safeParse(",
  ]) {
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
