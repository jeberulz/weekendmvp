import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { WREN_APPROVAL_SUBJECTS } from "../../lib/workspace/contracts/wrenTools.ts";

// WP77-S4: Wren's tools create cards only (D13, D23). This static scan holds
// the line structurally, on top of the runtime corpus in
// `convex/workspace/wrenTools.test.ts`. It walks the TypeScript AST.
//
// Tool registry and handlers (strict): `lib/workspace/contracts/wrenTools.ts`,
// `lib/workspace/wrenCards.ts`, `convex/workspace/wrenCards.ts`.
// S1. Imports come from a fixed allowlist, checked by the IMPORTED name (an
//     alias never hides a name), only the bindings listed.
// S2. No call or property reference to anything that sends, posts, publishes,
//     launches, spends, debits, refunds, touches a ledger or connector,
//     decides an approval, schedules, runs an action or mutation, fetches,
//     or patches / replaces / deletes a row.
// S3. `ctx.db` only as a direct method call: `get`, `query`, `normalizeId`,
//     and `insert` into the string literal `audit_events` (the pending card
//     itself is inserted by S1's `createApprovalRecord`).
// S4. `createApprovalRecord` only as a direct call with an object literal of
//     exactly `ownerId, projectId, kind, subjectTable, subjectId`, where kind
//     and table are the checked card's (`card.kind`, `card.subjectTable`) or a
//     literal pair from `WREN_APPROVAL_SUBJECTS`. No spread, no price, no note,
//     no change round. Only `convex/workspace/wrenCards.ts` may import it.
//
// Chat modules (`convex/workspace/chat.ts`, `chatActions.ts`):
// C1. Imports come from a per-file allowlist, by imported name. Every
//     allowlisted local module is itself scanned here (strict, chat or pure
//     helper), is a named platform gate imported by exact binding (C-OPS,
//     C-AUTHZ, C-LIMITS, `_generated`), or is a type-only import. A new
//     local helper fails until it is added and scanned.
// C2. No reference to approval decisions or creation, revision tasks,
//     debits, refunds, ledgers, publishers, senders or connectors.
// C3. `ctx.db` only as a direct method call: `get`, `query`, `normalizeId`;
//     `insert` / `patch` / `replace` only with a string-literal table from
//     `CHAT_WRITE_TABLES`; `delete` never. `insert` / `patch` / `replace` /
//     `delete` are never called on anything but `<x>.db`.
// C4. `runMutation`, `runQuery`, `runAction` and `scheduler.runAfter` only
//     as direct calls whose target is one exact function reference from
//     `CHAT_TARGETS`. Every `internal.*` reference must be one of those
//     exact references; `scheduler.runAt` and any other scheduler use fail.
//
// Everywhere (strict, chat and pure helpers):
// A1. No element access on `db`, `ctx` or `internal` (`ctx.db["insert"]`), no
//     element access with the literal `"db"`, no destructuring of `db`, a db
//     method, the scheduler or the run functions (`const { insert } =
//     ctx.db`), no aliasing of `ctx` or `ctx.db`, and no `Reflect`, `eval`,
//     `Function` or `globalThis`.
//
// Pure helpers (`PURE_HELPERS`): no `ctx`, `db`, scheduler, run function,
// `internal`, `api` or `fetch` at all; local imports only to other pure
// helpers; packages only `zod`.

const root = fileURLToPath(new URL("../../", import.meta.url));

const STRICT_FILES = {
  "lib/workspace/contracts/wrenTools.ts": new Map(),
  "lib/workspace/wrenCards.ts": new Map([["./contracts/wrenTools", null]]),
  "convex/workspace/wrenCards.ts": new Map([
    ["convex/values", ["ConvexError", "v", "Infer"]],
    ["../_generated/dataModel", ["Doc", "Id"]],
    ["../_generated/server", ["MutationCtx", "QueryCtx"]],
    ["../../lib/workspace/wrenCards", null],
    ["../../lib/workspace/contracts/approvals", ["isPendingApprovalStale"]],
    ["./approvals", [
      "approvalKindValidator", "approvalStatusValidator", "createApprovalRecord", "readSubjectState", "subjectRefusal",
      "SubjectState",
    ]],
  ]),
};

