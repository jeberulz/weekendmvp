/**
 * WP71-S3. Provider SDKs and provider API hosts stay inside
 * `convex/ai/providers/` (`02` §5.5): every crew model call goes through the
 * metered gateway, so nothing else may hold a client or call a provider.
 *
 * The story names `tests/security/ai-imports.test.ts`; this is `.mjs` so the
 * existing `test:security` glob (`node --test tests/security/*.test.mjs`) runs
 * it without a `package.json` change.
 *
 * Scanned: every `ts/tsx/mts/cts/js/jsx/mjs/cjs` file `git ls-files` reports
 * (tracked, plus untracked files that are not ignored), with a filesystem walk
 * as the fallback when git is not there. Left out: `SKIP_DIRS` as top-level
 * directories only (`node_modules`, build output, `.git`, `.worktrees`,
 * `.claude`), so `app/build/[slug]/page.tsx` is still scanned, and exactly
 * `convex/_generated/`. That includes the repo root's config files and `tests/`. Parsed with the
 * TypeScript compiler, so comments and prose never count.
 *
 * Outside `convex/ai/providers/` it fails on:
 * - a provider SDK in any `import`, `export … from`, `import x = require()`,
 *   `require()`, `import()` or `import("x")` type (type-only imports included);
 * - a module loader the scan cannot read, unless allowlisted with a reason: a
 *   non-literal `import()` or `require()` argument; `require.<member>` (e.g.
 *   `require.resolve`); `require` used as a value (`const r = require`);
 *   `createRequire(...)`; any import of `module` /
 *   `node:module` (which covers aliased or destructured `createRequire`);
 *   `process.getBuiltinModule` in any form; `eval` in any form; the `Function`
 *   constructor (`Function(...)`, `new Function(...)`, `globalThis.Function`);
 *   a `.require` / `._load` member on any owner, called or not
 *   (`process.mainModule.require`, `module.parent.require`,
 *   `module.constructor._load`); and any use of `module.constructor`;
 * - a `package.json` dependency (nested `overrides` / `resolutions` included)
 *   whose value is `npm:<provider SDK>`, an alias that would hide the SDK
 *   behind another import name;
 * - a provider API host in a string or template literal, or a provider domain
 *   fragment (`anthropic.com`, `openai.com`, `recraft.ai`) in a string built by
 *   concatenation or a template with substitutions, unless allowlisted.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
/**
 * Top-level directories left out. Matched against the first path segment only,
 * so a source folder named `build` or `dist` deeper in the tree (e.g.
 * `app/build/[slug]/page.tsx`) is still scanned.
 */
export const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  ".vercel",
  "dist",
  "build",
  "coverage",
  ".git",
  ".worktrees",
  ".claude",
]);
/** Exact directory prefixes left out: Convex's generated client only. */
export const SKIP_PREFIXES = ["convex/_generated/"];
/** ts, tsx, mts, cts, js, jsx, mjs, cjs (declaration files included). */
const SOURCE_EXT = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const PROVIDER_DIR = "convex/ai/providers/";

/** Provider SDK package names. Bare specifiers only; relative and `@/` paths never match. */
export function isProviderSdk(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) return false;
  const pkg = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
  return (
    pkg.startsWith("@anthropic-ai/") ||
    pkg === "openai" ||
    pkg.startsWith("@openai/") ||
    pkg.startsWith("@ai-sdk/") ||
    pkg === "ai" ||
    /recraft/iu.test(pkg)
  );
}

export const PROVIDER_HOSTS = ["api.anthropic.com", "api.openai.com", "external.api.recraft.ai"];
export const PROVIDER_DOMAIN_FRAGMENTS = ["anthropic.com", "openai.com", "recraft.ai"];

/**
 * Pre-existing direct provider calls outside `convex/ai/providers/`. Each is a
 * raw `fetch` to an endpoint constant; none imports an SDK. They are not moved
 * here. An entry that stops matching fails the test, so the list only shrinks.
 */
