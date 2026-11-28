# WP105 — Next.js 16.4.6 security upgrade

Branch: `codex/wp93-next-security-16-4-6`

- [x] WP105-S1. Upgrade Next.js and its ESLint integration to 16.4.6. Preserve npm's existing caret policy, lock the installed versions, and set `experimental.agentUpgrade` to `"security"`.
- Verify the clean install, installed version, typecheck, lint, full tests, production build, local HTTP smoke test, production dependency audit, and Git diff.
- Scope covers `package.json`, `package-lock.json`, `next.config.ts`, and the work package records.