/** What the chat modules may import from `./approvals`: validators and types only. */
const APPROVAL_VALIDATORS = ["approvalKindValidator", "approvalStatusValidator", "approvalSubjectTableValidator"];

const CHAT_IMPORTS = {
  "convex/workspace/chat.ts": new Map([
    ["@convex-dev/rate-limiter", ["isRateLimitError"]],
    ["convex/values", ["ConvexError", "v", "Infer"]],
    ["../_generated/api", ["internal"]],
    ["../_generated/dataModel", ["Doc", "Id"]],
    ["../_generated/server", ["internalMutation", "internalQuery", "mutation", "query", "MutationCtx", "QueryCtx"]],
    ["../ops/settings", ["assertFeatureEnabled"]],
    ["../platform/authz", ["requireBusinessAccess", "requireBusinessForOwner"]],
    ["../platform/limits", ["checkLimit"]],
    ["../ai/prompts/wrenChat", ["wrenChatSpec"]],
    ["../ai/prompts/wrenPlanTurn", ["wrenPlanTurnSpec"]],
    ["../ai/prompts/wrenShared", ["quotedData", "WREN_REPLY_MAX_CHARS"]],
    ["./wrenCards", ["approvalCardViews", "resolveWrenCards", "wrenCardProposalValidator", "wrenCardViewValidator"]],
    ["./approvals", APPROVAL_VALIDATORS],
    ["../../lib/workspace/contracts/prompts", ["parsePromptRef", "promptRef"]],
    ["../../lib/workspace/contracts/wrenTools", ["WREN_CARDS_PER_TURN"]],
    ["../../lib/workspace/wren", [
      "decideWrenRoute", "historyLine", "isPlanChangingTurn", "normaliseFounderMessage", "utcDayStart",
      "WREN_ESCALATION_SCAN_MAX", "WREN_FAILURE_COPY", "WREN_HISTORY_MESSAGES", "WREN_MAX_ATTEMPTS_PER_MESSAGE",
      "WREN_STREAM_STALE_MS", "WREN_THREAD_PAGE", "WrenFailureCause", "WrenRoute",
    ]],
  ]),
  "convex/workspace/chatActions.ts": new Map([
    ["convex/values", ["v", "Infer", "ObjectType"]],
    ["../_generated/api", ["internal"]],
    ["../_generated/server", ["internalAction", "ActionCtx"]],
    ["../ai/gatewayActions", ["GatewayRunResult", "RunPromptArgs"]],
    ["../ai/prompts/wrenShared", ["WREN_CARD_PROPOSALS_MAX", "wrenReplyOutput", "WrenReplyOutput"]],
    ["./approvals", APPROVAL_VALIDATORS],
    ["../../lib/workspace/wren", ["WrenFailureCause"]],
    ["../../lib/workspace/contracts/wrenTools", ["WREN_CARD_FIELD_MAX_CHARS"]],
    ["./chat", ["WREN_PROMPT_REFS", "finishOutcomeValidator"]],
  ]),
};

const CHAT_FILES = Object.keys(CHAT_IMPORTS);

/** Imports that must be `import type` (erased at build: the module never loads). */
const TYPE_ONLY_IMPORTS = new Set(["convex/ai/gatewayActions.ts"]);

/**
 * Platform gates the chat modules call by exact binding. They are other
 * contracts' modules (C-OPS, C-AUTHZ, C-LIMITS, generated code), scanned by
 * their own owners; the bindings above are the whole surface allowed here.
 */
const PLATFORM_GATES = new Set([
  "convex/_generated/api.ts",
  "convex/_generated/dataModel.ts",
  "convex/_generated/server.ts",
  "convex/ops/settings.ts",
  "convex/platform/authz.ts",
  "convex/platform/limits.ts",
]);

/** Pure modules the chat and handler modules import. Scanned below (no ctx, no db, no I/O). */
const PURE_HELPERS = [
  "lib/workspace/wren.ts",
  "lib/workspace/contracts/prompts.ts",
  "lib/workspace/contracts/wrenTools.ts",
  "convex/ai/prompts/wrenChat.ts",
  "convex/ai/prompts/wrenPlanTurn.ts",
  "convex/ai/prompts/wrenShared.ts",
];

