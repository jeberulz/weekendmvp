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

## The idea workspace

Open any idea from the queue or library (the flagship "Invoice follow-up for freelancers" is a live v2 with an edited v3 draft).

- **Write** is a plain Markdown editor. `⌘S` / `Ctrl+S` saves from anywhere in the workspace; `Ctrl+Alt+↓` / `Ctrl+Alt+↑` moves the caret to the next or previous `##` section. The section outline does the same with a click or Enter.
- **Save states** are distinct: *Unsaved changes*, *Saving…*, *Saved HH:MM UTC* (only after the server acknowledged that exact text), *Offline — changes not saved* and *Save failed* (both with Retry), *Conflict — review newer revision*, *Read-only*, and *Metadata has errors — not saved*. Leaving the page with unsaved text asks first (browser back/forward excepted). Nothing is written to browser storage.
- **Conflicts:** open the same idea in two tabs, save in one, then type in the other. The second tab shows the conflict panel: compare, keep mine, or use theirs. If the draft was approved or discarded elsewhere, it offers to carry your text into a new revision instead.
- **Preview** is labelled "Editorial preview — public rendering not yet verified". Raw HTML, MDX and scripts are shown as text, links keep only public http(s)/mailto targets, and images are never fetched. Claim markers open their evidence.
- Read-only revisions (submitted, approved, legacy or older ones) offer **Edit in a new revision**, or a link to the existing working draft.

## The review and release journey (simulated)

A full run on the flagship: in Compare, see that v3 edited a verified claim; restore that sentence in Write and save; **Run checks** (More actions or Quality); in the Review tab, mark each remaining item reviewed (one click per item, bound to what you saw); **Approve v3** with the explicit statement; **Prepare preview**; **Publish v3** (the confirmation lists the exact revision, what it replaces, changed sections and claims, checks and approval, and asks for the simulated sign-in confirmation); watch the stages. Then **Roll back** (diff and re-run checks shown first), **Unpublish** (lists every affected surface, stays pending until removal is verified), **Move to Trash** and **Restore**.

- Every command is explicit and one item at a time: there is no "mark all", bulk approve or bulk publish.
- The **simulated release worker** appears while a release is in flight. It advances one stage every few seconds while the page is open, and can be paused or stepped. Nothing is deployed.
- **Settings → Demo controls** flip the simulated situations: sign-in confirmation, the kill switch, a failing deployment, a lost activation acknowledgement (to try Reconcile), a new policy version (to watch checks and approvals lapse), and a reset.
- Publish, retry, rollback, unpublish and trash need a sign-in confirmation from the last 10 minutes. The demo simulates it with a button and never asks for a password or code.

## Tests

```bash
npx vitest run tests/editorial
```

The editorial suite is not yet part of `npm test` (that script lives in `package.json`, a shared file). It covers the Editorial DTO v1 validators, state machines, domain rules, the reusable repository contract (run against the fixture adapter), seeded scenarios, the workspace gate, server-rendered UI markup and static boundary guards.

## Production gate (fixture mode must be impossible, outsiders get a real 404)

```bash
npm run build                                               # no Convex URL: every editorial page is a static 404
node tests/editorial/scripts/verify-production-build.mjs
EDITORIAL_FIXTURE_MODE=local-demo npx next start -p 3247   # second shell; the opt-in is set on purpose
node tests/editorial/scripts/verify-production-build.mjs --probe http://localhost:3247
```

Then the live build, with a Convex URL that cannot resolve (nothing is contacted):

```bash
NEXT_PUBLIC_CONVEX_URL=https://editorial-probe.invalid npx next build
npx next start -p 3247                                      # second shell
node tests/editorial/scripts/verify-production-build.mjs --probe http://localhost:3247
```

The first check scans `.next/` for fixture code and fictional-data sentinels. The probe requests every editorial path twice — with attempts to enable fixture mode through query strings and cookies, and with a forged Convex Auth session cookie — and requires HTTP 404, `noindex`, `private, no-store` and `no-referrer`, with no editorial copy or fixture text in the body. It then calls every editorial server action directly, with the action IDs from the build's server-reference manifest, and requires a refusal or `WORKSPACE_UNAVAILABLE`.

Since WP46-E4e, middleware answers every editorial request it cannot confirm as the super-admin's with the site's own 404 page: the body is byte-identical to an unknown path's. Only the operator headers differ, and every `/admin/*` path carries them, so they do not reveal whether the workspace exists. Server actions are refused by the same gate before they run.

As a positive control, the development bundle in `.next/dev/` does contain the fixture sentinels; the production bundle does not.

## Accessibility scan

With the fixture dev server running, serve the locally installed axe-core on loopback only (no download):

```bash
python3 -m http.server 3248 --bind 127.0.0.1 --directory node_modules/axe-core
```

Then, in the browser on an editorial page, inject `http://127.0.0.1:3248/axe.min.js` and run `tests/editorial/scripts/axe-run.js` (WCAG 2.0/2.1 A and AA tags). gstack `browse eval` can run that file once its Playwright browser is installed (`npx playwright install`, not done in this session because it downloads browser binaries).
