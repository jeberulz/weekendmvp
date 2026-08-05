# WP13 Progress - Collapse redirect chains to one hop

## Status

**Done.** Live verified 2026-08-05.

## S1 — Shared path cleaner + Edge middleware

- `lib/canonical-path.ts` — pure `cleanPath` / host helpers
- `middleware.ts` — single 308 for apex and dirty www paths
- `tests/redirects/canonical-path.test.mjs` — 7 passing
- `npm run test:redirects` wired into `npm test`
- Follow-up: raw `request.url` pathname + `skipTrailingSlashRedirect`

## S2 — Remove redundant next.config `.html` redirect

- Removed `/:path*.html` from `next.config.ts`; `/api/ideas-today` kept
- Cutover runbook + `RULINGS.md` updated for middleware ownership
- `skipTrailingSlashRedirect: true` so Next does not emit a same-host slash hop

## S3 — Clear Vercel apex domain redirect

- Middleware deployed via [#32](https://github.com/jeberulz/weekendmvp/pull/32)
- Trailing-slash ownership via [#35](https://github.com/jeberulz/weekendmvp/pull/35)
- Domains API: `weekendmvp.app` `redirect` → `null` (confirmed)

## Live verification (2026-08-05)

| URL | Hops | Final |
|---|---|---|
| `https://weekendmvp.app/articles/7-micro-saas-ideas-solo-2026.html` | 1 | www clean 200 |
| `https://weekendmvp.app/build-with/claude/` | 1 | www clean 200 |
| `https://weekendmvp.app/build-with/claude` | 1 | www 200 |
| `https://weekendmvp.app/articles/...html/` | 1 | www clean 200 |
| `https://www.weekendmvp.app/...html` | 1 | www clean 200 |
| `https://www.weekendmvp.app/` | 0 | 200 |

## Verification commands

- `npm run test:redirects` ✅
- `npm run typecheck` ✅
- `npm run build` ✅ (`ƒ Proxy (Middleware)`)