/** Read-only S1 contract helpers the strict handler may import (pure lib). */
const STRICT_LIB_HELPERS = new Set(["lib/workspace/contracts/approvals.ts"]);

/** The only tables `chat.ts` / `chatActions.ts` may insert, patch or replace (C-LIMITS rows go through `checkLimit`). */
const CHAT_WRITE_TABLES = new Set(["chat_messages"]);

/** The exact function references each run / schedule call may target. */
const CHAT_TARGETS = {
  runMutation: new Set(["internal.workspace.chat.finishWrenTurn"]),
  runQuery: new Set(["internal.workspace.chat.loadWrenTurn"]),
  runAction: new Set(["internal.ai.gatewayActions.runPrompt"]),
  runAfter: new Set(["internal.workspace.chatActions.runWrenTurn"]),
};
const ALL_TARGETS = new Set(Object.values(CHAT_TARGETS).flatMap((targets) => [...targets]));

/** Names a tool handler must never call or reference. */
const STRICT_FORBIDDEN =
  /^(decideApproval|insertRevisionTask|assertPaidRevisionApproved|activateSequence|publishLanding|debit\w*|refund\w*|\w*ledger\w*|\w*connector\w*|send\w*|publish\w*|post[A-Z]\w*|launch\w*|scheduler|runAction|runMutation|runQuery|runAfter|runAt|fetch|patch|replace|delete|checkLimit|internal|api)$/i;

/** Names the chat modules must never call, reference or import. */
const CHAT_FORBIDDEN =
  /^(decideApproval|createApprovalRecord|createApproval|insertRevisionTask|assertPaidRevisionApproved|activateSequence|publishLanding|debit\w*|refund\w*|\w*ledger\w*|\w*connector\w*|sendEmail\w*|sendOutbound\w*|postSocial\w*|launchAd\w*)$/i;

const STRICT_DB_METHODS = new Set(["get", "query", "normalizeId", "insert"]);
const CHAT_DB_METHODS = new Set(["get", "query", "normalizeId", "insert", "patch", "replace"]);
const WRITE_METHODS = new Set(["insert", "patch", "replace", "delete"]);

/** Names that may never be destructured out of anything. */
const NO_DESTRUCTURE = new Set([
  "db", "insert", "patch", "replace", "delete", "scheduler", "runMutation", "runQuery", "runAction", "runAfter", "runAt",
]);
const BANNED_GLOBALS = new Set(["Reflect", "eval", "Function", "globalThis"]);

const CARD_FIELDS = ["ownerId", "projectId", "kind", "subjectTable", "subjectId"];

function parse(fileName, source) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function line(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/** Identifiers used as a call target or a property reference (not object-literal keys or types). */
function referencedNames(sourceFile) {
  const names = [];
  walk(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) names.push({ name: callee.text, node });
      else if (ts.isPropertyAccessExpression(callee)) names.push({ name: callee.name.text, node });
    }
    if (ts.isPropertyAccessExpression(node)) names.push({ name: node.name.text, node });
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      names.push({ name: node.argumentExpression.text, node });
    }
    if (ts.isIdentifier(node) && !ts.isPropertyAssignment(node.parent) && !ts.isTypeReferenceNode(node.parent) &&
      !ts.isPropertyAccessExpression(node.parent) && !ts.isImportSpecifier(node.parent)) {
      names.push({ name: node.text, node });
    }
  });
  return names;
}

/** Import declarations with each binding's IMPORTED name (`import { a as b }` gives `a`). */
function imports(sourceFile) {
  const out = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportEqualsDeclaration(statement)) {
      out.push({ from: statement.moduleReference.getText(sourceFile), bindings: ["*"], typeOnly: false, node: statement });
      continue;
    }
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = [];
    const clause = statement.importClause;
    if (clause === undefined) bindings.push("<side effect>");
    if (clause?.name) bindings.push("default");
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) bindings.push((element.propertyName ?? element.name).text);
    }
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bindings.push("*");
    out.push({ from: statement.moduleSpecifier.text, bindings, typeOnly: clause?.isTypeOnly === true, node: statement });
  }
  // Dynamic `import()` and `require()` are never allowed.
  walk(sourceFile, (node) => {
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      out.push({ from: "<dynamic>", bindings: ["*"], typeOnly: false, node });
    }
  });
  return out;
}

