import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
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
// A2 (strict and chat files): no call through element access
//     (`c[k][w](...)`), no element access except a numeric index or a key
//     into one of the module's own static maps (`STATIC_MAPS`, never
//     redeclared as a local or parameter), no `Object.values / entries /
//     assign / getOwnPropertyDescriptor(s) / getPrototypeOf / setPrototypeOf
//     / defineProperty / defineProperties` (except `Object.entries` /
//     `values` / `keys` of a static map), no `Reflect.*`, and no
//     `.constructor`, `.__proto__`, `.eval`, `.Function` or `.require` as a
//     property name (`global.eval`, `(async () => {}).constructor`).
// S4 also requires `card` to be a parameter typed `ApprovalCard` of the
//     calling function, never reassigned (`card = ...`, `card.kind = ...`)
//     and never shadowed by another declaration in that function. The real
//     control is runtime: `isWrenApprovalSubject` in
//     `convex/workspace/wrenCards.ts`, right before the call.
// Re-exports (`export * from`, `export { x } from`) go through the same
// import allowlist as imports.
//
// Memory modules (WP77-S5: `convex/workspace/wrenMemory.ts`, the only
// `wren_memory` writer, and `convex/workspace/memory.ts`, the founder's public
// edits):
// M1. Imports come from a per-file allowlist, by imported name.
// M2. No reference to anything that creates or decides an approval, sends,
//     posts, publishes, launches, spends, debits, refunds, touches a ledger
//     or connector, schedules, runs an action / mutation / query, fetches,
//     replaces or deletes a row, or reads `internal` / `api`.
// M3. `ctx.db` only as a direct method call: `get`, `query`, `normalizeId`;
//     `insert` only with the string literal `wren_memory` or `audit_events`,
//     `patch` only with `wren_memory` (audit rows are append-only), so the
//     id-only `patch(id, v)` form is refused too; never `replace` or `delete`.
// M4. A1 and A2 as above.
// The chat modules still may not write `wren_memory` themselves (C3): memory
// is written only through `applyWrenMemoryProposal`.
// M5 (repo-wide). Across `convex/**` (not `_generated`, not tests), only
//     `convex/workspace/wrenMemory.ts` may hold a write call (`insert` /
//     `patch` / `replace` / `delete`, also through `.call` or `.apply`) that
//     names the table: the string `wren_memory`, also built from static parts
//     (`"wren_" + "memory"`, a template of literals), or a variable or object
//     property bound to it. It also catches the id-only forms Convex still
//     supports (`patch(id, v)`, `replace(id, v)`, `delete(id)`) when the AST
//     ties the id to the table: a name declared `Id<"wren_memory">` or
//     `Doc<"wren_memory">`, a row or id read by `.query("wren_memory")` or
//     `.get("wren_memory", ...)` in the same file (`row._id`, `const id =
//     row._id`, `for (const row of ...)`, destructuring), a row returned by an
//     export of the writer that returns one (`readWrenMemory`, found from its
//     declared return type, imported by name or namespace), or such a read
//     inline.
//     Limits (not caught): an id-only write whose id arrives untyped from a
//     parameter, another module or `any` (`delete(id)` with a bare `id`); the
//     table name passed through a helper's parameter, a spread
//     (`patch(...args)`), a computed property or a value built at runtime;
//     a deliberately shadowed name. Generic code that writes child tables by
//     a table name held in a list (account and business deletion) is outside
//     this rule by design. The runtime and schema are the real controls; this
//     catches regressions in ordinary code.
//
// Pure helpers (`PURE_HELPERS`): no `ctx`, `db`, scheduler, run function,
// `internal`, `api` or `fetch` at all; local imports only to other pure
// helpers; packages only `zod`.
//
// This scan guards against regressions, not deliberate obfuscation: the
// runtime checks (the allowlist, `isWrenApprovalSubject`, S1's rules) are
// the controls.

const root = fileURLToPath(new URL("../../", import.meta.url));

const STRICT_FILES = {
  "lib/workspace/contracts/wrenTools.ts": new Map(),
  "lib/workspace/wrenCards.ts": new Map([
    ["./contracts/wrenTools", null],
    ["./plainText", ["isControlChar", "isInvisibleChar"]],
  ]),
  "convex/workspace/wrenCards.ts": new Map([
    ["convex/values", ["ConvexError", "v", "Infer"]],
    ["../_generated/dataModel", ["Doc", "Id"]],
    ["../_generated/server", ["MutationCtx", "QueryCtx"]],
    ["../../lib/workspace/wrenCards", null],
    ["../../lib/workspace/contracts/approvals", ["isPendingApprovalStale"]],
    ["../../lib/workspace/contracts/wrenTools", ["WREN_APPROVAL_SUBJECTS", "WrenApprovalKind"]],
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
    ["./wrenMemory", [
      "applyWrenMemoryProposal", "memoryForPrompt", "memoryVersionOf", "pairedFounderMessage", "readWrenMemory",
      "wrenMemoryProposalValidator",
    ]],
    ["./approvals", APPROVAL_VALIDATORS],
    ["../../lib/workspace/plainText", ["sliceWellFormed"]],
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
    ["../../lib/workspace/contracts/wrenMemory", [
      "WREN_MEMORY_FACT_MAX_CHARS", "WREN_MEMORY_PROPOSALS_MAX", "WREN_MEMORY_RAW_PASS_FACTOR", "WREN_MEMORY_SUMMARY_MAX_CHARS",
      "wrenMemoryOverlongMarker",
    ]],
    ["../../lib/workspace/plainText", ["dropLoneSurrogates"]],
    ["./chat", ["WREN_PROMPT_REFS", "finishOutcomeValidator"]],
  ]),
};

