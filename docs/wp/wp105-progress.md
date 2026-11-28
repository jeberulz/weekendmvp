# WP105 — Next.js 16.4.6 security upgrade

## 2026-11-27

- The first pass upgraded 16.4.1 in the separate worktree and passed the standard checks. The branch then fast-forwarded to `43721c0f`, where PR #329 had already upgraded to 16.4.5.
- Local and remote Git history and open GitHub PRs showed no equivalent upgrade to 16.4.6. The npm advisory endpoint reports affected ranges for 16.4.1 and no findings for 16.4.5 or 16.4.6.
- The requested target is 16.4.6. The bundled Next.js documentation confirms support for the security upgrade policy.

## Verification on 43721c0f

- `npm ci` passed using an isolated npm cache. `npm exec -- next --version` reported 16.4.6, and `npm ls` confirmed the matching ESLint integration. The lockfile retains the Linux SWC libc metadata published for 16.4.6.
- App and Convex typechecks passed after the production build refreshed generated route types. Lint passed with 45 warnings and zero errors.
- All `npm test` groups passed with two skips. Tests ran without ambient `NODE_ENV`, Convex public URL, and provider credentials that interfere with fixture and missing-configuration assertions.
- The production build generated 498 pages. The local server returned 200 on `/about` and redirected `/api/ideas-today` to `/ideas/today` with 307.
- Prompt version checks, idea tag validation, server trace checks, and Git whitespace checks passed.
- The production audit found no high-severity advisories. A moderate Satori advisory remains.

## 2026-11-28

- Rebased onto `9ce82020` for draft PR delivery. The branch preserves the upstream `allowedDevOrigins` setting. The upgrade records moved to WP105 because main assigned WP104 to the landing page editor.
- Clean install, exact version, app and Convex typechecks, lint, production build (499 pages), local HTTP smoke, server traces, prompt versions, idea tags, and diff checks passed on the rebased branch. The existing Keystatic postinstall patch applied successfully.
- All configured test groups were exercised across the initial run and follow-up runs. The engine group passed with three workers after hitting the default test timeout. Two editorial files and one platform case passed isolated retries with longer timeout limits.
- The production audit passed at the high-severity threshold. The moderate Satori advisory remains.
