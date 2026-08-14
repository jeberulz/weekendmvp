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

## 2026-08-05 - WP20-S1 Security and compatibility baseline

- Baseline command: `npm audit --omit=dev` reported 7 high-severity package findings and no critical findings across 347 production dependencies.
- Direct owners and vulnerable paths:
  - `next@16.2.9`: affected by the July 2026 Next.js advisories fixed in `16.2.11`; its bundled `postcss@8.4.31` and optional `sharp@0.34.5` also remain below the currently patched dependency lines.
  - `convex@1.41.0` -> `ws@8.20.1`: `ws` is affected below `8.21.0`; `convex@1.43.0` declares `ws@8.21.0`.
  - direct `sharp@0.33.5`: affected below `0.35.0`; the current patched release is `0.35.3`.
  - `cheerio@1.2.0` -> `undici@7.19.1`: affected through `7.28.0`; the patched compatible 7.x release is `7.29.0`.
  - `gray-matter@4.0.3` -> `js-yaml@3.14.2`: affected below `3.15.0`; the patched compatible 3.x release is `3.15.1`.
  - Next/Tailwind paths included vulnerable PostCSS releases; `postcss@8.5.23+` clears the listed source-map advisories.
- Chosen upgrade targets:
  - `next@16.3.0`, because its official package metadata natively declares patched `postcss@8.5.23` and `sharp@^0.35.3`; this avoids forcing incompatible transitive versions into the 16.2 dependency contract.
  - `convex@1.43.0` and `sharp@0.35.3`.
  - narrow npm overrides for `cheerio`'s `undici` to `7.29.0` and `gray-matter`'s `js-yaml` to `3.15.1`, because no newer parent releases are available and both targets remain inside the parents' declared major lines.
- Compatibility risks:
  - Next `16.3.0` is a minor framework upgrade and must pass the complete canonical, sitemap, OG, content, type, and production-build suite.
  - Sharp `0.35` requires Node `>=20.9.0` and contains documented breaking API removals. Repository use must be checked for removed constructor/metadata/sharpen options. Next `16.3.0` has the same Node floor and officially declares Sharp `^0.35.3`.
  - Convex is a client/CLI upgrade only in WP20; no schema or generated Convex files are changed.
- Official evidence consulted:
  - Next.js July 2026 security release: <https://nextjs.org/blog/security-update-2026-07-20>
  - Next.js package metadata from the npm registry (`npm view next@16.3.0 ...`).
  - Convex package metadata from the npm registry (`npm view convex@1.43.0 ...`).
  - Sharp 0.35 changelog: <https://sharp.pixelplumbing.com/changelog/v0.35.0/>
  - GitHub advisories emitted by npm audit: `GHSA-6gpp-xcg3-4w24`, `GHSA-96hv-2xvq-fx4p`, `GHSA-f88m-g3jw-g9cj`, `GHSA-4cwx-7wf7-3272`, `GHSA-52cp-r559-cp3m`, and `GHSA-r28c-9q8g-f849`.
- No vulnerability waiver is requested and no `npm audit fix --force` was run.

## 2026-08-05 - WP20-S2 Dependency remediation

- Upgraded `next` `16.2.9 -> 16.3.0`, `convex` `1.41.0 -> 1.43.0`, and direct `sharp` `0.33.5 -> 0.35.3`.
- Added parent-scoped overrides only where no parent release exists: `cheerio -> undici@7.29.0` and `gray-matter -> js-yaml@3.15.1`.
- Updated Tailwind's official packages `4.3.1 -> 4.3.3`; that release replaces its exact vulnerable PostCSS dependency with a compatible patched range.
- Result: both the full npm audit and `npm audit --omit=dev --audit-level=high` report 0 vulnerabilities. No waiver or forced audit fix was used.
- Compatibility verification passed: typecheck, all 120 configured tests, and the production build.
- The build retains existing/non-blocking warnings for the deprecated `middleware.ts` convention and dynamic filesystem tracing. Migrating routing behavior to `proxy.ts` is outside the WP20 worker boundary and remains a later routing-owner task.

## 2026-08-05 - WP20-S3 CI, lint, and accessibility tooling

- Added the official Next.js ESLint flat configuration with Core Web Vitals, TypeScript, React, React Hooks, and JSX accessibility rules.
- Existing React-effect and legacy script debt is downgraded only for an explicit path allowlist; the rules remain enforced at their upstream severity for new files. Generated files, static assets, and `.worktrees/**` are excluded.
- `npm run lint` now exists and exits successfully. It reports 35 existing warnings and 0 errors; warning cleanup is not required to establish the automated gate and would edit files outside WP20.
- Replaced the three nonexistent CI commands with one deterministic quality job: locked install, production dependency audit, typecheck, lint/a11y, tests, and build on Node 22.x. CI permissions are read-only and the job has a 20-minute timeout.
- Official setup references: <https://nextjs.org/docs/app/api-reference/config/eslint> and <https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs>.

## 2026-08-05 - WP20-S4 Canonical routing regression

- Added seven Vitest cases against the actual exported middleware, in addition to the seven pure canonical-path cases.
- Covered dirty apex -> clean www in one 308, clean apex canonicalization, dirty www cleanup with query preservation, mixed-case/port host input, and in-place cleanup for Vercel preview, localhost, and a future tenant-shaped subdomain.
- A clean preview URL passes through with no `Location` header. The tests record current behavior only and do not claim tenant or auth implementation.
- `npm run test:redirects` passes 14 cases across the Node and Vitest runners.

