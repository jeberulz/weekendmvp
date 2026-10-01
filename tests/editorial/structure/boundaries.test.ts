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
    // Test files may build demo envelopes; shipped code may not.
    const outside = ["app", "components", "lib", "convex"]
      .flatMap((dir) => listFiles(dir))
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => !file.startsWith("lib/editorial/") && !file.startsWith("app/admin/editorial/") && !file.startsWith("components/admin/editorial/"));
    for (const file of outside) {
      expect(fs.readFileSync(path.join(ROOT, file), "utf8"), file).not.toMatch(/lib\/editorial\/(?:adapters\/fixture|fixtures)\b/);
    }
  });

  test("only the internal bootstrap module touches the super-admin binding (WP46-E4a)", () => {
    const sources = listFiles("convex").filter(
      (file) => !/\.test\.tsx?$/.test(file) && !file.startsWith("convex/_generated/"),
    );
    const touching = sources.filter((file) => read(file).includes("super_admins"));
    expect(touching.sort()).toEqual(["convex/admin/superAdmin.ts", "convex/schema.ts"]);
    const bootstrap = read("convex/admin/superAdmin.ts");
    // Public builders are lower-case (`query(`, `mutation(`); only internal ones may appear.
    expect(bootstrap).not.toMatch(/(?<![A-Za-z])(?:query|mutation|action|httpAction)\(\{/);
    expect(bootstrap).toMatch(/internalMutation\(\{/);
  });

  test("editorial Convex functions resolve the caller on the server and take no identity arguments (WP46-E4c)", () => {
    const service = read("convex/editorial/service.ts");
    expect(service).not.toMatch(/(?<![A-Za-z])(?:query|mutation|action|httpAction)\(\{/);

    const commands = read("convex/editorial/commands.ts");
    const mutations = commands.split(/export const \w+ = mutation\(\{/).slice(1);
    expect(mutations.length).toBe(22);
    for (const body of mutations) expect(body).toMatch(/commandRepository\(ctx\)/);

    const reads = read("convex/editorial/reads.ts");
    const queries = reads.split(/export const \w+ = query\(\{/).slice(1);
    expect(queries.length).toBe(9);
    for (const body of queries) expect(body).toMatch(/readRepository\(ctx, args\.nowMs\)|editorialSession\(ctx\)/);

    for (const source of [commands, reads, read("convex/editorial/args.ts")]) {
      expect(source).not.toMatch(/\b(?:userId|actorId|role|capability|approvedBy|verified|isAdmin)\s*:/);
    }
    // Only the editorial modules, the binding module's audit helper and the schema name the private tables.
    const users = listFiles("convex")
      .filter((file) => !/\.test\.tsx?$/.test(file) && !file.startsWith("convex/_generated/"))
      .filter((file) => /"editorial_[a-z_]+"/.test(read(file)));
    expect(users.every((file) => file.startsWith("convex/editorial/") || file === "convex/schema.ts")).toBe(true);
  });

  test("nothing Convex loads reaches the Markdown parser, React or Next.js (WP46-E4c)", () => {
    // Convex bundles for a browser-like isolate: micromark's entity decoder
    // then resolves to a build that touches `document` when it loads.
    const resolve = (from: string, specifier: string) => {
      const base = path.normalize(path.join(path.dirname(from), specifier));
      return [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((candidate) =>
        fs.existsSync(path.join(ROOT, candidate)),
      );
    };
    const queue = listFiles("convex").filter(
      (file) => file.endsWith(".ts") && !/\.test\.tsx?$/.test(file) && !file.startsWith("convex/_generated/"),
    );
    const seen = new Set<string>();
    const reached: string[] = [];
    while (queue.length > 0) {
      const file = queue.pop();
      if (file === undefined || seen.has(file)) continue;
      seen.add(file);
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      // Value imports and re-exports only: type-only ones are erased when bundled.
      for (const match of source.matchAll(/^(?:import|export)\s+(?!type\s)[^;]*?\sfrom\s+"([^"]+)";/gms)) {
        const specifier = match[1];
        if (specifier.startsWith(".")) {
          const next = resolve(file, specifier);
          if (next) queue.push(next);
        } else if (/^(?:mdast|micromark|remark|unified|react|next|server-only)(?:\/|-|$)/.test(specifier)) {
          reached.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect([...seen].some((file) => file.startsWith("lib/editorial/core/"))).toBe(true);
    expect(reached).toEqual([]);
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
  test("the production guard depends only on build-time constants (WP46-E4e)", () => {
    expect(read("lib/editorial/runtime/route-guard.ts")).toMatch(
      /if \(process\.env\.NODE_ENV === "production" && !isValidPlatformConvexUrl\(process\.env\.NEXT_PUBLIC_CONVEX_URL\)\) notFound\(\);/,
    );
  });

  test("middleware refuses the editorial workspace to anyone the backend does not confirm (WP46-E4e)", () => {
    const middleware = read("middleware.ts");
    // The gate runs before the auth-managed routes and fails closed.
    expect(middleware.indexOf("if (isEditorialPath(pathname))")).toBeGreaterThan(-1);
    expect(middleware.indexOf("if (isEditorialPath(pathname))")).toBeLessThan(middleware.indexOf("if (!isAuthManagedPath(pathname))"));
    expect(middleware).toMatch(/catch \{\s*return false;\s*\}/);
    // The local-demo skip is compiled out of production builds.
    expect(middleware).toMatch(/process\.env\.NODE_ENV !== "production" && process\.env\.EDITORIAL_FIXTURE_MODE === "local-demo"/);
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
        // Demo controls use the fixture-only wrapper; everything else the general one.
        const wrapper = file.endsWith("/demo.ts") ? "withFixtureWorkspace" : "withWorkspace";
        expect(body, `${file}: ${name}`).toMatch(new RegExp(`return ${wrapper}\\(\\w+Schema, input,`));
      }
      // Nothing else is exported from a "use server" module.
      expect(source.match(/^export /gm)?.length, file).toBe(exported.length);
    }
  });
});