const HOST_ALLOWLIST = new Map([
  ["lib/og/providers/openai.mjs", { hosts: ["api.openai.com"], reason: "OG card pipeline (scripts/generate-og-cards.mjs), pre-WP commit 323369e9; build-time only" }],
  ["lib/og/providers/recraft.mjs", { hosts: ["external.api.recraft.ai"], reason: "OG card pipeline, pre-WP commit e7318611; build-time only" }],
  ["lib/engine/providers/openai.ts", { hosts: ["api.openai.com"], reason: "WP26-S2 engine synthesis adapter; 02 §5.5 / D11 keep the engine adapters" }],
  [
    "tests/security/ai-imports.test.mjs",
    {
      hosts: ["api.anthropic.com", "api.openai.com", "external.api.recraft.ai"],
      reason: "this scanner's own synthetic fixtures hold provider hosts as string data, never called",
    },
  ],
  [
    "tests/platform/ai-providers.test.ts",
    {
      hosts: ["api.anthropic.com", "api.openai.com", "external.api.recraft.ai"],
      reason: "WP71-S1 adapter tests assert the endpoints the adapters call, with fake transports",
    },
  ],
]);

/** Pre-existing SDK imports outside `convex/ai/providers/`: tests of the adapters only. */
const SDK_ALLOWLIST = new Map([
  ["tests/platform/ai-gateway.test.ts", { sdks: ["@anthropic-ai/sdk"], reason: "WP71-S2 gateway tests build SDK error objects for the adapter" }],
  ["tests/platform/ai-providers.test.ts", { sdks: ["@anthropic-ai/sdk"], reason: "WP71-S1 adapter tests build SDK replies and errors" }],
]);

/**
 * Pre-existing loaders the scan cannot follow. Each loads a repo-local file
 * built from a fixed path (or a font package), never a provider SDK.
 */
const LOADER_ALLOWLIST = new Map([
  ["lib/og/fonts.mjs", { forms: ["node:module", "createRequire", "require.resolve"], reason: "OG pipeline: resolves Geist WOFF files from node_modules (pre-WP)" }],
  ["tests/editorial/scripts/verify-convex-bundle.mjs", { forms: ["node:module", "createRequire"], reason: "WP46 offline Convex bundle check: loads esbuild through createRequire" }],
  ["tests/sitemap/gsc-not-indexed.test.mjs", { forms: ["node:module", "createRequire"], reason: "sitemap test: requires ideas/manifest.json through createRequire" }],
  ["lib/engine/audit.redos.test.ts", { forms: ["import(non-literal)"], reason: "WP54 engine test: imports a repo script by fixed path" }],
  ["lib/engine/page-format.test.ts", { forms: ["import(non-literal)"], reason: "WP54-S4 engine test: imports a repo script by fixed path" }],
  ["lib/engine/audit.identity.test.ts", { forms: ["import(non-literal)"], reason: "WP54 engine test: imports scripts/validate-idea-tags.mjs" }],
  ["lib/engine/__fixtures__/auditHarness.ts", { forms: ["import(non-literal)"], reason: "WP54-S4 engine test harness: imports the auditor script by fixed path" }],
  ["scripts/engine-compile.mjs", { forms: ["import(non-literal)"], reason: "engine CLI: imports lib/engine/*.ts by fixed path" }],
  ["scripts/engine-research.mjs", { forms: ["import(non-literal)"], reason: "engine CLI (WP54): imports lib/engine/*.ts by fixed path" }],
  ["scripts/engine-replay.mjs", { forms: ["import(non-literal)"], reason: "engine replay: imports only scripts/lib/resolve-engine-node.mjs by fixed repo path" }],
  ["scripts/engine-source-review.mjs", { forms: ["import(non-literal)"], reason: "engine source review: imports only lib/engine/research-record.ts and source-review.ts by fixed repo paths" }],
  ["scripts/publish-ideas-batch.mjs", { forms: ["import(non-literal)"], reason: "batch CLI: imports only scripts/lib/resolve-engine-node.mjs by fixed repo path" }],
  ["scripts/editorial-submit-engine.mjs", { forms: ["import(non-literal)"], reason: "editorial CLI: imports its own transpiled engine-validation.mjs" }],
  ["scripts/editorial-import-legacy.mjs", { forms: ["import(non-literal)"], reason: "editorial CLI: imports its own transpiled legacy-core.mjs" }],
  ["scripts/check-prompt-versions.mjs", { forms: ["import(non-literal)"], reason: "WP71-S3: loads each registered prompt module to verify entry.module" }],
]);

function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/u.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function stringValue(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}

function isPlus(node) {
  return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;
}

