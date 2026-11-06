import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// WP77-S4: Wren's tools create cards only (D13, D23). This static scan holds
// the line structurally, on top of the runtime corpus in
// `convex/workspace/wrenTools.test.ts`.
//
// Tool registry and handlers (strict): `lib/workspace/contracts/wrenTools.ts`,
// `lib/workspace/wrenCards.ts`, `convex/workspace/wrenCards.ts`.
// 1. Imports come from a fixed allowlist (and only the named bindings listed).
// 2. No call or property reference to anything that sends, posts, publishes,
//    launches, spends, debits, refunds, touches a ledger or connector,
//    decides an approval, schedules, runs an action or mutation, fetches,
//    or patches / replaces / deletes a row.
// 3. `db.insert` only into `audit_events` (the pending card itself is
//    inserted by S1's `createApprovalRecord`, which the handler only calls
//    after proving the subject has no live card).
//
// Chat modules (`convex/workspace/chat.ts`, `chatActions.ts`):
// 4. No reference to approval decisions, revision tasks, debits, refunds,
//    ledgers, publishers, senders or connectors, and no import from
//    `convex/platform/ledger*`, `convex/growth/**` or `convex/ai/metering`
//    beyond what they already need (none).
// 5. `scheduler.runAfter` only schedules `internal.workspace.chatActions.runWrenTurn`,
//    `runAction` only calls `internal.ai.gatewayActions.runPrompt`, and
//    `runMutation` / `runQuery` only reach `internal.workspace.chat.*`.

const root = fileURLToPath(new URL("../../", import.meta.url));

const STRICT_FILES = {
  "lib/workspace/contracts/wrenTools.ts": new Map(),
  "lib/workspace/wrenCards.ts": new Map([["./contracts/wrenTools", null]]),
  "convex/workspace/wrenCards.ts": new Map([
    ["convex/values", ["ConvexError", "v", "Infer"]],
    ["../_generated/dataModel", ["Doc", "Id"]],
    ["../_generated/server", ["MutationCtx", "QueryCtx"]],
    ["../../lib/workspace/wrenCards", null],
    ["./approvals", ["approvalKindValidator", "approvalStatusValidator", "createApprovalRecord"]],
  ]),
};

const CHAT_FILES = ["convex/workspace/chat.ts", "convex/workspace/chatActions.ts"];

/** Names a tool handler must never call or reference. */
const STRICT_FORBIDDEN =
  /^(decideApproval|insertRevisionTask|assertPaidRevisionApproved|activateSequence|publishLanding|debit\w*|refund\w*|\w*ledger\w*|\w*connector\w*|send\w*|publish\w*|post[A-Z]\w*|launch\w*|scheduler|runAction|runMutation|runQuery|runAfter|runAt|fetch|patch|replace|delete|checkLimit|internal|api)$/i;

/** Names the chat modules must never call or reference. */
const CHAT_FORBIDDEN =
  /^(decideApproval|insertRevisionTask|assertPaidRevisionApproved|activateSequence|publishLanding|debit\w*|refund\w*|\w*ledger\w*|\w*connector\w*|sendEmail\w*|sendOutbound\w*|postSocial\w*|launchAd\w*)$/i;

const CHAT_FORBIDDEN_IMPORTS = [/platform\/ledger/u, /\/growth\//u, /ai\/metering/u, /ai\/budgets/u, /platform\/billing/u];

function parse(fileName, source) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/** Identifiers used as a call target or a property reference (not object-literal keys or types). */
function referencedNames(sourceFile) {
  const names = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) names.push({ name: callee.text, node });
      else if (ts.isPropertyAccessExpression(callee)) names.push({ name: callee.name.text, node });
    }
    if (ts.isPropertyAccessExpression(node)) names.push({ name: node.name.text, node });
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
      names.push({ name: node.argumentExpression.text, node });
    }
    if (ts.isIdentifier(node) && !ts.isPropertyAssignment(node.parent) && !ts.isTypeReferenceNode(node.parent) &&
      !ts.isPropertyAccessExpression(node.parent) && !ts.isImportSpecifier(node.parent)) {
      names.push({ name: node.text, node });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function imports(sourceFile) {
  const out = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = [];
    const clause = statement.importClause;
    if (clause?.name) bindings.push(clause.name.text);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) bindings.push((element.propertyName ?? element.name).text);
    }
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bindings.push("*");
    out.push({ from: statement.moduleSpecifier.text, bindings });
  }
  return out;
}

