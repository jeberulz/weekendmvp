#!/usr/bin/env node
/**
 * WP46 offline check of the Convex function bundle (no deployment, no network).
 *
 *   node --experimental-vm-modules tests/editorial/scripts/verify-convex-bundle.mjs
 *
 * Approximates the push-time bundle and analyze steps of the Convex CLI:
 * 1. Selects entry points with the CLI's rules and bundles every
 *    default-runtime module with its esbuild options (browser platform,
 *    `convex` and `module` conditions, ESM, esnext), using the esbuild that
 *    ships with the `convex` package.
 * 2. Loads each bundle in a `node:vm` context that offers web-style globals
 *    only (no `window`, `document`, `require` or `Buffer`), lists the
 *    registered functions, exports their argument and return validators, and
 *    exports the schema.
 * 3. Requires the editorial surface to be exactly 9 public queries in
 *    `editorial/reads`, 22 public mutations in `editorial/commands`, and
 *    internal functions everywhere else under `editorial/` and `admin/`, with
 *    no Markdown parser packages in those bundles.
 * 4. Controls: the editorial Markdown parser bundled without the `convex`
 *    condition picks micromark's DOM entity decoder and must be refused;
 *    with Convex's conditions it must load.
 *
 * This is not the Convex isolate: it does not run functions, enforce limits
 * or check indexes against data. A disposable deployment push remains the
 * authoritative check.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const CONVEX_DIR = path.join(ROOT, "convex");
const { build } = createRequire(path.join(ROOT, "package.json"))("esbuild");
const EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".jsx"];
const PARSER_PACKAGE = /(^|\/)node_modules\/(micromark|mdast-util-|remark-|unified|decode-named-character-reference)[^/]*\//;

if (typeof vm.SourceTextModule !== "function") {
  console.error("Run with: node --experimental-vm-modules tests/editorial/scripts/verify-convex-bundle.mjs");
  process.exit(2);
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // The CLI skips nested component directories.
      if (!existsSync(path.join(full, "convex.config.ts"))) walk(full, files);
    } else files.push(full);
  }
  return files;
}

/** The Convex CLI's entry point rules (`bundler/index.js` `entryPoints`). */
function isEntryPoint(file) {
  const relative = path.relative(CONVEX_DIR, file);
  const base = path.basename(file);
  if (!EXTENSIONS.some((extension) => relative.endsWith(extension))) return false;
  if (relative.startsWith(`_generated${path.sep}`)) return false;
  if (base.startsWith(".") || base.startsWith("#")) return false;
  if (base === "schema.ts" || base === "schema.js") return false;
  if ((base.match(/\./g) ?? []).length > 1) return false;
  if (relative.includes(" ")) return false;
  if (/\.tsx?$/.test(file) && !/^\s{0,100}(import|export)/m.test(readFileSync(file, "utf8"))) return false;
  return true;
}