const CHAT_FILES = Object.keys(CHAT_IMPORTS);

/** WP77-S5: the memory modules and what each may import (rules M1-M4). */
const MEMORY_IMPORTS = {
  "convex/workspace/wrenMemory.ts": new Map([
    ["convex/values", ["v"]],
    ["../_generated/dataModel", ["Doc", "Id"]],
    ["../_generated/server", ["MutationCtx", "QueryCtx"]],
    ["../../lib/workspace/contracts/wrenMemory", ["WREN_MEMORY_FACTS_MAX"]],
    ["../../lib/workspace/wrenMemory", [
      "deleteFact", "editFact", "editSummary", "EMPTY_WREN_MEMORY", "planWrenMemoryUpdate", "wrenMemoryVersion",
      "FounderMemoryEdit", "WrenMemoryProposal", "WrenMemoryState",
    ]],
  ]),
  "convex/workspace/memory.ts": new Map([
    ["convex/values", ["v", "Infer"]],
    ["../_generated/server", ["mutation", "query"]],
    ["../ops/settings", ["assertFeatureEnabled"]],
    ["../platform/authz", ["requireBusinessAccess"]],
    ["../../lib/workspace/contracts/wrenMemory", [
      "WREN_MEMORY_FACT_MAX_CHARS", "WREN_MEMORY_FACTS_MAX", "WREN_MEMORY_SUMMARY_MAX_CHARS",
    ]],
    ["../../lib/workspace/wrenMemory", ["FounderMemoryEdit"]],
    ["./wrenMemory", ["applyFounderMemoryEdit", "readWrenMemory", "WREN_MEMORY_FACTS_READ_MAX"]],
  ]),
};

const MEMORY_FILES = Object.keys(MEMORY_IMPORTS);

/** The only tables the memory modules may write, per method: audit rows are insert-only. */
const MEMORY_WRITE_TABLES = new Map([
  ["insert", new Set(["wren_memory", "audit_events"])],
  ["patch", new Set(["wren_memory"])],
]);
const MEMORY_DB_METHODS = new Set(["get", "query", "normalizeId", "insert", "patch"]);

/** Names the memory modules must never call, reference or import. */
const MEMORY_FORBIDDEN =
  /^(decideApproval|createApprovalRecord|createApproval|raiseApprovalCard|resolveWrenCards|assertApproved|insertRevisionTask|assertPaidRevisionApproved|activateSequence|publishLanding|debit\w*|refund\w*|\w*ledger\w*|\w*connector\w*|send\w*|publish\w*|post[A-Z]\w*|launch\w*|scheduler|storage|runAction|runMutation|runQuery|runAfter|runAt|fetch|replace|delete|checkLimit|internal|api)$/i;

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
  "lib/workspace/contracts/approvals.ts",
  "lib/workspace/contracts/wrenMemory.ts",
  "lib/workspace/wrenMemory.ts",
  "lib/workspace/plainText.ts",
];

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
/** Property names never allowed (code from strings, prototype tricks, module loading). */
const BANNED_PROPERTIES = new Set(["eval", "Function", "constructor", "__proto__", "require"]);

/** Module-level constant maps the strict and chat files may index with a computed key. */
const STATIC_MAPS = new Set([
  "FIELDS", "WREN_APPROVAL_SUBJECTS", "WREN_EXPLAIN_TOPICS", "WREN_NAVIGATE_ROUTES", "WREN_FAILURE_COPY", "WREN_PROMPT_REFS",
]);
/** `Object.*` members that expose or rewire an object's properties. */
const BANNED_OBJECT_MEMBERS = new Set([
  "values", "entries", "assign", "getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "getPrototypeOf",
  "setPrototypeOf", "defineProperty", "defineProperties",
]);
/** The ones allowed on a static map (prompt text built from the allowlist). */
const STATIC_MAP_OBJECT_MEMBERS = new Set(["values", "entries", "keys"]);

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
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier)) {
      const bindings = [];
      const clause = statement.exportClause;
      if (clause === undefined || ts.isNamespaceExport(clause)) bindings.push("*");
      else for (const element of clause.elements) bindings.push((element.propertyName ?? element.name).text);
      out.push({ from: statement.moduleSpecifier.text, bindings, typeOnly: statement.isTypeOnly, node: statement });
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
  if (ts.isIdentifier(node)) {
    return node.text === "db" || node.text === "ctx" || node.text === "internal" || node.text === "Object" ||
      node.text === "Reflect";
  }
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
    if (ts.isIdentifier(node) && BANNED_GLOBALS.has(node.text) &&
      !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
      problems.push(`${fileName}:${line(sourceFile, node)} references ${node.text}`);
    }
    if (ts.isPropertyAccessExpression(node) && BANNED_PROPERTIES.has(node.name.text)) {
      problems.push(`${fileName}:${line(sourceFile, node)} uses .${node.name.text}`);
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
        // `writeTables`: one set for every write method, or a map of method to its own set.
        const allowed = writeTables instanceof Map ? writeTables.get(method) ?? new Set() : writeTables;
        if (table === undefined || !ts.isStringLiteralLike(table) || !allowed.has(table.text)) {
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
    if (fromCard) problems.push(...cardParameterProblems(fileName, sourceFile, call));
  });
}

/** Top-level (module scope) declarations are the only place a static map name may be declared. */
function isModuleScope(node) {
  let current = node.parent;
  while (current !== undefined && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current) || ts.isBlock(current) || ts.isClassLike(current)) return false;
    current = current.parent;
  }
  return true;
}