function line(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/** Violations of rules 1-3 for one tool registry / handler file. */
export function scanStrict(fileName, source, allowedImports) {
  const sourceFile = parse(fileName, source);
  const problems = [];
  for (const { from, bindings } of imports(sourceFile)) {
    const normalized = from.replace(/\.ts$/u, "");
    if (!allowedImports.has(normalized)) {
      problems.push(`${fileName}: import from ${from} is not allowed`);
      continue;
    }
    const allowed = allowedImports.get(normalized);
    if (allowed === null) continue;
    for (const binding of bindings) {
      if (!allowed.includes(binding)) problems.push(`${fileName}: import ${binding} from ${from} is not allowed`);
    }
  }
  for (const { name, node } of referencedNames(sourceFile)) {
    if (STRICT_FORBIDDEN.test(name)) problems.push(`${fileName}:${line(sourceFile, node)} references ${name}`);
  }
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "insert") {
      const table = node.arguments[0];
      if (!table || !ts.isStringLiteral(table) || table.text !== "audit_events") {
        problems.push(`${fileName}:${line(sourceFile, node)} inserts into ${table ? table.getText(sourceFile) : "?"}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...new Set(problems)];
}

/** Violations of rules 4-5 for one chat module. */
export function scanChat(fileName, source) {
  const sourceFile = parse(fileName, source);
  const problems = [];
  for (const { from } of imports(sourceFile)) {
    if (CHAT_FORBIDDEN_IMPORTS.some((pattern) => pattern.test(from))) problems.push(`${fileName}: import from ${from}`);
  }
  for (const { name, node } of referencedNames(sourceFile)) {
    if (CHAT_FORBIDDEN.test(name)) problems.push(`${fileName}:${line(sourceFile, node)} references ${name}`);
  }
  const targets = {
    runAfter: (args) => args[1]?.getText(sourceFile) === "internal.workspace.chatActions.runWrenTurn",
    runAt: () => false,
    runAction: (args) => args[0]?.getText(sourceFile) === "internal.ai.gatewayActions.runPrompt",
    runMutation: (args) => /^internal\.workspace\.chat\.\w+$/u.test(args[0]?.getText(sourceFile) ?? ""),
    runQuery: (args) => /^internal\.workspace\.chat\.\w+$/u.test(args[0]?.getText(sourceFile) ?? ""),
  };
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const check = Object.prototype.hasOwnProperty.call(targets, method) ? targets[method] : undefined;
      if (check && !check(node.arguments)) {
        problems.push(`${fileName}:${line(sourceFile, node)} ${method}(${node.arguments[0]?.getText(sourceFile) ?? ""}, ...)`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...new Set(problems)];
}

test("Wren's tool registry and handlers reach no side effect", async () => {
  for (const [relative, allowed] of Object.entries(STRICT_FILES)) {
    const source = await readFile(path.join(root, relative), "utf8");
    assert.deepEqual(scanStrict(relative, source, allowed), []);
  }
});

test("the chat modules call only the gateway, their own mutations and the turn", async () => {
  for (const relative of CHAT_FILES) {
    const source = await readFile(path.join(root, relative), "utf8");
    assert.deepEqual(scanChat(relative, source), []);
  }
});

test("fixtures: the scan catches each side-effect shape", () => {
  const allowed = STRICT_FILES["convex/workspace/wrenCards.ts"];
  const offenders = {
    decide: "export async function f(ctx) { await decideApproval(ctx, {}); }",
    decideRef: "import { internal } from \"../_generated/api\"; const r = internal.workspace.approvals.decideApproval;",
    patch: "export async function f(ctx, id) { await ctx.db.patch(\"approvals\", id, { status: \"approved\" }); }",
    insert: "export async function f(ctx) { await ctx.db.insert(\"tasks\", {}); }",
    schedule: "export async function f(ctx) { await ctx.scheduler.runAfter(0, x, {}); }",
    action: "export async function f(ctx) { await ctx.runAction(x, {}); }",
    fetch: "export async function f() { await fetch(\"https://evil.example\"); }",
    debit: "export async function f(ctx) { await debitTask(ctx, {}); }",
    ledger: "import { creditLedger } from \"../platform/ledger\"; export const g = creditLedger;",
    sender: "export async function f(ctx) { await sendSequenceEmail(ctx, {}); }",
    publisher: "export async function f(ctx) { await publishLanding(ctx, {}); }",
    connector: "export async function f(ctx) { await ctx.socialConnector.post({}); }",
    importExtra: "import { assertApproved } from \"./approvals\";",
    elementAccess: "export async function f(ctx) { await ctx.db[\"patch\"](\"approvals\", id, {}); }",
  };
  for (const [label, source] of Object.entries(offenders)) {
    assert.notDeepEqual(scanStrict(`fixture-${label}.ts`, source, allowed), [], label);
  }
  assert.deepEqual(scanStrict("fixture-ok.ts", "import { v } from \"convex/values\"; export const x = v.string(); const y = { publish: 1, send: 2 };", allowed), []);

  const chatOffenders = {
    schedule: "export async function f(ctx) { await ctx.scheduler.runAfter(0, internal.growth.email.send, {}); }",
    action: "export async function f(ctx) { await ctx.runAction(internal.workspace.publish.go, {}); }",
    mutation: "export async function f(ctx) { await ctx.runMutation(internal.workspace.approvals.decideApproval, {}); }",
    ledger: "import { debitTask } from \"../platform/ledger\";",
    debit: "export async function f(ctx) { await debitTask(ctx); }",
  };
  for (const [label, source] of Object.entries(chatOffenders)) {
    assert.notDeepEqual(scanChat(`chat-${label}.ts`, source), [], label);
  }
  assert.deepEqual(scanChat("chat-ok.ts", "export async function f(ctx) { await ctx.scheduler.runAfter(0, internal.workspace.chatActions.runWrenTurn, {}); }"), []);
});
