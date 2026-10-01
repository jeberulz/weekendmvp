// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Static guards for the parallel slice. They read source text, so they also
 * catch code paths that tests never execute.
 */
const ROOT = process.cwd();

function listFiles(dir: string): string[] {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(relative);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [relative] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const UI_FILES = [...listFiles("app/admin/editorial"), ...listFiles("components/admin/editorial")];
const LIB_FILES = listFiles("lib/editorial");
const ALL_FILES = [...UI_FILES, ...LIB_FILES];
const read = (file: string) => stripComments(fs.readFileSync(path.join(ROOT, file), "utf8"));

describe("fixture isolation", () => {
  test("UI code never imports the fixture adapter or fixture data directly", () => {
    for (const file of UI_FILES) {
      expect(read(file), file).not.toMatch(/adapters\/fixture|editorial\/fixtures/);
    }
  });

  test("the runtime reaches fixture code only inside a non-production branch", () => {
    const source = read("lib/editorial/runtime/workspace.ts");
    const branch = source.indexOf('if (process.env.NODE_ENV !== "production") {');
    const fixtureImport = source.indexOf('await import("../adapters/fixture/singleton")');
    expect(branch).toBeGreaterThan(-1);
    expect(fixtureImport).toBeGreaterThan(branch);
    // Type-only imports are erased at compile time; value imports are not.
    expect(source).not.toMatch(/^import (?!type ).*adapters\/fixture/m);
  });

  test("only the runtime gate reads the fixture opt-in, and nothing reads a request for it", () => {
    const readers = ALL_FILES.filter((file) => read(file).includes("EDITORIAL_FIXTURE_MODE"));
    expect(readers).toEqual(["lib/editorial/runtime/workspace.ts"]);
    const runtime = read("lib/editorial/runtime/workspace.ts");
    expect(runtime).not.toMatch(/searchParams|cookies\(\)|headers\(\)|localStorage/);
  });

  test("fixture modules are never imported from outside the editorial library and its tests", () => {
    const outside = ["app", "components", "lib", "convex"]
      .flatMap((dir) => listFiles(dir))
      .filter((file) => !file.startsWith("lib/editorial/") && !file.startsWith("app/admin/editorial/") && !file.startsWith("components/admin/editorial/"));
    for (const file of outside) {
      expect(fs.readFileSync(path.join(ROOT, file), "utf8"), file).not.toMatch(/lib\/editorial\/(?:adapters\/fixture|fixtures)\b/);
    }
  });

  test("Convex functions import only the store-neutral editorial modules (WP46-E4)", () => {
    const convexFiles = listFiles("convex").filter((file) => !/\.test\.tsx?$/.test(file));
    for (const file of convexFiles) {
      const specifiers = [...read(file).matchAll(/from "([^"]*lib\/editorial\/[^"]*)"/g)].map((match) => match[1]);
      for (const specifier of specifiers) {
        expect(specifier, file).toMatch(/lib\/editorial\/(?:contracts|domain|core|markdown)\//);
      }
    }
  });
});

describe("safe rendering and storage", () => {
  test("no raw HTML injection, eval or dynamic code anywhere in the editorial slice", () => {
    for (const file of ALL_FILES) {
      const source = read(file);
      expect(source, file).not.toMatch(/dangerouslySetInnerHTML|\beval\s*\(|new Function\s*\(/);
    }
  });

  test("draft bodies never touch browser storage", () => {
    for (const file of ALL_FILES) {
      expect(read(file), file).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    }
  });

  test("focus rings are visible: Tailwind v4 outline width needs an explicit outline style", () => {
    // `outline-none`/`outline-hidden` set --tw-outline-style: none, and
    // `focus-visible:outline-2` inherits it, which hides the ring entirely.
    for (const file of UI_FILES.filter((name) => name.endsWith(".tsx"))) {
      const source = read(file);
      expect(source, file).not.toMatch(/\boutline-none\b/);
      const widths = source.match(/focus-visible:outline-\d/g)?.length ?? 0;
      const solids = source.match(/focus-visible:outline-solid/g)?.length ?? 0;
      expect(solids, file).toBeGreaterThanOrEqual(widths);
    }
  });

  test("no inline styles or console logging in committed UI", () => {
    for (const file of [...UI_FILES, ...LIB_FILES].filter((name) => name.endsWith(".tsx"))) {
      expect(read(file), file).not.toMatch(/\sstyle=\{/);
    }
    for (const file of ALL_FILES) {
      expect(read(file), file).not.toMatch(/console\.(log|debug|info)\(/);
    }
  });
});

describe("private route metadata", () => {
  test("the production guard is a build-time constant", () => {
    expect(read("lib/editorial/runtime/route-guard.ts")).toMatch(
      /if \(process\.env\.NODE_ENV === "production"\) notFound\(\);/,
    );
  });

  test("the editorial layout is noindex, no-referrer and guarded in both metadata and render", () => {
    const layout = read("app/admin/editorial/layout.tsx");
    expect(layout).toMatch(/index: false/);
    expect(layout).toMatch(/follow: false/);
    expect(layout).toMatch(/referrer: "no-referrer"/);
    expect(layout).not.toMatch(/export const metadata/);
    expect(layout.match(/assertEditorialRoutesEnabled\(\);/g)?.length).toBe(2);
  });

  test("every editorial page guards itself, including its metadata, and gates its copy", () => {
    const pages = UI_FILES.filter((file) => file.startsWith("app/admin/editorial/") && file.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThanOrEqual(6);
    for (const page of pages) {
      const source = read(page);
      expect(source, page).not.toMatch(/export const metadata/);
      expect(source.match(/assertEditorialRoutesEnabled\(\);/g)?.length, page).toBe(2);
      expect(source, page).toContain("requireEditorialWorkspace()");
      expect(source, page).not.toMatch(/<PageHeader\b/);
      expect(source, page).toMatch(/<ListSkeleton label="Loading…"/);
    }
  });

  test("page titles are generic: no idea titles reach the tab or analytics", () => {
    for (const file of UI_FILES.filter((name) => name.endsWith("page.tsx"))) {
      const source = read(file);
      const titles = source.match(/absolute: "([^"]+)"/g) ?? [];
      expect(titles.length, file).toBe(1);
    }
  });
});

describe("server actions", () => {
  const actionFiles = UI_FILES.filter((file) => file.startsWith("app/admin/editorial/_actions/"));

  test("live in a private folder and are all server actions", () => {
    expect(actionFiles.length).toBeGreaterThan(0);
    // No other editorial file declares actions or route handlers.
    for (const file of UI_FILES.filter((name) => !actionFiles.includes(name))) {
      expect(read(file), file).not.toMatch(/^["']use server["']/m);
      expect(file).not.toMatch(/route\.tsx?$/);
    }
    for (const file of actionFiles) expect(read(file), file).toMatch(/^"use server";/);
  });

  test("every exported action re-resolves the workspace and validates its input", () => {
    for (const file of actionFiles) {
      const source = stripComments(read(file));
      const exported = [...source.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
      expect(exported.length, file).toBeGreaterThan(0);
      for (const [, name, body] of exported) {
        expect(body, `${file}: ${name}`).toMatch(/return withWorkspace\(\w+Schema, input,/);
      }
      // Nothing else is exported from a "use server" module.
      expect(source.match(/^export /gm)?.length, file).toBe(exported.length);
    }
  });
});