function normalizeSpecifier(from) {
  return from.replace(/\.ts$/u, "");
}

/** Repo-relative path of a relative import, or null for a package. */
export function resolveLocal(fileName, from) {
  if (!from.startsWith(".")) return null;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(fileName), normalizeSpecifier(from)));
  return `${joined}.ts`;
}

function checkImports(fileName, sourceFile, allowedImports, problems) {
  for (const { from, bindings, node } of imports(sourceFile)) {
    const normalized = normalizeSpecifier(from);
    if (!allowedImports.has(normalized)) {
      problems.push(`${fileName}:${line(sourceFile, node)} import from ${from} is not allowed`);
      continue;
    }
    const allowed = allowedImports.get(normalized);
    if (allowed === null) continue;
    for (const binding of bindings) {
      if (!allowed.includes(binding)) problems.push(`${fileName}:${line(sourceFile, node)} import ${binding} from ${from} is not allowed`);
    }
  }
}

/** The text of a property-access chain rooted at an identifier (`internal.a.b`), or null. */
function chainText(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const head = chainText(node.expression);
    return head === null ? null : `${head}.${node.name.text}`;
  }
  return null;
}

/** `x.db` (any object), `db`, `ctx`, `internal`: element access on these is never allowed. */
function isGuardedObject(node) {
  if (ts.isIdentifier(node)) return node.text === "db" || node.text === "ctx" || node.text === "internal";
  return ts.isPropertyAccessExpression(node) && (node.name.text === "db" || node.name.text === "ctx");
}

function bindingName(element) {
  const name = element.propertyName ?? element.name;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return "<computed>";
}

/** Rule A1 (every scanned file). */
function scanAliasing(fileName, sourceFile, problems) {
  walk(sourceFile, (node) => {
    if (ts.isElementAccessExpression(node)) {
      const argument = node.argumentExpression;
      if (isGuardedObject(node.expression)) {
        problems.push(`${fileName}:${line(sourceFile, node)} element access on ${node.expression.getText(sourceFile)}`);
      } else if (ts.isStringLiteralLike(argument) && argument.text === "db") {
        problems.push(`${fileName}:${line(sourceFile, node)} element access ["db"]`);
      }
    }
    if (ts.isObjectBindingPattern(node)) {
      for (const element of node.elements) {
        const name = bindingName(element);
        if (NO_DESTRUCTURE.has(name) || name === "<computed>") {
          problems.push(`${fileName}:${line(sourceFile, node)} destructures ${name}`);
        }
      }
      const declaration = node.parent;
      if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined &&
        isGuardedObject(declaration.initializer)) {
        problems.push(`${fileName}:${line(sourceFile, node)} destructures ${declaration.initializer.getText(sourceFile)}`);
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined && !ts.isObjectBindingPattern(node.name) &&
      isGuardedObject(node.initializer)) {
      problems.push(`${fileName}:${line(sourceFile, node)} aliases ${node.initializer.getText(sourceFile)}`);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && isGuardedObject(node.right)) {
      problems.push(`${fileName}:${line(sourceFile, node)} aliases ${node.right.getText(sourceFile)}`);
    }
    if (ts.isIdentifier(node) && BANNED_GLOBALS.has(node.text) && !ts.isPropertyAccessExpression(node.parent)) {
      problems.push(`${fileName}:${line(sourceFile, node)} references ${node.text}`);
    }
  });
}

/**
 * Rules S3 / C3: every `.db` is the object of a direct method call with an
 * allowed method; writes name an allowed string-literal table; write methods
 * are never called on anything but `.db`.
 */
