import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Next's preset currently enables these accessibility checks as warnings.
    // Promote them so new accessibility regressions fail local lint and CI.
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
    },
  },
  {
    // Keep the baseline runnable without weakening these rules for new files.
    // Each path below is existing debt discovered when ESLint was introduced.
    files: [
      "app/ConvexClientProvider.tsx",
      "app/NotFoundContent.tsx",
      "app/startup-ideas/IdeasExplorer.tsx",
      "components/consent/ConsentBanner.tsx",
      "components/consent/ConsentCustomizeModal.tsx",
      "components/consent/ConsentProvider.tsx",
      "components/layout/MegaNav.tsx",
      "components/layout/MobileNav.tsx",
      "components/layout/SignupModal.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["app/(marketing)/starter-kit/_sections.tsx"],
    rules: {
      "react/jsx-no-comment-textnodes": "warn",
    },
  },
  {
    files: ["scripts/check-og-cards.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "convex/_generated/**",
    "public/**",
    ".worktrees/**",
  ]),
]);