/** Rule A2 (strict and chat files): no computed-key reads or calls, no property-reflection helpers. */
function scanDynamic(fileName, sourceFile, problems) {
  walk(sourceFile, (node) => {
    if (ts.isCallExpression(node) && ts.isElementAccessExpression(node.expression)) {
      problems.push(`${fileName}:${line(sourceFile, node)} calls through element access ${node.expression.getText(sourceFile)}`);
    }
    if (ts.isElementAccessExpression(node)) {
      const argument = node.argumentExpression;
      const numeric = ts.isNumericLiteral(argument);
      const staticMap = ts.isIdentifier(node.expression) && STATIC_MAPS.has(node.expression.text);
      if (!numeric && !staticMap) {
        problems.push(`${fileName}:${line(sourceFile, node)} element access ${node.getText(sourceFile)}`);
      }
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Object" &&
      BANNED_OBJECT_MEMBERS.has(node.name.text)) {
      const call = node.parent;
      const target = ts.isCallExpression(call) && call.expression === node ? call.arguments[0] : undefined;
      const onStaticMap = STATIC_MAP_OBJECT_MEMBERS.has(node.name.text) && target !== undefined &&
        ts.isIdentifier(target) && STATIC_MAPS.has(target.text);
      if (!onStaticMap) problems.push(`${fileName}:${line(sourceFile, node)} uses Object.${node.name.text}`);
    }
    // A static map name declared anywhere but module scope (a parameter, a local) could alias anything.
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name) && STATIC_MAPS.has(node.name.text) &&
      (ts.isParameter(node) || ts.isBindingElement(node) || !isModuleScope(node))) {
      problems.push(`${fileName}:${line(sourceFile, node)} redeclares ${node.name.text}`);
    }
  });
}

function enclosingFunction(node) {
  let current = node.parent;
  while (current !== undefined && !ts.isFunctionLike(current)) current = current.parent;
  return current;
}

/** `card` is written to: `card = x`, `card.kind = x`, `card[k] = x`, `card++`, `delete card.kind`. */
function isWriteTarget(identifier) {
  let target = identifier;
  while ((ts.isPropertyAccessExpression(target.parent) || ts.isElementAccessExpression(target.parent) ||
    ts.isParenthesizedExpression(target.parent)) && target.parent.expression === target) target = target.parent;
  const parent = target.parent;
  if (ts.isBinaryExpression(parent) && parent.left === target &&
    parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
    return true;
  }
  if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
    (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken)) return true;
  if (ts.isDeleteExpression(parent)) return true;
  // Destructuring assignment targets: `({ x: card.kind } = y)`, `[card] = y`, `for ([card] of y)`.
  const inPattern = ts.isShorthandPropertyAssignment(parent) || ts.isArrayLiteralExpression(parent) ||
    ts.isSpreadElement(parent) || ts.isSpreadAssignment(parent) ||
    (ts.isPropertyAssignment(parent) && parent.initializer === target);
  return inPattern && isAssignmentPattern(parent);
}

/** The object / array literal containing `node` is the left side of an assignment or a for-in/of head. */
function isAssignmentPattern(node) {
  let literal = node;
  while (!ts.isObjectLiteralExpression(literal) && !ts.isArrayLiteralExpression(literal)) literal = literal.parent;
  while (ts.isObjectLiteralExpression(literal.parent) || ts.isArrayLiteralExpression(literal.parent) ||
    ts.isPropertyAssignment(literal.parent) || ts.isSpreadElement(literal.parent) ||
    ts.isParenthesizedExpression(literal.parent)) literal = literal.parent;
  const holder = literal.parent;
  if (ts.isBinaryExpression(holder) && holder.left === literal && holder.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return true;
  }
  return (ts.isForOfStatement(holder) || ts.isForInStatement(holder)) && holder.initializer === literal;
}

/**
 * Rule S4 for `card.*` inputs: `card` is a parameter of the calling function
 * typed `ApprovalCard`, never written to and never shadowed in that function.
 */
function cardParameterProblems(fileName, sourceFile, call) {
  const fn = enclosingFunction(call);
  const where = `${fileName}:${line(sourceFile, call)}`;
  if (fn === undefined) return [`${where} createApprovalRecord outside a function`];
  const parameter = fn.parameters.find((item) => ts.isIdentifier(item.name) && item.name.text === "card");
  if (parameter === undefined) return [`${where} card is not a parameter of the calling function`];
  if (parameter.type === undefined || parameter.type.getText(sourceFile) !== "ApprovalCard") {
    return [`${where} card is not typed ApprovalCard`];
  }
  const problems = [];
  walk(fn, (node) => {
    if (!ts.isIdentifier(node) || node.text !== "card" || node === parameter.name) return;
    const parent = node.parent;
    const declares = (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent) ||
      ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent)) && parent.name === node;
    if (declares || (ts.isBindingElement(parent) && parent.propertyName === undefined)) {
      problems.push(`${fileName}:${line(sourceFile, node)} shadows card`);
    } else if (!(ts.isPropertyAccessExpression(parent) && parent.name === node) && isWriteTarget(node)) {
      problems.push(`${fileName}:${line(sourceFile, node)} writes to card`);
    }
  });
  return problems;
}

/** Violations of rules S1-S4, A1 and A2 for one tool registry / handler file. */
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
  scanDynamic(fileName, sourceFile, problems);
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

/** Violations of rules C1-C4, A1 and A2 for one chat module (fixtures default to `chat.ts`'s import allowlist). */
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
  scanDynamic(fileName, sourceFile, problems);
  return [...new Set(problems)];
}