function scanDb(fileName, sourceFile, methods, writeTables, problems) {
  walk(sourceFile, (node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "db") {
      const member = node.parent;
      const call = member?.parent;
      const direct = member !== undefined && ts.isPropertyAccessExpression(member) && member.expression === node &&
        call !== undefined && ts.isCallExpression(call) && call.expression === member;
      if (!direct) {
        problems.push(`${fileName}:${line(sourceFile, node)} uses ${node.getText(sourceFile)} outside a direct method call`);
        return;
      }
      const method = member.name.text;
      if (!methods.has(method)) {
        problems.push(`${fileName}:${line(sourceFile, node)} calls db.${method}`);
        return;
      }
      if (WRITE_METHODS.has(method)) {
        const table = call.arguments[0];
        if (table === undefined || !ts.isStringLiteralLike(table) || !writeTables.has(table.text)) {
          problems.push(`${fileName}:${line(sourceFile, node)} db.${method} into ${table ? table.getText(sourceFile) : "?"}`);
        }
      }
    }
    if (ts.isIdentifier(node) && node.text === "db" && !ts.isPropertyAccessExpression(node.parent) &&
      !ts.isPropertyAssignment(node.parent) && !ts.isBindingElement(node.parent)) {
      problems.push(`${fileName}:${line(sourceFile, node)} uses a bare db`);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      WRITE_METHODS.has(node.expression.name.text)) {
      const object = node.expression.expression;
      if (!(ts.isPropertyAccessExpression(object) && object.name.text === "db")) {
        problems.push(`${fileName}:${line(sourceFile, node)} calls .${node.expression.name.text}() on ${object.getText(sourceFile)}`);
      }
    }
  });
}

/** Rule S4: `createApprovalRecord` only as a direct call raising a Wren kind, with no price, note or round. */
function scanCreateApprovalRecord(fileName, sourceFile, problems) {
  const wrenKinds = new Map(Object.entries(WREN_APPROVAL_SUBJECTS));
  walk(sourceFile, (node) => {
    if (!ts.isIdentifier(node) || node.text !== "createApprovalRecord") return;
    if (ts.isImportSpecifier(node.parent)) {
      if (node.parent.propertyName !== undefined) problems.push(`${fileName}:${line(sourceFile, node)} aliases createApprovalRecord`);
      return;
    }
    const call = node.parent;
    if (!ts.isCallExpression(call) || call.expression !== node) {
      problems.push(`${fileName}:${line(sourceFile, node)} references createApprovalRecord outside a direct call`);
      return;
    }
    const input = call.arguments[1];
    if (call.arguments.length !== 2 || input === undefined || !ts.isObjectLiteralExpression(input)) {
      problems.push(`${fileName}:${line(sourceFile, call)} createApprovalRecord without an object literal`);
      return;
    }
    const fields = new Map();
    for (const property of input.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
        problems.push(`${fileName}:${line(sourceFile, property)} createApprovalRecord input has ${property.getText(sourceFile)}`);
        continue;
      }
      fields.set(property.name.text, property.initializer);
    }
    const names = [...fields.keys()].sort();
    if (names.join(",") !== [...CARD_FIELDS].sort().join(",")) {
      problems.push(`${fileName}:${line(sourceFile, call)} createApprovalRecord input fields ${names.join(", ")}`);
      return;
    }
    const kind = fields.get("kind");
    const table = fields.get("subjectTable");
    const fromCard = kind.getText(sourceFile) === "card.kind" && table.getText(sourceFile) === "card.subjectTable" &&
      fields.get("subjectId").getText(sourceFile) === "card.subjectId";
    const literalPair = ts.isStringLiteralLike(kind) && ts.isStringLiteralLike(table) &&
      wrenKinds.has(kind.text) && wrenKinds.get(kind.text).includes(table.text);
    if (!fromCard && !literalPair) {
      problems.push(`${fileName}:${line(sourceFile, call)} createApprovalRecord kind ${kind.getText(sourceFile)} is not a Wren kind`);
    }
  });
}

/** Violations of rules S1-S4 and A1 for one tool registry / handler file. */
export function scanStrict(fileName, source, allowedImports) {
  const sourceFile = parse(fileName, source);
  const problems = [];
  checkImports(fileName, sourceFile, allowedImports, problems);
  for (const { name, node } of referencedNames(sourceFile)) {
    if (STRICT_FORBIDDEN.test(name)) problems.push(`${fileName}:${line(sourceFile, node)} references ${name}`);
  }
  scanDb(fileName, sourceFile, STRICT_DB_METHODS, new Set(["audit_events"]), problems);
  scanCreateApprovalRecord(fileName, sourceFile, problems);
  scanAliasing(fileName, sourceFile, problems);
  return [...new Set(problems)];
}

