# WP20 Progress - Security, Tooling, And Migration Preflight

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-05 - Setup

- Branch/worktree: `codex/wp20-security-baseline` in the primary checkout; no worktree.
- Assignment: Clear the Wave 1 security/tooling gate and produce a read-only migration preflight for WP21.
- File boundaries: Package/lock, CI, lint config, `.env.example`, redirect/security tests, narrow quality scripts, WP20 progress/evidence, and a WP20 backup/restore append. Registry/manifest/rulings/gate/session closeout remain orchestrator-owned.
- Required checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `git diff --check`, staged secret scan, and independent high-risk review.
- Initial risks:
  - Seven high-severity production dependency findings, including a Next.js middleware/proxy bypass relevant to later auth.
  - Upgrading Next.js, Convex, and Sharp together may expose runtime or type incompatibilities.
  - Current CI references three nonexistent commands and the repository has no lint script.
  - Production Convex or Vercel inventory may require owner credentials; no production mutation is authorized.
  - Existing `users` is a Clerk-era reserved shape that conflicts with Convex Auth; WP20 inventories only and does not change it.
- Next: Assign a high-risk security worker to execute S1-S5 inside the frozen boundary.