/** Violations of rules M1-M4 for one memory module (fixtures default to `wrenMemory.ts`'s import allowlist). */
export function scanMemory(
  fileName,
  source,
  allowedImports = MEMORY_IMPORTS[fileName] ?? MEMORY_IMPORTS["convex/workspace/wrenMemory.ts"],
) {
  const sourceFile = parse(fileName, source);
  const problems = [];
  checkImports(fileName, sourceFile, allowedImports, problems);
  for (const { bindings, from, node } of imports(sourceFile)) {
    for (const binding of bindings) {
      if (MEMORY_FORBIDDEN.test(binding)) problems.push(`${fileName}:${line(sourceFile, node)} imports ${binding} from ${from}`);
    }
  }
  for (const { name, node } of referencedNames(sourceFile)) {
    if (MEMORY_FORBIDDEN.test(name)) problems.push(`${fileName}:${line(sourceFile, node)} references ${name}`);
  }
  scanDb(fileName, sourceFile, MEMORY_DB_METHODS, MEMORY_WRITE_TABLES, problems);
  scanAliasing(fileName, sourceFile, problems);
  scanDynamic(fileName, sourceFile, problems);
  return [...new Set(problems)];
}

/** The one module that may write `wren_memory` (rule M5). */
const MEMORY_WRITER = "convex/workspace/wrenMemory.ts";

/** Unwraps parentheses, `as`, `satisfies` and non-null `!`. */
function unwrap(node) {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)) {
    return unwrap(node.expression);
  }
  return node;
}

/**
 * The string `node` always evaluates to, when the AST alone can tell: a
 * string literal, a `+` of static strings (`"wren_" + "memory"`), or a
 * template whose parts are all static (`` `wren_${"memory"}` ``). Else null.
 */
function staticString(node) {
  const inner = unwrap(node);
  if (ts.isStringLiteralLike(inner)) return inner.text;
  if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(inner.left);
    const right = staticString(inner.right);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(inner)) {
    let text = inner.head.text;
    for (const span of inner.templateSpans) {
      const part = staticString(span.expression);
      if (part === null) return null;
      text += part + span.literal.text;
    }
    return text;
  }
  return null;
}

/** Whether `node` is, or holds (an array for `.apply`), the static string `wren_memory`. */
function holdsMemoryTable(node) {
  const inner = unwrap(node);
  if (ts.isArrayLiteralExpression(inner)) return inner.elements.some(holdsMemoryTable);
  return staticString(inner) === "wren_memory";
}

function isBareMemoryTable(node) {
  return staticString(node) === "wren_memory";
}

/** A type annotation that names the table: `Id<"wren_memory">` or `Doc<"wren_memory">`. */
const MEMORY_TYPE = /\b(?:Id|Doc)\s*<\s*["'`]wren_memory["'`]\s*>/u;
/** An expression that reads the table: `.query("wren_memory")` or `.get("wren_memory", ...)`. */
const MEMORY_READ = /\.(?:query|get)\s*\(\s*["'`]wren_memory["'`]/u;

/** The identifier an expression is rooted at (`row` for `row._id`, `rows[0]._id`, `row!._id`), or null. */
function rootName(node) {
  const inner = unwrap(node);
  if (ts.isIdentifier(inner)) return inner.text;
  if (ts.isPropertyAccessExpression(inner) || ts.isElementAccessExpression(inner)) return rootName(inner.expression);
  if (ts.isAwaitExpression(inner)) return rootName(inner.expression);
  return null;
}

let memoryRowReadersCache = null;

/**
 * The exports of the writer that return a `wren_memory` row (`readWrenMemory`):
 * exported functions whose declared return type names `MemoryRow` or
 * `Doc<"wren_memory">`. Read from the writer's source, so a new reader is
 * covered without editing this list.
 */
export function memoryRowReaders() {
  if (memoryRowReadersCache !== null) return memoryRowReadersCache;
  const sourceFile = parse(MEMORY_WRITER, readFileSync(path.join(root, MEMORY_WRITER), "utf8"));
  const readers = new Set();
  for (const statement of sourceFile.statements) {
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
    if (exported && ts.isFunctionDeclaration(statement) && statement.name !== undefined && statement.type !== undefined &&
      /\bMemoryRow\b|\bDoc\s*<\s*["'`]wren_memory["'`]\s*>/u.test(statement.type.getText(sourceFile))) {
      readers.add(statement.name.text);
    }
  }
  memoryRowReadersCache = readers;
  return readers;
}

/** Local names (and namespace names) through which this file calls a writer export that returns a memory row. */
function memoryReaderCalls(sourceFile) {
  const readers = memoryRowReaders();
  const direct = new Set();
  const namespaces = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (resolveLocal(sourceFile.fileName, statement.moduleSpecifier.text) !== MEMORY_WRITER) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings !== undefined && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (readers.has((element.propertyName ?? element.name).text)) direct.add(element.name.text);
      }
    }
    if (bindings !== undefined && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
  }
  return (node) => {
    const inner = unwrap(node);
    const call = ts.isAwaitExpression(inner) ? unwrap(inner.expression) : inner;
    if (!ts.isCallExpression(call)) return false;
    const callee = unwrap(call.expression);
    if (ts.isIdentifier(callee)) return direct.has(callee.text);
    return ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) &&
      namespaces.has(callee.expression.text) && readers.has(callee.name.text);
  };
}

/** Every identifier bound by a declaration name, destructuring included (`const { _id } = row`). */
function boundNames(name) {
  if (ts.isIdentifier(name)) return [name.text];
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    return name.elements.flatMap((element) => (ts.isBindingElement(element) ? boundNames(element.name) : []));
  }
  return [];
}