/** Rule C4: run and schedule calls reach only exact references; every `internal.*` is one of them. */
function scanTargets(fileName, sourceFile, problems) {
  walk(sourceFile, (node) => {
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.text;
      if (name === "scheduler") {
        const member = node.parent;
        const call = member?.parent;
        const ok = ts.isPropertyAccessExpression(member) && member.expression === node && member.name.text === "runAfter" &&
          ts.isCallExpression(call) && call.expression === member;
        if (!ok) problems.push(`${fileName}:${line(sourceFile, node)} uses the scheduler other than runAfter`);
      }
      if (Object.prototype.hasOwnProperty.call(CHAT_TARGETS, name) || name === "runAt") {
        const call = node.parent;
        if (name === "runAt" || !ts.isCallExpression(call) || call.expression !== node) {
          problems.push(`${fileName}:${line(sourceFile, node)} uses ${name} outside a direct call`);
        } else {
          const target = (name === "runAfter" ? call.arguments[1] : call.arguments[0])?.getText(sourceFile) ?? "";
          if (!CHAT_TARGETS[name].has(target)) problems.push(`${fileName}:${line(sourceFile, node)} ${name}(${target})`);
        }
      }
      // The outermost chain rooted at `internal` must be one exact allowed reference.
      const parent = node.parent;
      const outermost = !(ts.isPropertyAccessExpression(parent) && parent.expression === node);
      const text = chainText(node);
      if (outermost && text !== null && text.startsWith("internal.") && !ALL_TARGETS.has(text)) {
        problems.push(`${fileName}:${line(sourceFile, node)} references ${text}`);
      }
    }
    if (ts.isIdentifier(node) && (node.text === "internal" || node.text === "api") &&
      !ts.isPropertyAccessExpression(node.parent) && !ts.isImportSpecifier(node.parent)) {
      problems.push(`${fileName}:${line(sourceFile, node)} uses ${node.text} as a value`);
    }
  });
}

/** Violations of rules C1-C4 and A1 for one chat module (fixtures default to `chat.ts`'s import allowlist). */
export function scanChat(fileName, source, allowedImports = CHAT_IMPORTS[fileName] ?? CHAT_IMPORTS["convex/workspace/chat.ts"]) {
  const sourceFile = parse(fileName, source);
  const problems = [];
  checkImports(fileName, sourceFile, allowedImports, problems);
  for (const { bindings, from, node } of imports(sourceFile)) {
    for (const binding of bindings) {
      if (CHAT_FORBIDDEN.test(binding)) problems.push(`${fileName}:${line(sourceFile, node)} imports ${binding} from ${from}`);
    }
  }
  for (const { name, node } of referencedNames(sourceFile)) {
    if (CHAT_FORBIDDEN.test(name)) problems.push(`${fileName}:${line(sourceFile, node)} references ${name}`);
  }
  scanDb(fileName, sourceFile, CHAT_DB_METHODS, CHAT_WRITE_TABLES, problems);
  scanTargets(fileName, sourceFile, problems);
  scanAliasing(fileName, sourceFile, problems);
  return [...new Set(problems)];
}

const PURE_FORBIDDEN = /^(ctx|db|scheduler|runMutation|runQuery|runAction|runAfter|runAt|internal|api|fetch|process|require)$/u;
const PURE_PACKAGES = new Set(["zod"]);

