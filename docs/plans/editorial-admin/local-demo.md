# Editorial Admin — local demo and checks

Everything here runs locally against fictional fixture data. Nothing touches Convex, a deployment, the public site or real credentials. These commands live in this document until a package-script merge window (the parallel slice may not edit `package.json`).

## Run the fixture workspace

```bash
EDITORIAL_FIXTURE_MODE=local-demo npx next dev -p 3246
```

Then open <http://localhost:3246/admin/editorial>.

- **Deny by default.** Without that exact variable the editorial routes return the standard 404 in development too. Any other value (`1`, `true`, `LOCAL-DEMO`) is refused.
- **No production switch.** Production builds (`next build`) always return 404 for every editorial path, whatever the environment says. The fixture adapter is compiled out of production bundles (checked below).
- **Port.** 3246 avoids WP44's 3188/3189/3310/3311, the shared 3210 Convex backend and the default 3000. No Convex backend is needed: fixture mode never calls it.
- **Data.** The demo seeds once per server process and lives in memory. Restart the server to reset it.
- **Labels.** Every screen carries the "Local demo — fictional data" banner. Checks, approvals, re-authentication and releases are simulated and say so.

## Tests

```bash
npx vitest run tests/editorial
```

The editorial suite is not yet part of `npm test` (that script lives in `package.json`, a shared file). It covers the Editorial DTO v1 validators, state machines, domain rules, the reusable repository contract (run against the fixture adapter), seeded scenarios, the workspace gate, server-rendered UI markup and static boundary guards.

## Production gate (fixture mode must be impossible)

```bash
npm run build
node tests/editorial/scripts/verify-production-build.mjs
EDITORIAL_FIXTURE_MODE=local-demo npx next start -p 3247   # second shell; the opt-in is set on purpose
node tests/editorial/scripts/verify-production-build.mjs --probe http://localhost:3247
```

The first check scans `.next/` for fixture code and fictional-data sentinels. The probe requires HTTP 404 and `noindex` for every editorial path (including attempts to enable fixture mode through query strings or cookies) and rejects any editorial copy or fixture text in the body.

Known limitation, reported by the probe as a `NOTE`: a statically prerendered `notFound()` is served as Next's error shell with prerender cache headers, not the full site 404 document. Visitors see the normal 404 page, but the raw response is distinguishable from an unknown path. Making it identical needs the proxy/middleware seam (WP46-E4 integration window).

As a positive control, the development bundle in `.next/dev/` does contain the fixture sentinels; the production bundle does not.

## Accessibility scan

With the fixture dev server running, serve the locally installed axe-core on loopback only (no download):

```bash
python3 -m http.server 3248 --bind 127.0.0.1 --directory node_modules/axe-core
```

Then, in the browser on an editorial page, inject `http://127.0.0.1:3248/axe.min.js` and run `tests/editorial/scripts/axe-run.js` (WCAG 2.0/2.1 A and AA tags). gstack `browse eval` can run that file once its Playwright browser is installed (`npx playwright install`, not done in this session because it downloads browser binaries).