/** The nearest ancestor that is not a parenthesis, so `("a" + "b")` is still a top-level chain. */
function outerParent(node) {
  let parent = node.parent;
  while (parent && ts.isParenthesizedExpression(parent)) parent = parent.parent;
  return parent;
}

/** The literal pieces of a `+` chain or a template with substitutions. */
function builtParts(node) {
  if (ts.isParenthesizedExpression(node)) return builtParts(node.expression);
  if (isPlus(node)) return [...builtParts(node.left), ...builtParts(node.right)];
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
  const text = stringValue(node);
  return text === null ? [] : [text];
}

const LOADER_MODULES = new Set(["module", "node:module"]);
/** Member names that load a module whatever the owner: `process.mainModule.require`, `module.constructor._load`. */
const LOADER_MEMBERS = new Set(["require", "_load"]);

/** True inside a type annotation, where `Function` is a type, not the constructor. */
function inTypePosition(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isTypeNode(parent) && !ts.isExpressionWithTypeArguments(parent)) return true;
  }
  return false;
}

const isModuleIdentifier = (node) => ts.isIdentifier(node) && node.text === "module";

/** Positions where an identifier named `require` is a binding or member name, not a value. */
function isBindingName(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isTypeQueryNode(parent) || ts.isQualifiedName(parent)) return true;
  const named = [
    ts.isVariableDeclaration,
    ts.isParameter,
    ts.isFunctionDeclaration,
    ts.isFunctionExpression,
    ts.isBindingElement,
    ts.isImportSpecifier,
    ts.isImportClause,
    ts.isNamespaceImport,
    ts.isPropertyAssignment,
    ts.isMethodDeclaration,
    ts.isPropertyDeclaration,
    ts.isPropertySignature,
    ts.isMethodSignature,
  ];
  return named.some((is) => is(parent)) && parent.name === node;
}

/**
 * Module specifiers, string literal text, dynamically built strings and
 * loaders the scan cannot follow, in one source file. Loader forms:
 * `import(non-literal)`, `require(non-literal)`, `require.<member>` (e.g.
 * `require.resolve`), `require(as value)` (`const r = require`),
 * `createRequire`, `node:module` (any import of `module` / `node:module`, which
 * covers aliased or destructured `createRequire`),
 * `process.getBuiltinModule` (any use of that name, or `x["getBuiltinModule"]`),
 * `eval` (any use), `Function` (the constructor, outside type positions),
 * `.require` / `._load` (that member on any owner, called or not) and
 * `module.constructor`.
 */
export function scanSource(fileName, source) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  const specifiers = [];
  const strings = [];
  const built = [];
  const loaders = [];
  const addSpecifier = (text) => {
    specifiers.push(text);
    if (LOADER_MODULES.has(text)) loaders.push("node:module");
  };
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const text = stringValue(node.moduleSpecifier);
      if (text !== null) addSpecifier(text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const text = stringValue(node.moduleReference.expression);
      if (text !== null) addSpecifier(text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isRequire = ts.isIdentifier(callee) && callee.text === "require";
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) {
        const text = stringValue(node.arguments[0]);
        if (text !== null) addSpecifier(text);
        else loaders.push(isRequire ? "require(non-literal)" : "import(non-literal)");
      } else if (ts.isPropertyAccessExpression(callee)) {
        if (callee.name.text === "createRequire") loaders.push("createRequire");
      } else if (ts.isIdentifier(callee) && callee.text === "createRequire") {
        loaders.push("createRequire");
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const text = stringValue(node.argument.literal);
      if (text !== null) addSpecifier(text);
    } else if (ts.isElementAccessExpression(node)) {
      const key = stringValue(node.argumentExpression);
      if (key === "getBuiltinModule") loaders.push("process.getBuiltinModule");
      else if (key === "eval" || key === "Function") loaders.push(key);
      else if (key !== null && LOADER_MEMBERS.has(key)) loaders.push(`.${key}`);
      else if (key === "constructor" && isModuleIdentifier(node.expression)) loaders.push("module.constructor");
    } else if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.text;
      if (LOADER_MEMBERS.has(name)) loaders.push(`.${name}`);
      else if (name === "constructor" && isModuleIdentifier(node.expression)) loaders.push("module.constructor");
    }

    if (ts.isIdentifier(node)) {
      if (node.text === "getBuiltinModule") {
        loaders.push("process.getBuiltinModule");
      } else if (node.text === "eval") {
        loaders.push("eval");
      } else if (
        node.text === "Function" &&
        !inTypePosition(node) &&
        !(isBindingName(node) && !ts.isPropertyAccessExpression(node.parent))
      ) {
        loaders.push("Function");
      } else if (node.text === "require" && !isBindingName(node)) {
        const parent = node.parent;
        if (ts.isCallExpression(parent) && parent.expression === node) {
          // A call: its argument was handled above.
        } else if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
          loaders.push(`require.${parent.name.text}`);
        } else {
          loaders.push("require(as value)");
        }
      }
    }

    if (ts.isTemplateExpression(node) || (isPlus(node) && !isPlus(outerParent(node)))) {
      const parts = builtParts(node);
      if (parts.length > 0) built.push(parts.join(""), ...parts);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) strings.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) strings.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { specifiers, strings, built, loaders };
}