/** Violations for one pure helper: no Convex context, no I/O, imports only other pure helpers and zod. */
export function scanPure(fileName, source) {
  const sourceFile = parse(fileName, source);
  const problems = [];
  for (const { from, typeOnly, node } of imports(sourceFile)) {
    const local = resolveLocal(fileName, from);
    if (local === null ? !(PURE_PACKAGES.has(from) || typeOnly) : !PURE_HELPERS.includes(local)) {
      problems.push(`${fileName}:${line(sourceFile, node)} import from ${from} is not a pure helper`);
    }
  }
  for (const { name, node } of referencedNames(sourceFile)) {
    if (PURE_FORBIDDEN.test(name)) problems.push(`${fileName}:${line(sourceFile, node)} references ${name}`);
  }
  scanAliasing(fileName, sourceFile, problems);
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

test("every local module the chat and handler modules import is scanned, a named gate, or type-only", async () => {
  const scanned = new Set([...Object.keys(STRICT_FILES), ...CHAT_FILES, ...PURE_HELPERS, ...STRICT_LIB_HELPERS]);
  const allowlists = [...Object.entries(CHAT_IMPORTS), ...Object.entries(STRICT_FILES)];
  for (const [fileName, allowed] of allowlists) {
    const source = await readFile(path.join(root, fileName), "utf8");
    const declared = imports(parse(fileName, source));
    for (const specifier of allowed.keys()) {
      const local = resolveLocal(fileName, specifier);
      if (local === null) continue;
      const onDisk = [local, local.replace(/\.ts$/u, ".d.ts"), local.replace(/\.ts$/u, ".js")];
      assert.ok(onDisk.some((candidate) => existsSync(path.join(root, candidate))), `${fileName}: ${specifier} resolves to ${local}`);
      if (TYPE_ONLY_IMPORTS.has(local)) {
        for (const entry of declared.filter((item) => resolveLocal(fileName, item.from) === local)) {
          assert.ok(entry.typeOnly, `${fileName}: ${specifier} must be imported with import type`);
        }
        continue;
      }
      assert.ok(scanned.has(local) || PLATFORM_GATES.has(local) || local === "convex/workspace/approvals.ts",
        `${fileName}: ${specifier} (${local}) is not scanned`);
    }
  }
  for (const relative of PURE_HELPERS) {
    const source = await readFile(path.join(root, relative), "utf8");
    assert.deepEqual(scanPure(relative, source), [], relative);
  }
});

test("fixtures: the strict scan catches each side-effect shape", () => {
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
    // Reviewer probes (WP77-S4 review, M2).
    elementInsert: "export async function f(ctx){ await ctx.db[\"insert\"](\"approvals\", {status:\"approved\"}); }",
    destructInsert: "export async function f(ctx){ const { insert } = ctx.db; await insert(\"approvals\", {}); }",
    createSpend: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx){ await createApprovalRecord(ctx,{kind:\"spend\"}); }",
    // Variants of the same holes.
    aliasDb: "export async function f(ctx){ const d = ctx.db; await d.insert(\"approvals\", {}); }",
    paramDestructure: "export async function f({ db }){ await db.insert(\"approvals\", {}); }",
    ctxElement: "export async function f(ctx, k){ await ctx[k].insert(\"approvals\", {}); }",
    dbLiteral: "export async function f(c){ await c[\"db\"].insert(\"approvals\", {}); }",
    createSpendFull: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b){ await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: \"spend\", subjectTable: \"documents\", subjectId: b.s }); }",
    createWithPrice: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, card, b){ await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId, costCredits: 0n }); }",
    createSpread: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, card, x){ await createApprovalRecord(ctx, { ...x, kind: card.kind }); }",
    createAlias: "import { createApprovalRecord as make } from \"./approvals\"; export async function f(ctx){ await make(ctx, {}); }",
    createRef: "import { createApprovalRecord } from \"./approvals\"; const g = createApprovalRecord; export async function f(ctx){ await g(ctx, {kind:\"spend\"}); }",
    createWrongTable: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b){ await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: \"send\", subjectTable: \"outbound_messages\", subjectId: b.s }); }",
    reflect: "export async function f(ctx){ await Reflect.get(ctx, \"db\").insert(\"approvals\", {}); }",
    dynamicImport: "export async function f(){ await import(\"./approvals\"); }",
  };
  for (const [label, source] of Object.entries(offenders)) {
    assert.notDeepEqual(scanStrict(`fixture-${label}.ts`, source, allowed), [], label);
  }
  assert.deepEqual(scanStrict("fixture-ok.ts", "import { v } from \"convex/values\"; export const x = v.string(); const y = { publish: 1, send: 2 };", allowed), []);
  assert.deepEqual(scanStrict(
    "fixture-ok-create.ts",
    "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, card, b){ await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }); await ctx.db.insert(\"audit_events\", {}); }",
    allowed,
  ), []);
});