/**
 * Names in this file that hold a `wren_memory` row or id, where the AST can
 * tell: declared with `Id<"wren_memory">` / `Doc<"wren_memory">`; initialised
 * from a query or get on "wren_memory" (also `for (const row of ...)` and
 * destructuring), or from a call to a writer export that returns a row
 * (`readWrenMemory`, imported by name or namespace); or initialised from such
 * a name (`const id = row._id`). By name, per file: a deliberately shadowed
 * name can fool it (see the header).
 */
function memoryNames(sourceFile) {
  const names = new Set();
  const pending = [];
  const readsRow = memoryReaderCalls(sourceFile);
  walk(sourceFile, (node) => {
    if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
      const bound = boundNames(node.name);
      if (node.type !== undefined && MEMORY_TYPE.test(node.type.getText(sourceFile))) for (const name of bound) names.add(name);
      else if (node.initializer !== undefined) for (const name of bound) pending.push({ name, init: node.initializer });
    }
    if (ts.isForOfStatement(node) && ts.isVariableDeclarationList(node.initializer)) {
      for (const declaration of node.initializer.declarations) {
        for (const name of boundNames(declaration.name)) pending.push({ name, init: node.expression });
      }
    }
  });
  let grew = true;
  while (grew) {
    grew = false;
    for (const { name, init } of pending) {
      if (names.has(name)) continue;
      const root = rootName(init);
      if (MEMORY_READ.test(init.getText(sourceFile)) || readsRow(init) || (root !== null && names.has(root))) {
        names.add(name);
        grew = true;
      }
    }
  }
  return { names, readsRow };
}

/** Whether a write's first argument is an id the AST ties to `wren_memory` (the id-only `patch(id, v)` form). */
function isMemoryId(node, { names, readsRow }, sourceFile) {
  const root = rootName(node);
  if ((root !== null && names.has(root)) || MEMORY_READ.test(node.getText(sourceFile))) return true;
  // Inline: `(await readWrenMemory(ctx, b))._id`.
  let base = unwrap(node);
  while (ts.isPropertyAccessExpression(base) || ts.isElementAccessExpression(base)) base = unwrap(base.expression);
  return readsRow(base);
}

/** Rule M5 for one file: a `wren_memory` write outside `MEMORY_WRITER`. */
export function scanMemoryWriters(fileName, source) {
  if (fileName === MEMORY_WRITER) return [];
  const sourceFile = parse(fileName, source);
  const names = memoryNames(sourceFile);
  const problems = [];
  walk(sourceFile, (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile);
      if (/\b(?:insert|patch|replace|delete)\b/u.test(callee)) {
        // `.call(db, ...)` / `.apply(db, [...])`: the table or id follows the `this` argument.
        const viaCall = /\.(?:call|apply)$/u.test(callee);
        const args = viaCall ? node.arguments.slice(1) : node.arguments;
        const first = args[0];
        const firstHolds = first !== undefined && (ts.isArrayLiteralExpression(unwrap(first))
          ? unwrap(first).elements.length > 0 && isMemoryId(unwrap(first).elements[0], names, sourceFile)
          : isMemoryId(first, names, sourceFile));
        if (node.arguments.some(holdsMemoryTable)) {
          problems.push(`${fileName}:${line(sourceFile, node)} writes wren_memory outside ${MEMORY_WRITER}`);
        } else if (firstHolds) {
          problems.push(`${fileName}:${line(sourceFile, node)} writes a wren_memory id outside ${MEMORY_WRITER}`);
        }
      }
    }
    // A name bound to the table name (not a list of table names, like authz's child-table list).
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined && isBareMemoryTable(node.initializer)) {
      problems.push(`${fileName}:${line(sourceFile, node)} binds the wren_memory table name outside ${MEMORY_WRITER}`);
    }
    if (ts.isPropertyAssignment(node) && isBareMemoryTable(node.initializer)) {
      problems.push(`${fileName}:${line(sourceFile, node)} binds the wren_memory table name outside ${MEMORY_WRITER}`);
    }
  });
  return problems;
}

/** Every `.ts` file under `convex/`, except `_generated` and tests. */
async function convexSources(dir = "convex") {
  const out = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "_generated" && entry.name !== "node_modules") out.push(...await convexSources(relative));
    } else if (entry.name.endsWith(".ts") && !/\.test\.tsx?$/u.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(relative);
    }
  }
  return out;
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

test("the memory modules write only wren_memory and audit_events, and reach no side effect", async () => {
  for (const relative of MEMORY_FILES) {
    const source = await readFile(path.join(root, relative), "utf8");
    assert.deepEqual(scanMemory(relative, source), []);
  }
});

test("repo-wide: only convex/workspace/wrenMemory.ts writes wren_memory (M5)", async () => {
  const files = await convexSources();
  assert.ok(files.includes(MEMORY_WRITER) && files.length > 50, "the walk reached convex/");
  const problems = [];
  for (const relative of files) problems.push(...scanMemoryWriters(relative, await readFile(path.join(root, relative), "utf8")));
  assert.deepEqual(problems, []);
});

