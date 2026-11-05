/**
 * WP71-S3. Provider SDKs and provider API hosts stay inside
 * `convex/ai/providers/` (`02` §5.5): every crew model call goes through the
 * metered gateway, so nothing else may hold a client or call a provider.
 *
 * The story names `tests/security/ai-imports.test.ts`; this is `.mjs` so the
 * existing `test:security` glob (`node --test tests/security/*.test.mjs`) runs
 * it without a `package.json` change.
 *
 * Scanned: `convex/`, `lib/`, `app/`, `components/`, `scripts/` (not
 * `_generated`, `node_modules` or build output). Parsed with the TypeScript
 * compiler, so comments and prose never count; every `import`, `export … from`,
 * `import x = require()`, `require()` and `import()` counts, type-only imports
 * included.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const SCAN_ROOTS = ["convex", "lib", "app", "components", "scripts"];
const SKIP_DIRS = new Set(["node_modules", "_generated", ".next", ".turbo", "dist", "build", "coverage"]);
const SOURCE_EXT = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const PROVIDER_DIR = "convex/ai/providers/";

/** Provider SDK package names. Bare specifiers only; relative and `@/` paths never match. */
export function isProviderSdk(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) return false;
  const pkg = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
  return (
    pkg.startsWith("@anthropic-ai/") ||
    pkg === "openai" ||
    pkg.startsWith("@ai-sdk/") ||
    pkg === "ai" ||
    /recraft/iu.test(pkg)
  );
}

export const PROVIDER_HOSTS = ["api.anthropic.com", "api.openai.com", "external.api.recraft.ai"];

/**
 * Pre-existing direct provider calls outside `convex/ai/providers/`. Each is a
 * raw `fetch` to an endpoint constant; none imports an SDK. They are not moved
 * here. An entry that stops matching fails the test, so the list only shrinks.
 */
const HOST_ALLOWLIST = new Map([
  // OG card pipeline (`scripts/generate-og-cards.mjs`, `npm run og:generate`): pre-WP commits
  // e7318611 (Recraft) and 323369e9 (OpenAI fallback). Build-time only.
  ["lib/og/providers/openai.mjs", ["api.openai.com"]],
  ["lib/og/providers/recraft.mjs", ["external.api.recraft.ai"]],
  // Idea research engine synthesis adapter, WP26-S2. `02` §5.5 / D11: the
  // engine keeps its own OpenAI, Perplexity and DataForSEO adapters.
  ["lib/engine/providers/openai.ts", ["api.openai.com"]],
]);

/** No pre-existing SDK import sits outside `convex/ai/providers/` today. */
const SDK_ALLOWLIST = new Map();

function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/u.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function stringValue(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}

/** Module specifiers and string/template text found in one source file. */
export function scanSource(fileName, source) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  const specifiers = [];
  const strings = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const text = stringValue(node.moduleSpecifier);
      if (text !== null) specifiers.push(text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const text = stringValue(node.moduleReference.expression);
      if (text !== null) specifiers.push(text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isRequire = ts.isIdentifier(callee) && callee.text === "require";
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) {
        const text = stringValue(node.arguments[0]);
        if (text !== null) specifiers.push(text);
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const text = stringValue(node.argument.literal);
      if (text !== null) specifiers.push(text);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) strings.push(node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) strings.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { specifiers, strings };
}

export function hostsIn(strings) {
  return PROVIDER_HOSTS.filter((host) => strings.some((text) => text.includes(host)));
}

async function sourceFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(path.join(root, dir), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return out;
    throw error;
  }
  for (const entry of entries) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...(await sourceFiles(rel)));
    } else if (entry.isFile() && SOURCE_EXT.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(rel);
    }
  }
  return out;
}

let scanned;
async function scanRepo() {
  if (scanned) return scanned;
  const files = (await Promise.all(SCAN_ROOTS.map((dir) => sourceFiles(dir)))).flat().sort();
  scanned = await Promise.all(
    files.map(async (rel) => {
      const { specifiers, strings } = scanSource(rel, await readFile(path.join(root, rel), "utf8"));
      return { rel, sdks: specifiers.filter(isProviderSdk), hosts: hostsIn(strings) };
    }),
  );
  return scanned;
}

const insideProviders = (rel) => rel.startsWith(PROVIDER_DIR);

test("the scanner sees every import form and ignores comments and local paths", () => {
  const { specifiers, strings } = scanSource(
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
      'import { x } from "./providers/openai";',
      'import { y } from "@/convex/ai/providers/anthropic";',
      'import { z } from "aim";',
      "// import nope from \"openai\"; fetch('https://api.openai.com/v1')",
      "const url = `https://api.anthropic.com/v1/${path}`;",
      'const recraft = "https://external.api.recraft.ai/v1/images";',
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
  ]);
  assert.deepEqual(hostsIn(strings), ["api.anthropic.com", "external.api.recraft.ai"]);
});

test("the scan reaches the provider adapters (sanity: it would see a violation)", async () => {
  const files = await scanRepo();
  assert.ok(files.length > 100, `expected a real scan, got ${files.length} files`);
  const anthropic = files.find((file) => file.rel === "convex/ai/providers/anthropic.ts");
  assert.ok(anthropic, "convex/ai/providers/anthropic.ts was not scanned");
  assert.ok(anthropic.sdks.includes("@anthropic-ai/sdk"));
  assert.ok(anthropic.hosts.includes("api.anthropic.com"));
});

test("provider SDKs are imported only inside convex/ai/providers/", async () => {
  const offenders = [];
  for (const { rel, sdks } of await scanRepo()) {
    if (insideProviders(rel) || sdks.length === 0) continue;
    const allowed = SDK_ALLOWLIST.get(rel) ?? [];
    const extra = sdks.filter((sdk) => !allowed.includes(sdk));
    if (extra.length > 0) offenders.push(`${rel}: ${[...new Set(extra)].join(", ")}`);
  }
  assert.deepEqual(offenders, [], "move provider SDK use into convex/ai/providers/ and call it through convex/ai/gateway.ts");
});

test("provider API hosts appear only inside convex/ai/providers/ (plus the pre-existing allowlist)", async () => {
  const offenders = [];
  for (const { rel, hosts } of await scanRepo()) {
    if (insideProviders(rel) || hosts.length === 0) continue;
    const allowed = HOST_ALLOWLIST.get(rel) ?? [];
    const extra = hosts.filter((host) => !allowed.includes(host));
    if (extra.length > 0) offenders.push(`${rel}: ${extra.join(", ")}`);
  }
  assert.deepEqual(offenders, [], "provider calls belong in convex/ai/providers/, behind the metered gateway");
});

test("every allowlist entry still matches, so the allowlist only shrinks", async () => {
  const byRel = new Map((await scanRepo()).map((file) => [file.rel, file]));
  for (const [rel, hosts] of HOST_ALLOWLIST) {
    const file = byRel.get(rel);
    assert.ok(file, `${rel} is allowlisted but no longer exists; remove it from HOST_ALLOWLIST`);
    for (const host of hosts) {
      assert.ok(file.hosts.includes(host), `${rel} no longer calls ${host}; remove it from HOST_ALLOWLIST`);
    }
  }
  for (const [rel, sdks] of SDK_ALLOWLIST) {
    const file = byRel.get(rel);
    assert.ok(file, `${rel} is allowlisted but no longer exists; remove it from SDK_ALLOWLIST`);
    for (const sdk of sdks) assert.ok(file.sdks.includes(sdk), `${rel} no longer imports ${sdk}`);
  }
});