/**
 * Provider hosts found: a full host in any literal or built string, and a
 * domain fragment (reported as `*<fragment> (built)`) in a built string.
 */
export function hostsIn(strings, built = []) {
  const found = PROVIDER_HOSTS.filter((host) => [...strings, ...built].some((text) => text.includes(host)));
  for (const fragment of PROVIDER_DOMAIN_FRAGMENTS) {
    if (built.some((text) => text.includes(fragment))) found.push(`*${fragment} (built)`);
  }
  return found;
}

/** True when a repo-relative path sits in a skipped top-level directory or prefix. */
export function skipped(rel) {
  return SKIP_DIRS.has(rel.split("/")[0]) || SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

/** True for a source file the scan reads. */
export function keep(rel) {
  return SOURCE_EXT.test(rel) && !skipped(rel);
}

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "overrides", "resolutions"];

/** The package an `npm:<name>@<range>` alias installs, or null for any other value. */
export function aliasTarget(value) {
  if (typeof value !== "string" || !value.startsWith("npm:")) return null;
  const rest = value.slice("npm:".length);
  return rest.startsWith("@") ? `@${rest.slice(1).split("@")[0]}` : rest.split("@")[0];
}

/**
 * Dependencies that alias a provider SDK under another name (`"llm":
 * "npm:openai@4"`), which `import "llm"` would otherwise hide from the scan.
 * Walks the dependency fields, nested `overrides` / `resolutions` included.
 */
export function providerAliases(pkg) {
  const found = [];
  const walk = (value, where) => {
    if (typeof value === "string") {
      const target = aliasTarget(value);
      if (target !== null && isProviderSdk(target)) found.push(`${where} -> ${value}`);
    } else if (typeof value === "object" && value !== null) {
      for (const [key, item] of Object.entries(value)) walk(item, `${where}.${key}`);
    }
  };
  for (const field of DEPENDENCY_FIELDS) walk(pkg?.[field], field);
  return found;
}

/** Tracked and untracked-but-not-ignored files from git, or null when git is not there. */
export function gitListFiles() {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  return result.stdout.split("\0").filter((rel) => rel.length > 0);
}