test("fixtures: the repo-wide memory-writer scan catches a write elsewhere (M5)", () => {
  const offenders = {
    patch: "export async function f(ctx, id){ await ctx.db.patch(\"wren_memory\", id, { ownerId: id }); }",
    insert: "export async function f(ctx){ await ctx.db.insert(\"wren_memory\", {}); }",
    replace: "export async function f(ctx, id){ await ctx.db.replace(\"wren_memory\", id, {}); }",
    remove: "export async function f(ctx, id){ await ctx.db.delete(\"wren_memory\", id); }",
    optional: "export async function f(ctx){ await ctx.db?.insert(\"wren_memory\", {}); }",
    template: "export async function f(ctx){ await ctx.db.insert(`wren_memory`, {}); }",
    alias: "export async function f(ctx){ const d = ctx.db; await d.patch(\"wren_memory\", 1, {}); }",
    viaCall: "export async function f(ctx){ await ctx.db.insert.call(ctx.db, \"wren_memory\", {}); }",
    viaApply: "export async function f(ctx){ await ctx.db.insert.apply(ctx.db, [\"wren_memory\", {}]); }",
    constTable: "const T = \"wren_memory\"; export async function f(ctx, id){ await ctx.db.patch(T, id, {}); }",
    cast: "export async function f(ctx){ await ctx.db.insert((\"wren_memory\" as const), {}); }",
    // Re-review: concatenation, object properties and the id-only forms.
    concat: "export async function f(ctx){ await ctx.db.insert(\"wren_\" + \"memory\", {}); }",
    templateParts: "export async function f(ctx){ await ctx.db.insert(`wren_${\"memory\"}`, {}); }",
    objectProp: "const T = { t: \"wren_memory\" }; export async function f(ctx, id){ await ctx.db.patch(T.t, id, {}); }",
    legacyPatch: "export async function f(ctx, b){ const row = await ctx.db.query(\"wren_memory\").withIndex(\"by_projectId\", (q) => q.eq(\"projectId\", b)).first(); if (row) await ctx.db.patch(row._id, { facts: [\"injected\"] }); }",
    legacyReplace: "export async function f(ctx){ const row = await ctx.db.query(\"wren_memory\").first(); await ctx.db.replace(row._id, { ...row, summary: \"x\" }); }",
    legacyDeleteTyped: "export async function f(ctx: Ctx, id: Id<\"wren_memory\">){ await ctx.db.delete(id); }",
    legacyDocTyped: "export async function f(ctx: Ctx, row: Doc<\"wren_memory\">){ await ctx.db.patch(row._id, { summary: \"\" }); }",
    legacyIdVar: "export async function f(ctx){ const row = await ctx.db.query(\"wren_memory\").first(); const id = row!._id; await ctx.db.delete(id); }",
    legacyLoop: "export async function f(ctx){ for (const row of await ctx.db.query(\"wren_memory\").take(5)) await ctx.db.delete(row._id); }",
    legacyGet: "export async function f(ctx, id){ const row = await ctx.db.get(\"wren_memory\", id); await ctx.db.patch(row._id, {}); }",
    legacyInline: "export async function f(ctx){ await ctx.db.delete((await ctx.db.query(\"wren_memory\").first())._id); }",
    legacyViaCall: "export async function f(ctx, id: Id<\"wren_memory\">){ await ctx.db.delete.call(ctx.db, id); }",
    // Last round: a row from the writer's exported reader, and destructuring.
    importedReader: "import { readWrenMemory } from \"./wrenMemory\"; export async function f(ctx, b){ const row = await readWrenMemory(ctx, b); if (row) await ctx.db.patch(row._id, { facts: [] }); }",
    importedReaderAlias: "import { readWrenMemory as load } from \"./wrenMemory\"; export async function f(ctx, b){ const row = await load(ctx, b); await ctx.db.delete(row!._id); }",
    importedReaderNamespace: "import * as memory from \"./wrenMemory\"; export async function f(ctx, b){ const row = await memory.readWrenMemory(ctx, b); await ctx.db.replace(row._id, {}); }",
    importedReaderInline: "import { readWrenMemory } from \"./wrenMemory\"; export async function f(ctx, b){ await ctx.db.delete((await readWrenMemory(ctx, b))!._id); }",
    destructured: "export async function f(ctx){ const { _id } = await ctx.db.query(\"wren_memory\").first(); await ctx.db.delete(_id); }",
  };
  for (const [label, source] of Object.entries(offenders)) {
    assert.notDeepEqual(scanMemoryWriters(`convex/workspace/other-${label}.ts`, source), [], label);
  }
  // Documented limits (see the header): an untyped id, a helper's parameter, a spread.
  for (const source of [
    "export async function f(ctx, id){ await ctx.db.delete(id); }",
    "async function w(ctx, table, id, v){ await ctx.db.patch(table, id, v); } export async function f(ctx, id){ await w(ctx, \"wren_memory\", id, {}); }",
    "const A = [\"wren_memory\", 1, {}]; export async function f(ctx){ await ctx.db.patch(...A); }",
  ]) assert.deepEqual(scanMemoryWriters("convex/workspace/other-limit.ts", source), [], source);
  // The writer's row readers are found from its source.
  assert.ok(memoryRowReaders().has("readWrenMemory"));
  assert.ok(!memoryRowReaders().has("pairedFounderMessage"));
  // A chat row from the writer's pair matcher is not a memory row.
  assert.deepEqual(scanMemoryWriters("convex/workspace/other-pair.ts",
    "import { pairedFounderMessage } from \"./wrenMemory\"; export async function f(ctx, r){ const founder = await pairedFounderMessage(ctx, r); await ctx.db.patch(founder._id, {}); }"), []);
  // Id-only writes to other tables are fine, even next to a memory read.
  assert.deepEqual(scanMemoryWriters("convex/workspace/other-ok.ts",
    "export async function f(ctx, msg: Id<\"chat_messages\">){ const m = await ctx.db.query(\"wren_memory\").first(); const row = await ctx.db.get(\"chat_messages\", msg); await ctx.db.patch(row._id, {}); return m; }"), []);
  // Reads elsewhere are fine; the writer itself is exempt.
  assert.deepEqual(scanMemoryWriters("convex/workspace/chat.ts",
    "export async function f(ctx){ return await ctx.db.query(\"wren_memory\").first(); }"), []);
  assert.deepEqual(scanMemoryWriters(MEMORY_WRITER, "export async function f(ctx){ await ctx.db.insert(\"wren_memory\", {}); }"), []);
});