## 2026-08-05 - WP20-S5 Read-only migration preflight

- Added `.env.example` with empty placeholders classified for local Next/Convex, Vercel Preview/Production, current server integrations, local content tooling, and the planned WP21 Convex deployment keys.
- Production aggregate inventory: `users=0`, `saved_ideas=0`, `stripe_events=0`, `subscriptions=0`, and `ideas=160`. Duplicate and dangling-reference counts are all zero because the relevant legacy/platform tables are empty.
- Production Convex has no application environment variables. Vercel key names and target environments were inventoried without reading or recording values.
- The configured local Convex backend was not running. WP21 may start an isolated local/dev deployment, but production auth activation remains blocked on exact-version auth-key validation, interactive owner provisioning, a fresh row inventory, backup, restore marker, dry run, and owner approval.
- Evidence: `docs/wp/evidence/wp20-auth-environment-inventory.md` and the WP20 append in `docs/wp/backup-restore.md`.

## 2026-08-05 - Worker verification and handoff

- `npm run typecheck`: pass.
- `npm run lint`: pass with 35 recorded existing warnings and 0 errors.
- `npm test`: pass, 120 tests total.
- `npm run build`: pass; non-blocking warnings recorded above.
- `npm audit`: pass, 0 vulnerabilities.
- `npm audit --omit=dev --audit-level=high`: pass, 0 vulnerabilities.
- `git diff --check`: pass.
- Next: orchestrator assigns independent high-risk review and runs WP20-S6. Production changes remain unauthorized.

## 2026-08-05 - Independent review remediation

- Corrected the auth preflight to the current official Convex Auth manual contract: `SITE_URL`, paired `JWT_PRIVATE_KEY`/`JWKS`, and the official `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` names for the approved Google path. Removed the guessed `AUTH_SECRET` and `AUTH_RESEND_KEY` provisioning. Magic-link provider/key selection is now an explicit WP21 owner `UNKNOWN`.
- Completed the static environment inventory with `LEGACY_ORIGIN`, `GSC_KEY_FILE`, `GSC_SITE_URL`, `GSC_SITEMAP_URL`, and command-scoped `STRICT`; no values were added.
- Promoted all six JSX accessibility rules supplied by the Next preset to errors globally. Existing non-accessibility debt remains path-scoped; new/unallowlisted missing-alt and ARIA violations now fail lint/CI. Added a deterministic ESLint API probe to prevent severity regression.
- Extended routing coverage with Next's `unstable_doesMiddlewareMatch` helper. The exported matcher must include `robots.txt`, `sitemap.xml`, and application pages while excluding Next internals and the declared static-asset extensions.
- These corrections remain inside the WP20 worker boundary and perform no production mutation.
- Post-remediation verification: typecheck pass; lint pass with the same 35 allowlisted/pre-existing warnings and 0 errors; 134 tests pass; production build pass with the previously recorded non-blocking warnings; full and production npm audits report 0 vulnerabilities; diff check pass; all 23 statically referenced environment keys are represented in `.env.example`.

## 2026-08-05 - WP20-S6 Independent review and Wave 1 gate

- Initial independent review: fail. Required exact Convex Auth key names, blocking JSX accessibility severities, complete environment classification, and exported middleware matcher coverage.
- First remediation: all four findings fixed. High-risk re-review returned no remaining findings and approved WP21 isolated local/dev work.
- Gate-runner follow-up: fail on reproducibility because the 23-key environment comparison was manual rather than a configured test.
- Final remediation: added a TypeScript-AST environment-documentation test under `tests/security/`, wired through `test:security` -> `npm test` -> CI. The test ignores comments, strings, dynamic expressions, dependencies, generated/build/public/worktree paths, and compares key names only.
- Final independent gate:
  - `npm run typecheck`: pass.
  - `npm run lint`: pass, 0 errors and 35 explicitly recorded pre-existing warnings.
  - `npm run test:security`: pass, 4/4.
  - `npm test`: pass, 136/136.
  - `npm run build`: pass, 299 pages; one middleware-deprecation and five filesystem-tracing warnings remain assigned outside WP20.
  - `npm audit`: pass, 0 vulnerabilities.
  - `npm audit --omit=dev --audit-level=high`: pass, 0 vulnerabilities.
  - `git diff --cached --check`: pass.
  - Staged secret/PII scan: pass; no values, private keys, raw rows, tokens, emails, IDs, or credentials recorded.
- Result: WP20 complete. Wave 1 passes. WP21 isolated local/dev implementation may start.
- Production guardrail: production auth activation remains blocked pending the magic-link provider ruling, interactive key provisioning, fresh inventory, backup/restore marker, dry run, and owner approval.

## 2026-08-05 - Environment documentation gate fix

- Added an AST-based security test that discovers static `process.env.KEY`, `process.env["KEY"]`, and `process.env` destructuring references in application, Convex, root config, library, and tooling source.
- The walker excludes dependencies, generated files, builds, public assets, coverage, and worktrees. TypeScript parsing prevents comments, documentation strings, and dynamic expressions from being mistaken for live environment references.
- The test parses `.env.example` into key names only and never retains or compares values. It fails with safe key names and source paths when a referenced key is undocumented.
- The gate runs through the existing `test:security` command and therefore through `npm test` and CI.
- Final gate verification: security tests pass (4); full suite passes (136); typecheck and lint pass; build passes with the previously recorded non-blocking warnings; full and production audits report 0 vulnerabilities; diff check passes.