/** Every file under the root, skipping SKIP_DIRS: the fallback when git is missing. */
export function walkFiles(dir = "") {
  const out = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir === "" ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!skipped(`${rel}/`)) out.push(...walkFiles(rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/** The source files to scan: `git ls-files` (filesystem walk as the fallback), filtered and sorted. */
export function listSourceFiles({ listGit = gitListFiles, walk = walkFiles } = {}) {
  const listed = listGit();
  const files = listed === null ? walk() : listed;
  return [...new Set(files)].filter((rel) => keep(rel) && existsSync(path.join(root, rel))).sort();
}

let scanned;
async function scanRepo() {
  if (scanned) return scanned;
  const files = listSourceFiles();
  scanned = await Promise.all(
    files.map(async (rel) => {
      const { specifiers, strings, built, loaders } = scanSource(rel, await readFile(path.join(root, rel), "utf8"));
      return { rel, sdks: specifiers.filter(isProviderSdk), hosts: hostsIn(strings, built), loaders: [...new Set(loaders)] };
    }),
  );
  return scanned;
}

const insideProviders = (rel) => rel.startsWith(PROVIDER_DIR);

// ---------------------------------------------------------------------------
// The scanner itself (synthetic sources)
// ---------------------------------------------------------------------------

test("the scanner sees every import form and ignores comments and local paths", () => {
  const { specifiers, strings, built } = scanSource(
    "probe.ts",
    [
      'import Anthropic from "@anthropic-ai/sdk";',
      'import type { ChatCompletion } from "openai/resources";',
      'export { generateText } from "ai";',
      'import "@ai-sdk/anthropic/side-effect";',
      'const r = require("recraft-sdk");',
      'const m = await import("@recraft-ai/client");',
      'import fs = require("openai");',
      'type T = import("@ai-sdk/openai").Provider;',
      'import { Agent } from "@openai/agents";',
      'import { x } from "./providers/openai";',
      'import { y } from "@/convex/ai/providers/anthropic";',
      'import { z } from "aim";',
      "// import nope from \"openai\"; fetch('https://api.openai.com/v1')",
      "const url = `https://api.anthropic.com/v1/${path}`;",
      'const recraft = "https://external.api.recraft.ai/v1/images";',
      'const docs = "https://docs.anthropic.com/en/home";',
    ].join("\n"),
  );
  assert.deepEqual(specifiers.filter(isProviderSdk), [
    "@anthropic-ai/sdk",
    "openai/resources",
    "ai",
    "@ai-sdk/anthropic/side-effect",
    "recraft-sdk",
    "@recraft-ai/client",
    "openai",
    "@ai-sdk/openai",
    "@openai/agents",
  ]);
  assert.deepEqual(hostsIn(strings, built), ["api.anthropic.com", "external.api.recraft.ai", "*anthropic.com (built)"]);
  assert.equal(hostsIn(['const docs = "https://docs.anthropic.com"']).length, 0, "a plain docs link is not a provider call");
});

test("the scanner flags loaders it cannot follow", () => {
  const cases = [
    ["const m = await import(name);", ["import(non-literal)"]],
    ["const m = await import(`./plugins/${name}.js`);", ["import(non-literal)"]],
    ["const m = require(name);", ["require(non-literal)"]],
    ['const p = require.resolve("openai");', ["require.resolve"]],
    ['import { createRequire } from "node:module"; const req = createRequire(import.meta.url);', ["node:module", "createRequire"]],
    ['import mod from "node:module"; const req = mod.createRequire(import.meta.url);', ["node:module", "createRequire"]],
    ['import { createRequire as cr } from "node:module"; const req = cr(import.meta.url);', ["node:module"]],
    ['const { createRequire: cr } = require("module"); cr(x)("openai");', ["node:module"]],
    ['const req = (await import("node:module")).createRequire(import.meta.url);', ["createRequire", "node:module"]],
    ['import * as m from "module"; m.default.createRequire;', ["node:module"]],
    ['const sdk = module.require("openai");', [".require"]],
    ['const sdk = process.mainModule.require("openai");', [".require"]],
    ['const sdk = module.parent.require("openai");', [".require"]],
    ['const r = process.mainModule.require; r("openai");', [".require"]],
    ['const sdk = module["require"]("openai");', [".require"]],
    ['const sdk = module.constructor._load("openai");', ["._load", "module.constructor"]],
    ['const M = module.constructor; M._load("openai");', ["module.constructor", "._load"]],
    ['const M = module["constructor"];', ["module.constructor"]],
    ['const sdk = eval("require")("openai");', ["eval"]],
    ['const e = globalThis.eval; e("1");', ["eval"]],
    ['const e = (0, eval); e("1");', ["eval"]],
    ['const e = globalThis["eval"];', ["eval"]],
    ['const f = new Function("return require")();', ["Function"]],
    ['const f = Function("return 1");', ["Function"]],
    ['const F = globalThis.Function; F("return 1");', ["Function"]],
    ['const F = globalThis["Function"];', ["Function"]],
    ['const m = process.getBuiltinModule("node:module");', ["process.getBuiltinModule"]],
    ['const { getBuiltinModule: g } = process; g("module");', ["process.getBuiltinModule"]],
    ['const m = process["getBuiltinModule"]("module");', ["process.getBuiltinModule"]],
    ['const r = require; r("openai");', ["require(as value)"]],
    ['const m = [require][0]("openai");', ["require(as value)"]],
    ['load({ require });', ["require(as value)"]],
    ["const c = require.cache;", ["require.cache"]],
  ];
  for (const [source, forms] of cases) {
    assert.deepEqual(scanSource("probe.mjs", source).loaders, forms, source);
  }
  const clean = [
    'const a = await import("./x"); const b = require("y");',
    "const o = { require: 1 }; function f(require) { return 1; }",
    "type R = typeof require;",
    "let cb: Function; type F = Function | null; interface I { f: Function }",
    'const $eval = 1; page.evaluate(() => 1); const c = obj.constructor; const s = "eval and new Function in a string";',
    'const text = "process.getBuiltinModule and createRequire in a string are only data";',
  ];
  for (const source of clean) assert.deepEqual(scanSource("probe.ts", source).loaders, [], source);
});

test("the scanner flags provider domains in concatenated and template-built strings", () => {
  const cases = [
    ['const u = "https://api." + "openai.com" + "/v1";', ["api.openai.com", "*openai.com (built)"]],
    ['const u = "https://" + host + ".anthropic.com/v1";', ["*anthropic.com (built)"]],
    ['const u = ("https://external.api." + ("recraft.ai")) + path;', ["external.api.recraft.ai", "*recraft.ai (built)"]],
    ["const u = `https://${sub}.openai.com/v1/${p}`;", ["*openai.com (built)"]],
    ['const u = "https://api.open" + "ai.com";', ["api.openai.com", "*openai.com (built)"]],
    ['const u = ("https://" + "api.anthropic.com");', ["api.anthropic.com", "*anthropic.com (built)"]],
  ];
  for (const [source, expected] of cases) {
    const { strings, built } = scanSource("probe.ts", source);
    assert.deepEqual(hostsIn(strings, built), expected, source);
  }
  const plain = scanSource("probe.ts", 'const a = "https://example.com/" + slug; const b = `see ${x}`;');
  assert.deepEqual(hostsIn(plain.strings, plain.built), []);
});

// ---------------------------------------------------------------------------
// The repository
// ---------------------------------------------------------------------------

test("the file list comes from git, with a filesystem walk as the fallback", () => {
  const fromGit = listSourceFiles();
  const fromWalk = listSourceFiles({ listGit: () => null });
  for (const files of [fromGit, fromWalk]) {
    for (const rel of [
      "convex/ai/providers/anthropic.ts",
      "middleware.ts",
      "next.config.ts",
      "vitest.config.ts",
      "tests/security/ai-imports.test.mjs",
      "app/build/[slug]/page.tsx",
    ]) {
      assert.ok(files.includes(rel), `${rel} was not listed`);
    }
    assert.ok(!files.some(skipped), "SKIP_DIRS and SKIP_PREFIXES must be skipped");
    assert.ok(!files.some((rel) => rel.startsWith("convex/_generated/")), "convex/_generated/ must be skipped");
  }
  assert.deepEqual(listSourceFiles({ listGit: () => ["a/b.ts", "node_modules/x/index.js", "README.md", "a/c.mjs"], walk: () => [] }), []);
  assert.deepEqual(
    listSourceFiles({ listGit: () => ["middleware.ts", "node_modules/openai/index.js", "README.md", "middleware.ts"] }),
    ["middleware.ts"],
    "git output is filtered by extension, SKIP_DIRS and existence, and deduped",
  );
});

test("skipped directories match the top level only; _generated is exactly convex/_generated/", () => {
  for (const rel of [
    "convex/crew/build/sdk.ts",
    "app/build/[slug]/page.tsx",
    "lib/dist/x.ts",
    "convex/crew/coverage/a.mjs",
    "lib/_generated/x.ts",
    "convex/crew/_generated/y.ts",
    "lib/node_modules/sneaky.ts",
  ]) {
    assert.equal(keep(rel), true, `${rel} must be scanned`);
  }
  for (const rel of ["build/x.js", "dist/a.js", "coverage/lcov.js", "node_modules/openai/index.js", ".next/server/a.js", "convex/_generated/api.js"]) {
    assert.equal(keep(rel), false, `${rel} must be skipped`);
  }
});

test("a dependency that aliases a provider SDK is flagged", async () => {
  const pkg = {
    dependencies: { llm: "npm:openai@^4.0.0", zod: "^4.0.0", other: "npm:left-pad@1" },
    devDependencies: { claude: "npm:@anthropic-ai/sdk@0.50.0" },
    optionalDependencies: { gen: "npm:ai" },
    peerDependencies: { scoped: "npm:@ai-sdk/openai@1" },
    overrides: { foo: { bar: "npm:@openai/agents@1" } },
    resolutions: { "x/y": "npm:recraft-client@2" },
    scripts: { test: "npm:openai" },
  };
  assert.deepEqual(providerAliases(pkg), [
    "dependencies.llm -> npm:openai@^4.0.0",
    "devDependencies.claude -> npm:@anthropic-ai/sdk@0.50.0",
    "optionalDependencies.gen -> npm:ai",
    "peerDependencies.scoped -> npm:@ai-sdk/openai@1",
    "overrides.foo.bar -> npm:@openai/agents@1",
    "resolutions.x/y -> npm:recraft-client@2",
  ]);
  assert.equal(aliasTarget("npm:@anthropic-ai/sdk"), "@anthropic-ai/sdk");
  assert.equal(aliasTarget("^1.0.0"), null);
  const real = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.deepEqual(providerAliases(real), [], "package.json must not alias a provider SDK under another name");
});

test("the scan reaches the provider adapters, the root config files and the tests", async () => {
  const files = await scanRepo();
  assert.ok(files.length > 100, `expected a real scan, got ${files.length} files`);
  const anthropic = files.find((file) => file.rel === "convex/ai/providers/anthropic.ts");
  assert.ok(anthropic, "convex/ai/providers/anthropic.ts was not scanned");
  assert.ok(anthropic.sdks.includes("@anthropic-ai/sdk"));
  assert.ok(anthropic.hosts.includes("api.anthropic.com"));
  for (const rel of ["middleware.ts", "next.config.ts", "vitest.config.ts", "tests/platform/ai-gateway.test.ts", "app/build/[slug]/page.tsx"]) {
    assert.ok(files.some((file) => file.rel === rel), `${rel} was not scanned`);
  }
});

function offendersFor(field, allowlist, allowedKey) {
  return async () => {
    const offenders = [];
    for (const file of await scanRepo()) {
      if (insideProviders(file.rel) || file[field].length === 0) continue;
      const allowed = allowlist.get(file.rel)?.[allowedKey] ?? [];
      const extra = [...new Set(file[field])].filter((item) => !allowed.includes(item));
      if (extra.length > 0) offenders.push(`${file.rel}: ${extra.join(", ")}`);
    }
    return offenders;
  };
}

test("provider SDKs are imported only inside convex/ai/providers/ (plus the reasoned allowlist)", async () => {
  assert.deepEqual(
    await offendersFor("sdks", SDK_ALLOWLIST, "sdks")(),
    [],
    "move provider SDK use into convex/ai/providers/ and call it through convex/ai/gateway.ts",
  );
});

test("no unreadable module loader outside convex/ai/providers/ (plus the reasoned allowlist)", async () => {
  assert.deepEqual(
    await offendersFor("loaders", LOADER_ALLOWLIST, "forms")(),
    [],
    "use a literal import, or allowlist the loader in LOADER_ALLOWLIST with a reason",
  );
});

test("provider API hosts appear only inside convex/ai/providers/ (plus the reasoned allowlist)", async () => {
  assert.deepEqual(
    await offendersFor("hosts", HOST_ALLOWLIST, "hosts")(),
    [],
    "provider calls belong in convex/ai/providers/, behind the metered gateway",
  );
});

test("every allowlist entry still matches and has a reason, so the allowlists only shrink", async () => {
  const byRel = new Map((await scanRepo()).map((file) => [file.rel, file]));
  const lists = [
    ["HOST_ALLOWLIST", HOST_ALLOWLIST, "hosts", "hosts"],
    ["SDK_ALLOWLIST", SDK_ALLOWLIST, "sdks", "sdks"],
    ["LOADER_ALLOWLIST", LOADER_ALLOWLIST, "forms", "loaders"],
  ];
  for (const [name, list, key, field] of lists) {
    for (const [rel, entry] of list) {
      assert.ok(typeof entry.reason === "string" && entry.reason.length > 10, `${rel} needs a reason in ${name}`);
      assert.ok(entry[key].length > 0, `${rel} in ${name} must name what it allows`);
      const file = byRel.get(rel);
      assert.ok(file, `${rel} is in ${name} but no longer exists; remove it`);
      for (const item of entry[key]) {
        assert.ok(file[field].includes(item), `${rel} no longer has ${item}; remove it from ${name}`);
      }
    }
  }
});