test("every local module the chat and handler modules import is scanned, a named gate, or type-only", async () => {
  const scanned = new Set([...Object.keys(STRICT_FILES), ...CHAT_FILES, ...MEMORY_FILES, ...PURE_HELPERS]);
  const allowlists = [...Object.entries(CHAT_IMPORTS), ...Object.entries(STRICT_FILES), ...Object.entries(MEMORY_IMPORTS)];
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
    // Re-review probes (M-A, M-B, minors 1-2).
    dynKeysParam: "async function g(c){ const k = \"d\"+\"b\"; const w = \"ins\"+\"ert\"; await c[k][w](\"approvals\", {status:\"approved\"}); } export async function f(ctx){ await g(ctx); }",
    objectValues: "export async function f(ctx){ const d = Object.values(ctx).find((x) => x !== null && typeof x === \"object\" && \"insert\" in x); const w = [\"ins\",\"ert\"].join(\"\"); await d[w](\"approvals\", {status:\"approved\"}); }",
    objectValuesPatch: "export async function f(ctx, id){ const d = Object.values(ctx).find((x) => typeof x === \"object\"); await d[[\"pat\",\"ch\"].join(\"\")](\"approvals\", id, {status:\"approved\"}); }",
    shadowCard: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b){ const card = { kind: \"upgrade\", subjectTable: \"projects\", subjectId: b.p }; await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }); }",
    shadowCardArtifact: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b, card){ card = { kind: \"ad_launch\", subjectTable: \"ad_campaigns\", subjectId: b.s }; await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }); }",
    typedReassign: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b, card: ApprovalCard){ card = { kind: \"upgrade\" }; await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }); }",
    typedFieldWrite: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b, card: ApprovalCard){ card.kind = \"spend\"; await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }); }",
    typedShadowBlock: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b, card: ApprovalCard){ { const card = { kind: \"upgrade\" }; await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }); } }",
    typedDestructureWrite: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b, card: ApprovalCard){ ({ k: card.kind } = { k: \"spend\" }); await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }); }",
    fnCtor: "export async function f(ctx){ const F = (async () => {}).constructor; await F(\"c\", \"return c.db.patch(\\\"approvals\\\", c.id, {status:\\\"approved\\\"})\")(ctx); }",
    globalEval: "export async function f(ctx){ await global.eval(\"1\"); }",
    selfFunction: "export async function f(ctx){ new self.Function(\"c\",\"return c\")(ctx); }",
    reexport: "export { createApproval } from \"./approvals\"; export * from \"../ops/settings\";",
    moduleRequire: "export async function f(){ module.require(\"x\"); }",
    stringKey: "export async function f(x){ const g = x[\"insert\"]; await g(\"approvals\", {}); }",
    staticMapShadow: "async function g(FIELDS, k){ await FIELDS[k][k](\"approvals\", {}); } export async function f(ctx){ await g(ctx, \"db\"); }",
    objectAssign: "export async function f(ctx){ const o = Object.assign({}, ctx); return o; }",
    protoAccess: "export async function f(ctx){ return ctx.__proto__; }",
  };
  for (const [label, source] of Object.entries(offenders)) {
    assert.notDeepEqual(scanStrict(`fixture-${label}.ts`, source, allowed), [], label);
  }
  assert.deepEqual(scanStrict("fixture-ok.ts", "import { v } from \"convex/values\"; export const x = v.string(); const y = { publish: 1, send: 2 };", allowed), []);
  assert.deepEqual(scanStrict(
    "fixture-ok-create.ts",
    "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, card: ApprovalCard, b){ await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: card.kind, subjectTable: card.subjectTable, subjectId: card.subjectId }); await ctx.db.insert(\"audit_events\", { metadata: JSON.stringify({ kind: card.kind }) }); }",
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
    // Re-review probes (M-A, minors 1-2).
    dynKeysParam: "async function g(c){ const k = \"d\"+\"b\"; await c[k][[\"pat\",\"ch\"].join(\"\")](\"approvals\", c.id, {status:\"approved\"}); } export async function f(ctx){ await g(ctx); }",
    objectValues: "export async function f(ctx, id){ const d = Object.values(ctx).find((x) => typeof x === \"object\"); await d[[\"pat\",\"ch\"].join(\"\")](\"approvals\", id, {status:\"approved\"}); }",
    runViaValues: "import { internal } from \"../_generated/api\"; export async function f(ctx){ const r = Object.values(ctx).find((x) => typeof x === \"function\"); await r(internal.workspace.chat.finishWrenTurn, {}); }",
    elementInternalChain: "import { internal } from \"../_generated/api\"; export async function f(ctx){ const k=\"approvals\"; await ctx.runMutation(internal.workspace.chat.finishWrenTurn, {}); const y = (internal.workspace)[k]; }",
    globalEval: "export async function f(ctx){ await global.eval(\"ctx.db.patch('approvals')\"); }",
    reexport: "export * from \"../growth/email/sender\";",
    reexportNamed: "export { decideApproval as choose } from \"./approvals\";",
    entriesOfCtx: "export async function f(ctx){ for (const [k, v] of Object.entries(ctx)) void k; }",
    descriptor: "export async function f(ctx){ return Object.getOwnPropertyDescriptor(ctx, \"db\"); }",
    reflectApply: "export async function f(ctx){ return Reflect.apply(ctx.runMutation, ctx, []); }",
    // WP77-S5: chat never writes memory itself, nor reaches the memory writer's other exports.
    memoryPatch: "export async function f(ctx, id){ await ctx.db.patch(\"wren_memory\", id, { facts: [] }); }",
    memoryInsert: "export async function f(ctx, b){ await ctx.db.insert(\"wren_memory\", { ownerId: b.o, projectId: b.p, facts: [\"x\"], summary: \"\", updatedAt: 1 }); }",
    memoryFounderEdit: "import { applyFounderMemoryEdit } from \"./wrenMemory\"; export async function f(ctx, b){ await applyFounderMemoryEdit(ctx, b, { kind: \"delete_fact\", index: 0, expected: \"x\" }); }",
    memoryPublicMutation: "import { internal } from \"../_generated/api\"; export async function f(ctx){ await ctx.runMutation(internal.workspace.memory.editWrenMemoryFact, {}); }",
  };
  for (const [label, source] of Object.entries(chatOffenders)) {
    assert.notDeepEqual(scanChat(`chat-${label}.ts`, source), [], label);
  }
  assert.deepEqual(scanChat("chat-ok.ts", "import { internal } from \"../_generated/api\"; export async function f(ctx) { await ctx.scheduler.runAfter(0, internal.workspace.chatActions.runWrenTurn, {}); await ctx.db.patch(\"chat_messages\", ctx.id, {}); }"), []);
});

test("fixtures: the memory scan catches each side-effect shape", () => {
  const offenders = {
    createApproval: "import { createApprovalRecord } from \"./approvals\"; export async function f(ctx, b){ await createApprovalRecord(ctx, { ownerId: b.o, projectId: b.p, kind: \"publish\", subjectTable: \"site_versions\", subjectId: b.s }); }",
    decide: "import { decideApproval } from \"./approvals\"; export async function f(ctx){ await decideApproval(ctx, {}); }",
    decideBare: "export async function f(ctx){ await decideApproval(ctx, {}); }",
    raiseCard: "import { raiseApprovalCard } from \"./wrenCards\"; export async function f(ctx, b, c){ await raiseApprovalCard(ctx, b, c); }",
    insertApproval: "export async function f(ctx){ await ctx.db.insert(\"approvals\", { status: \"approved\" }); }",
    patchApproval: "export async function f(ctx, id){ await ctx.db.patch(\"approvals\", id, { status: \"approved\" }); }",
    patchChat: "export async function f(ctx, id){ await ctx.db.patch(\"chat_messages\", id, { body: \"\" }); }",
    replaceMemory: "export async function f(ctx, id){ await ctx.db.replace(\"wren_memory\", id, {}); }",
    auditPatch: "export async function f(ctx, id){ await ctx.db.patch(\"audit_events\", id, { metadata: \"x\" }); }",
    auditReplace: "export async function f(ctx, id){ await ctx.db.replace(\"audit_events\", id, {}); }",
    auditDelete: "export async function f(ctx, id){ await ctx.db.delete(\"audit_events\", id); }",
    idOnlyPatch: "export async function f(ctx, id){ await ctx.db.patch(id, { metadata: \"x\" }); }",
    idOnlyRowPatch: "export async function f(ctx, row){ await ctx.db.patch(row._id, { facts: [] }); }",
    idOnlyDelete: "export async function f(ctx, id){ await ctx.db.delete(id); }",
    storageUpload: "export async function f(ctx){ return await ctx.storage.generateUploadUrl(); }",
    deleteMemory: "export async function f(ctx, id){ await ctx.db.delete(\"wren_memory\", id); }",
    dynamicTable: "export async function f(ctx, t){ await ctx.db.insert(t, {}); }",
    schedule: "export async function f(ctx){ await ctx.scheduler.runAfter(0, x, {}); }",
    runMutation: "export async function f(ctx){ await ctx.runMutation(x, {}); }",
    runAction: "export async function f(ctx){ await ctx.runAction(x, {}); }",
    internalRef: "import { internal } from \"../_generated/api\"; const r = internal.workspace.approvals.decideApproval;",
    fetch: "export async function f(){ await fetch(\"https://evil.example\"); }",
    sender: "export async function f(ctx){ await sendSequenceEmail(ctx, {}); }",
    publisher: "export async function f(ctx){ await publishLanding(ctx, {}); }",
    poster: "export async function f(ctx){ await postSocial(ctx, {}); }",
    debit: "export async function f(ctx){ await debitTask(ctx, {}); }",
    limits: "import { checkLimit } from \"../platform/limits\"; export async function f(ctx, o){ await checkLimit(ctx, \"wrenMessage\", o); }",
    importChat: "import { finishWrenTurn } from \"./chat\"; export const g = finishWrenTurn;",
    elementAccess: "export async function f(ctx){ await ctx.db[\"insert\"](\"approvals\", {}); }",
    aliasDb: "export async function f(ctx){ const d = ctx.db; await d.insert(\"wren_memory\", {}); }",
    dynamicKey: "export function f(facts, i){ return facts[i]; }",
    objectValues: "export async function f(ctx){ return Object.values(ctx); }",
    reexport: "export * from \"./approvals\";",
  };
  for (const [label, source] of Object.entries(offenders)) {
    assert.notDeepEqual(scanMemory(`memory-${label}.ts`, source), [], label);
  }
  assert.deepEqual(scanMemory(
    "memory-ok.ts",
    "import { v } from \"convex/values\"; export const x = v.string(); export async function f(ctx, b, id, n){ await ctx.db.insert(\"wren_memory\", { ownerId: b.o, projectId: b.p, facts: [], summary: \"\", updatedAt: n }); await ctx.db.patch(\"wren_memory\", id, { facts: [\"a\"] }); await ctx.db.insert(\"audit_events\", { action: \"memory.fact_edited\" }); return b.facts.at(0); }",
  ), []);
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
