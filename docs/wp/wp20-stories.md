# WP20 Stories - Security, Tooling, And Migration Preflight

Branch: `codex/wp20-security-baseline`
Lane: Work Package within Build Platform Program Wave 1
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Production dependency audit has no unwaived high-severity finding; CI, lint, accessibility, typecheck, tests, and build are runnable and green; canonical routing is regression-tested; and a redacted read-only auth/environment inventory is recorded for WP21.

## Stories

- [x] `WP20-S1` - Freeze the security and compatibility baseline
  - Scope: `package.json`, `package-lock.json`, official upstream release/advisory evidence, `docs/wp/wp20-progress.md`.
  - Acceptance criteria:
    - Direct and transitive high-severity findings are mapped to their owning packages.
    - Upgrade targets are chosen from official Next.js, Convex, Sharp, npm, or GitHub advisory sources; no blind `npm audit fix --force` is used.
    - Before/after versions and any compatibility or migration risk are recorded.
  - Verification:
    - `npm audit --omit=dev`
    - `npm ls next convex sharp undici ws js-yaml postcss`

- [x] `WP20-S2` - Remediate production dependency vulnerabilities
  - Scope: `package.json`, `package-lock.json`, compatibility fixes strictly required by the upgrades.
  - Acceptance criteria:
    - `npm audit --omit=dev --audit-level=high` exits successfully or every remaining high finding has an explicit owner waiver in `docs/wp/RULINGS.md`.
    - Next.js canonical redirect, sitemap, OG, content, and Convex tests remain green.
    - The production build completes without introducing a new blocking warning.
  - Verification:
    - `npm run typecheck`
    - `npm test`
    - `npm run build`
    - `npm audit --omit=dev --audit-level=high`

- [x] `WP20-S3` - Repair CI, lint, and automated accessibility tooling
  - Scope: `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, new lint configuration, and narrowly scoped quality scripts/tests.
  - Acceptance criteria:
    - Every command referenced by CI exists.
    - CI runs install, production security audit, typecheck, lint, tests, and build using the repository's supported Node version.
    - `npm run lint` checks TypeScript/React/Next code and includes JSX accessibility rules.
    - Stale nonexistent CI commands are removed or replaced by equivalent configured tests; they are not silently kept as dead steps.
  - Verification:
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`
    - `npm run build`
    - `npm audit --omit=dev --audit-level=high`

- [x] `WP20-S4` - Add canonical-host and routing security regression coverage
  - Scope: `tests/redirects/**`, `tests/security/**`, and test-only helpers required to exercise the existing boundary. Do not redesign host routing or implement auth.
  - Acceptance criteria:
    - Tests preserve one-hop apex-to-www and dirty-path behavior across supported request shapes.
    - Preview/localhost/other hosts are not forced to `www` by the current canonicalizer.
    - The test suite records the current routing boundary without claiming future tenant or auth behavior.
  - Verification:
    - `npm run test:redirects`
    - `npm test`

- [x] `WP20-S5` - Produce the redacted WP21 migration preflight
  - Scope: `.env.example`, `docs/wp/evidence/wp20-auth-environment-inventory.md`, read-only Convex/Vercel/local configuration inspection, `docs/wp/backup-restore.md`.
  - Acceptance criteria:
    - Environment key names are classified by Convex dev/prod and Vercel preview/prod; no values are recorded.
    - Read-only counts and shape summaries for `users`, `saved_ideas`, `stripe_events`, and `subscriptions` are recorded when credentials permit, including duplicate emails/tokens and dangling saved-idea references without PII.
    - If production access is unavailable, exact owner-side commands and the resulting WP21 block are recorded rather than guessed.
    - The inventory distinguishes isolated WP21 auth development from later owner-approved production migration/key rotation.
  - Verification:
    - `git diff --check`
    - Secret-value and private-key pattern scan over the staged diff
    - Evidence review against `docs/wp/backup-restore.md`

- [x] `WP20-S6` - Run the Wave 1 gate and close the package
  - Scope: `docs/wp/wp20-progress.md`, `docs/wp/session-ledger.md`, `docs/wp/wave-gate-report.md`, `docs/PROJECT_STRATEGY.md`.
  - Acceptance criteria:
    - All standard checks and the production dependency audit pass.
    - An independent high-risk reviewer reports no unresolved critical/high correctness or security finding.
    - The gate clearly states whether WP21 may start and lists any owner-only production preflight still outstanding.
  - Verification:
    - `npm run typecheck`
    - `npm run lint`
    - `npm test`
    - `npm run build`
    - `npm audit --omit=dev --audit-level=high`
    - `git diff --check`

## File Boundaries

The WP20 worker may edit:

- `package.json`, `package-lock.json`
- `.github/workflows/ci.yml`
- lint configuration at the repository root
- `.env.example`
- `tests/redirects/**`, `tests/security/**`
- narrowly scoped quality/security scripts required by the stories
- `docs/wp/wp20-progress.md`
- `docs/wp/evidence/wp20-auth-environment-inventory.md`
- WP20-specific append-only sections in `docs/wp/backup-restore.md`

The orchestrator alone owns the registry, session ledger, wave gate report, manifest changes, rulings, and final integration commit.

## Out Of Scope

- Installing or implementing Convex Auth.
- Changing `convex/schema.ts` or any production data.
- Editing Stripe fulfillment, public Convex mutations, middleware/proxy behavior, tenant routing, product UI, or platform routes.
- Creating live Stripe objects, rotating keys, changing Vercel domains/DNS, or deploying to production.
- Waiving a vulnerability, changing product scope, or choosing an auth fallback without an owner ruling.

## Notes

- WP20 is the only package authorized after the docs-only Wave 0 gate.
- Any compatibility fix outside the declared file boundary requires an orchestrator scope decision before editing.
- Never print or commit secret values, raw production rows, emails, tokens, or private keys.
