import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const SOURCE_DIRECTORIES = ["app", "components", "convex", "lib", "scripts"];
const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".next",
  ".worktrees",
  "_generated",
  "build",
  "coverage",
  "node_modules",
  "out",
  "public",
]);
const ENV_KEY = /^[A-Z][A-Z0-9_]*$/;

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath)) && !filePath.endsWith(".d.ts");
}

async function collectSourceFiles(root) {
  const files = [];

  async function walk(relativeDirectory) {
    const absoluteDirectory = path.join(root, relativeDirectory);
    let entries;
    try {
      entries = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name)) await walk(relativePath);
      } else if (entry.isFile() && isSourceFile(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  for (const directory of SOURCE_DIRECTORIES) await walk(directory);

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && isSourceFile(entry.name)) files.push(entry.name);
  }

  return files.sort();
}

function isProcessEnv(node) {
  return Boolean(
    node &&
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process" &&
    node.name.text === "env"
  );
}

function staticProcessEnvKeys(filePath, source) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const keys = new Set();

  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && isProcessEnv(node.expression)) {
      if (ENV_KEY.test(node.name.text)) keys.add(node.name.text);
    }

    if (ts.isElementAccessExpression(node) && isProcessEnv(node.expression)) {
      const argument = node.argumentExpression;
      if (argument && ts.isStringLiteralLike(argument) && ENV_KEY.test(argument.text)) {
        keys.add(argument.text);
      }
    }

    if (ts.isVariableDeclaration(node) && isProcessEnv(node.initializer)) {
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const property = element.propertyName ?? element.name;
          if (ts.isIdentifier(property) && ENV_KEY.test(property.text)) {
            keys.add(property.text);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return keys;
}

function documentedEnvKeys(exampleSource) {
  const keys = new Set();
  for (const line of exampleSource.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(line);
    if (match) keys.add(match[1]);
  }
  return keys;
}

test("every statically referenced environment key is named in .env.example", async () => {
  const root = process.cwd();
  const documented = documentedEnvKeys(
    await readFile(path.join(root, ".env.example"), "utf8"),
  );
  const references = new Map();

  for (const relativePath of await collectSourceFiles(root)) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    for (const key of staticProcessEnvKeys(relativePath, source)) {
      const paths = references.get(key) ?? [];
      paths.push(relativePath);
      references.set(key, paths);
    }
  }

  const missing = [...references.keys()]
    .filter((key) => !documented.has(key))
    .sort();

  assert.deepEqual(
    missing,
    [],
    `Missing .env.example key names: ${missing
      .map((key) => `${key} (${references.get(key).join(", ")})`)
      .join("; ")}`,
  );
});

test("environment documentation parsing retains names only", () => {
  const keys = documentedEnvKeys(
    "FIRST_KEY=ignored-value\nSECOND_KEY=also-ignored\n# COMMENTED_KEY=ignored\n",
  );

  assert.deepEqual([...keys].sort(), ["FIRST_KEY", "SECOND_KEY"]);
});