function usesNodeRuntime(file) {
  return /^\s*("|')use node("|');?\s*$/m.test(readFileSync(file, "utf8"));
}

const serverOnlyStub = {
  name: "server-only-stub",
  setup(builder) {
    builder.onResolve({ filter: /^server-only$/ }, (args) => ({ path: args.path, namespace: "server-only-stub" }));
    builder.onLoad({ filter: /.*/, namespace: "server-only-stub" }, () => ({ contents: "export {}", loader: "js" }));
  },
};

const asyncHooksShim = {
  name: "convex-async-hooks-shim",
  setup(builder) {
    builder.onResolve({ filter: /^(node:)?async_hooks$/ }, (args) => ({ path: args.path, namespace: "async-hooks-shim" }));
    builder.onLoad({ filter: /.*/, namespace: "async-hooks-shim" }, () => ({
      contents:
        "export const AsyncLocalStorage = globalThis.AsyncLocalStorage; export const AsyncResource = globalThis.AsyncResource; export default { AsyncLocalStorage, AsyncResource };",
      loader: "js",
    }));
  },
};

const BUILD_OPTIONS = {
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "esnext",
  jsx: "automatic",
  conditions: ["convex", "module"],
  plugins: [asyncHooksShim, serverOnlyStub],
  write: false,
  metafile: true,
  logLevel: "silent",
};

function sandbox() {
  const host = globalThis;
  return vm.createContext({
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    process: { env: {} },
    crypto: host.crypto,
    TextEncoder: host.TextEncoder,
    TextDecoder: host.TextDecoder,
    URL: host.URL,
    URLSearchParams: host.URLSearchParams,
    atob: host.atob,
    btoa: host.btoa,
    structuredClone: host.structuredClone,
    Blob: host.Blob,
    Headers: host.Headers,
    Request: host.Request,
    Response: host.Response,
    AbortController: host.AbortController,
    AbortSignal: host.AbortSignal,
    Event: host.Event,
    EventTarget: host.EventTarget,
    ReadableStream: host.ReadableStream,
    WritableStream: host.WritableStream,
    TransformStream: host.TransformStream,
    queueMicrotask: host.queueMicrotask,
  });
}

async function load(code, label) {
  const loaded = new vm.SourceTextModule(code, { context: sandbox(), identifier: label });
  await loaded.link(() => {
    throw new Error(`unexpected import left in bundled ${label}`);
  });
  await loaded.evaluate();
  return loaded.namespace;
}

const failures = [];
const entries = walk(CONVEX_DIR).filter(isEntryPoint);
const defaultRuntime = entries.filter((file) => !usesNodeRuntime(file));

// 1–2. Bundle and load every default-runtime module.
const bundled = await build({ ...BUILD_OPTIONS, entryPoints: defaultRuntime, outdir: "out", outbase: CONVEX_DIR, splitting: false });
const outputByEntry = new Map();
for (const [outPath, meta] of Object.entries(bundled.metafile.outputs)) {
  if (meta.entryPoint) outputByEntry.set(path.resolve(ROOT, meta.entryPoint), { outPath: path.resolve(ROOT, outPath), meta });
}
const textByOutput = new Map(bundled.outputFiles.map((file) => [file.path, file.text]));

let functionCount = 0;
const editorialSurface = [];
for (const entry of defaultRuntime) {
  const relative = path.relative(CONVEX_DIR, entry).replace(/\\/g, "/");
  const output = outputByEntry.get(entry);
  const code = output ? textByOutput.get(output.outPath) : undefined;
  if (!code) {
    failures.push(`${relative}: no bundle output`);
    continue;
  }
  const editorial = /^(editorial|admin)\//.test(relative);
  if (editorial) {
    for (const input of Object.keys(output.meta.inputs)) {
      if (PARSER_PACKAGE.test(input)) failures.push(`${relative}: bundles ${input}`);
    }
  }
  try {
    const namespace = await load(code, relative);
    for (const [name, value] of Object.entries(namespace)) {
      if (!value || !(value.isQuery || value.isMutation || value.isAction || value.isHttp)) continue;
      functionCount++;
      JSON.parse(value.exportArgs?.() ?? "null");
      JSON.parse(value.exportReturns?.() ?? "null");
      if (editorial) {
        editorialSurface.push({
          name: `${relative.replace(/\.ts$/, "")}:${name}`,
          visibility: value.isPublic ? "public" : value.isInternal ? "internal" : "unknown",
          kind: value.isQuery ? "query" : value.isMutation ? "mutation" : value.isAction ? "action" : "http",
        });
      }
    }
  } catch (error) {
    failures.push(`${relative}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 3. The editorial surface.
const publicQueries = editorialSurface.filter((fn) => fn.visibility === "public" && fn.kind === "query");
const publicMutations = editorialSurface.filter((fn) => fn.visibility === "public" && fn.kind === "mutation");
const otherPublic = editorialSurface.filter((fn) => fn.visibility !== "internal" && !publicQueries.includes(fn) && !publicMutations.includes(fn));
if (publicQueries.length !== 9 || !publicQueries.every((fn) => fn.name.startsWith("editorial/reads:"))) {
  failures.push(`expected 9 public queries in editorial/reads, found: ${publicQueries.map((fn) => fn.name).join(", ")}`);
}
if (publicMutations.length !== 22 || !publicMutations.every((fn) => fn.name.startsWith("editorial/commands:"))) {
  failures.push(`expected 22 public mutations in editorial/commands, found: ${publicMutations.map((fn) => fn.name).join(", ")}`);
}
if (otherPublic.length > 0) failures.push(`unexpected non-internal functions: ${otherPublic.map((fn) => fn.name).join(", ")}`);
const internal = editorialSurface.filter((fn) => fn.visibility === "internal").map((fn) => fn.name).sort();

// Schema export, as a push does.
let tables = [];
try {
  const schema = await build({ ...BUILD_OPTIONS, entryPoints: [path.join(CONVEX_DIR, "schema.ts")] });
  const namespace = await load(schema.outputFiles[0].text, "schema.ts");
  tables = JSON.parse(namespace.default.export()).tables.map((table) => table.tableName);
} catch (error) {
  failures.push(`schema.ts: ${error instanceof Error ? error.message : String(error)}`);
}
const editorialTables = tables.filter((name) => name.startsWith("editorial_") || name === "super_admins");

// 4. Controls for the sandbox itself.
async function parserUnder(conditions) {
  const control = await build({
    ...BUILD_OPTIONS,
    conditions,
    stdin: {
      contents: 'export { parseArticleMarkdown } from "./lib/editorial/markdown/parse";',
      resolveDir: ROOT,
      sourcefile: "control.ts",
      loader: "ts",
    },
  });
  const domBuilds = Object.keys(control.metafile.inputs).filter((input) => input.endsWith("index.dom.js"));
  try {
    await load(control.outputFiles[0].text, "control.ts");
    return { loaded: true, detail: "loaded", domBuilds };
  } catch (error) {
    return { loaded: false, detail: error instanceof Error ? error.message : String(error), domBuilds };
  }
}
const withoutConvex = await parserUnder(["module"]);
const withConvex = await parserUnder(["convex", "module"]);
if (withoutConvex.loaded) failures.push("control: the DOM build loaded, so the sandbox cannot catch DOM access");
if (!withConvex.loaded) failures.push(`control: the parser failed under Convex's conditions (${withConvex.detail})`);

console.log(`Entry points: ${entries.length} (${defaultRuntime.length} default runtime bundled and loaded; ${entries.length - defaultRuntime.length} "use node" not checked)`);
console.log(`Registered functions loaded, validators exported: ${functionCount}`);
console.log(`Schema: ${tables.length} tables, ${editorialTables.length} editorial (${editorialTables.join(", ")})`);
console.log(`Editorial surface: ${publicQueries.length} public queries, ${publicMutations.length} public mutations, ${internal.length} internal (${internal.join(", ")})`);
console.log(`Control without the "convex" condition: ${withoutConvex.loaded ? "LOADED" : `refused (${withoutConvex.detail})`}; DOM builds: ${withoutConvex.domBuilds.join(", ") || "none"}`);
console.log(`Control with Convex's conditions: ${withConvex.loaded ? "loaded" : `refused (${withConvex.detail})`}; DOM builds: ${withConvex.domBuilds.join(", ") || "none"}`);
if (failures.length > 0) {
  console.log(`FAIL (${failures.length})`);
  for (const failure of failures) console.log(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS");
}