test("fixtures: the chat scan catches each side-effect shape", () => {
  const chatOffenders = {
    schedule: "export async function f(ctx) { await ctx.scheduler.runAfter(0, internal.growth.email.send, {}); }",
    action: "export async function f(ctx) { await ctx.runAction(internal.workspace.publish.go, {}); }",
    mutation: "export async function f(ctx) { await ctx.runMutation(internal.workspace.approvals.decideApproval, {}); }",
    ledger: "import { debitTask } from \"../platform/ledger\";",
    debit: "export async function f(ctx) { await debitTask(ctx); }",
    // Reviewer probes (WP77-S4 review, M2).
    aliasDecide: "import { decideApproval as choose } from \"./approvals\"; export async function f(ctx){ await choose(ctx,{}); }",
    createRecord: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx){ await createApprovalRecord(ctx,{}); }",
    patchApproval: "export async function f(ctx,id){ await ctx.db.patch(\"approvals\", id, {status:\"approved\"}); }",
    helper: "import { go } from \"./wrenHelpers\"; export async function f(ctx){ await go(ctx); }",
    insertTask: "export async function f(ctx){ await ctx.db.insert(\"tasks\", {}); }",
    scheduleViaChat: "export async function f(ctx){ await ctx.runMutation(internal.workspace.chat.doAnything, {}); }",
    // Variants of the same holes.
    aliasCreate: "import { createApprovalRecord as raise } from \"./approvals\"; export async function f(ctx){ await raise(ctx,{}); }",
    deleteRow: "export async function f(ctx, id){ await ctx.db.delete(\"chat_messages\", id); }",
    replaceApproval: "export async function f(ctx, id){ await ctx.db.replace(\"approvals\", id, {}); }",
    dynamicTable: "export async function f(ctx, t){ await ctx.db.insert(t, {}); }",
    elementInsert: "export async function f(ctx){ await ctx.db[\"insert\"](\"tasks\", {}); }",
    destructInsert: "export async function f(ctx){ const { insert } = ctx.db; await insert(\"tasks\", {}); }",
    destructDb: "export async function f(ctx){ const { db } = ctx; await db.insert(\"tasks\", {}); }",
    aliasScheduler: "export async function f(ctx){ const s = ctx.scheduler; await s.runAfter(0, internal.workspace.chatActions.runWrenTurn, {}); }",
    runAt: "export async function f(ctx){ await ctx.scheduler.runAt(0, internal.workspace.chatActions.runWrenTurn, {}); }",
    refStash: "export async function f(ctx){ const r = internal.workspace.approvals.decideApproval; await ctx.runMutation(r, {}); }",
    otherChatQuery: "export async function f(ctx){ await ctx.runQuery(internal.workspace.chat.listEverything, {}); }",
    patchOnOther: "export async function f(ctx, store){ await store.patch(\"approvals\", {}); }",
    namespaceImport: "import * as approvals from \"./approvals\"; export const x = approvals;",
    gatewayValue: "import { runPromptWithMeter } from \"../ai/gatewayActions\";",
  };
  for (const [label, source] of Object.entries(chatOffenders)) {
    assert.notDeepEqual(scanChat(`chat-${label}.ts`, source), [], label);
  }
  assert.deepEqual(scanChat("chat-ok.ts", "import { internal } from \"../_generated/api\"; export async function f(ctx) { await ctx.scheduler.runAfter(0, internal.workspace.chatActions.runWrenTurn, {}); await ctx.db.patch(\"chat_messages\", ctx.id, {}); }"), []);
});

test("fixtures: the pure-helper scan catches context and I/O", () => {
  const offenders = {
    ctx: "export async function f(ctx) { return await ctx.db.get(\"approvals\", 1); }",
    fetch: "export async function f() { return await fetch(\"https://evil.example\"); }",
    localImport: "import { go } from \"./wrenHelpers\"; export const g = go;",
    pkg: "import { Resend } from \"resend\"; export const r = Resend;",
  };
  for (const [label, source] of Object.entries(offenders)) {
    assert.notDeepEqual(scanPure(`lib/workspace/pure-${label}.ts`, source), [], label);
  }
});
