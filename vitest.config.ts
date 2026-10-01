import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  ssr: {
    // Convex Auth's ESM Next.js adapter imports `next/server` as a package
    // subpath. Inline it so Vite resolves that subpath consistently in tests.
    noExternal: ["@convex-dev/auth"],
  },
  test: {
    environment: "edge-runtime",
    // Path filters like `vitest run convex` otherwise match copies of the
    // repo in agent/work-package worktrees nested under the project root.
    exclude: [
      ...configDefaults.exclude,
      "**/.worktrees/**",
      "**/.claude/worktrees/**",
    ],
  },
});
