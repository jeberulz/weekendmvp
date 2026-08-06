# WP28 Progress - Tenant Publish, Host Routing, Versions, Leads

Branch: `codex/wp28-tenant-hosts` (from `codex/wp27-site-preview` @ `0a13b2b`)
Lane: Work Package

Append-only. Each entry records what was verified and how, including failures.
Treat every claim here as a claim until independently checked — a WP27 entry in
the equivalent file was proven false by review.

---

## 2026-08-06 - Package opened, stories frozen

**Lane:** Work Package. Owner selected WP28 as the next lane after the WP27
package gate passed, and chose `codex/wp27-site-preview` as the branch base.

**Branch:** `codex/wp28-tenant-hosts` created from `codex/wp27-site-preview`
at `0a13b2b`.

**Stories:** `docs/wp/wp28-stories.md` frozen with six stories (S1 host
classifier, S2 middleware routing, S3 tenant route, S4 publish/rollback,
S5 lead endpoint, S6 runbook + gate). No implementation started.

### Findings established during the freeze (verified against code, not docs)

- **`convex/schema.ts` needs no WP28 change.** Read at `0a13b2b`:
  `site_configs.hostname` and its `by_hostname` index, `currentVersionId`,
  `site_versions` (`version: v.int64()`, `by_siteConfigId_and_version`), and
  `leads` (`synthetic: v.boolean()`, three indexes) are all already frozen and
  sufficient. WP28 is expected to be a zero-diff package for the serialized
  one-writer schema seam. Recorded as an S6 gate assertion.

- **`siteTransitions.published` is terminal** (`convex/platform/transitions.ts:56-60`).
  There is no unpublish, and `siteVersionTransitions.retired` is terminal too.
  Consequence recorded in the stories: rollback is forward-only (promote a new
  version, retire the current one), and any future takedown — including WP30's
  project kill switch — must work through `currentVersionId`, not site status.
  A published site with an undefined `currentVersionId` resolves to 404 while
  its status legitimately remains `published`.

- **The unsafe fallback is concrete, not theoretical.**
  `middleware.ts` → `canonicalRedirect()` (`middleware.ts:28-59`) classifies a
  host as prod apex, prod www, or *everything else*, and "everything else"
  receives path cleanup and then falls through to the full application. That is
  safe only while no other host resolves. Once `*.weekendmvp.app` resolves,
  every tenant and unknown subdomain would serve the marketing site **and
  `/dashboard`** at a customer-facing hostname. This is why WP28 must land
  before WP31 activates the wildcard.

- **WP28's "unknown tenant is 404" gate criterion collides with the WP27
  soft-404 trap.** Under `cacheComponents`, PPR flushes a 200 shell before
  `notFound()` executes, so a route-level 404 is soft. Middleware runs before
  the route and can return a genuine status. Recorded as a hard architecture
  decision: host rejection is issued from middleware, never via `notFound()`.

### Open owner rulings — S6 cannot pass without them

Both currently sit in `docs/wp/program-manifest.md` as *defaults until ruled*,
not as rulings in `docs/wp/RULINGS.md`. Stories are written against the
defaults so work is not blocked.

1. Legacy fallback disposition and the permanently reserved subdomain list.
   Default assumed: remove the fallback; unknown and reserved hosts 404. A
   proposed 40-name reserved list is in `WP28-S1` for confirmation.
2. Approved staging host and tenant-lead retention period. Default assumed:
   isolated preview deployments with synthetic leads only; no production
   tenant lead persisted until owner-approved retention/privacy text exists.

**Checks:** none run — no code changed in this entry.

**Docs updated:** `docs/wp/wp28-stories.md` (new), `docs/wp/wp28-progress.md`
(new). `docs/wp/AGENT_HANDOFF.md` updated separately at `86bb2eb`.

**Next:** `WP28-S1` on owner instruction. Not started.

---

## 2026-08-06 - WP28-S1 host classifier delivered

**What shipped:** `lib/tenant-host.ts` (pure, no I/O, no `next/server`) exporting
`classifyHost`, `normalizeHost`, `isValidTenantSlug`, `isTenantHost`,
`tenantHostForSlug`, `RESERVED_SUBDOMAINS` (40 names), and the slug length
bounds. `classifyHost` returns a discriminated union over `apex`, `www`,
`tenant`, `reserved`, `platform-preview`, `local`, and `unknown`.

Tests: `tests/redirects/tenant-host.test.mjs`, 21 tests. Placed in
`tests/redirects/` deliberately — that script already runs
`--experimental-strip-types` and globs the directory, so the suite is picked
up by `npm test` with no `package.json` change and cannot become orphaned
(the trap that once hid 48 tests from CI).

**The story is inert, and that is asserted rather than asserted-in-prose.**
`middleware.ts` is untouched. A test strips comments from `middleware.ts` and
asserts it references neither `tenant-host` nor `classifyHost`, so wiring it
up without updating the story turns the suite red.

### Design decisions worth carrying into S2

- Fail-closed throughout: anything unparseable is `unknown`, never `tenant`.
- A trailing dot is **rejected**, not trimmed. `weekendmvp.app.` is a valid
  FQDN spelling, but accepting it would give every host two forms while
  `site_configs.hostname` stores exactly one and `by_hostname` matches
  exactly.
- `www` is a member of `RESERVED_SUBDOMAINS` but classifies as `www`, checked
  before the reserved branch, so existing WP13 canonicalization is unaffected.
- Reserved names cover both infrastructure (`api`, `admin`, `staging`) and
  names a visitor would trust as ours (`billing`, `security`, `support`),
  which would otherwise be available for phishing.
- IPv6 literals are handled before the port split, since the `:` heuristic
  would otherwise mangle `[::1]:3000`.

### One configuration change, and why

`tsconfig.json` gained `"allowImportingTsExtensions": true` (one line; legal
because `noEmit` is already true). `lib/tenant-host.ts` imports
`./canonical-path.ts` **with** the extension because it is the first `lib`
module loaded directly by Node's ESM resolver, which does not add extensions.
The alternative was duplicating `PROD_APEX_HOST`/`PROD_WWW_HOST`, which would
have created a silent drift risk between the canonical host and the tenant
suffix. The flag is permissive only — it forbids nothing that worked before.

Verified rather than assumed: a full `npm run build` succeeds, so Next
resolves the extension form. This matters because S2 imports this module from
Edge middleware.

### Mutation testing (trap 10)

Five single-guard mutations, each confirmed applied by `cmp` against a backup
before running:

| Mutation | Result |
|---|---|
| Drop the slug shape regex | **red** (2 failures) |
| Drop the RFC 5891 `--` positions 3-4 rule | **red** (1) |
| Remove the `www` branch so it falls to `reserved` | **red** (2) |
| Drop the `xn--` normalization rejection | **red** (1) |
| Drop the credentials/path character guard | **red** (1) |

Two further mutations — allowing multi-label subdomains, and accepting a
trailing dot — did **not** turn the suite red. Traced directly rather than
assumed: with the multi-label guard removed `a.b.weekendmvp.app` still
classifies `unknown` because the slug regex rejects `a.b`, and with the
trailing-dot guard removed `weekendmvp.app.` still normalizes to `null`
because the empty-label check catches it. Both are redundant guards, not
coverage gaps. Recorded because a future refactor that removes the *second*
guard in either pair would be caught by no test.

### Checks

- `npm run typecheck` — exit 0
- `npm run lint` — exit 0, 0 errors, 35 pre-existing warnings (unchanged)
- `npx eslint` on both new files — exit 0, 0 findings
- `npm test` — exit 0. Node groups 91/6/**28**/46/4 (redirects 7 → 28, +21)
  and vitest groups 125/172/57/567 unchanged. Counts confirmed in the **full**
  run, not standalone.
- `npm run build` — exit 0, **313** pages
- `npm audit --omit=dev --audit-level=high` — 0 vulnerabilities
- `git diff --check` — clean

**Correction to the recorded baseline:** WP27 recorded 312 pages, and this
build reports 313. This is **not** attributable to S1, which adds no route.
Verified by moving both new files aside, reverting `tsconfig.json`, and
building a clean tree at HEAD — that build also reports **313**. The 312
figure carried in `wp27-progress.md`, `wave-gate-report.md`, and
`AGENT_HANDOFF.md` is stale for this checkout. Use 313 as the WP28 baseline.

**Docs updated:** this file. `docs/wp/wp28-stories.md` S1 checked.

**Not done / out of scope:** `middleware.ts` untouched; no host behaviour
changes anywhere. The reserved list remains provisional pending open owner
ruling #1.

---

## 2026-08-06 - WP28-S2 middleware host routing and isolation

**What shipped:** `middleware.ts` now classifies the host before anything
else. New exports: `hostRoutingDecision` (pure: `platform` | `tenant` |
`reject`) and an internal `hostRejectedResponse`.

- `apex`, `www`, `platform-preview`, `local` → `platform`, existing behaviour
  entirely unchanged.
- `reserved`, `unknown` → `reject`.
- `tenant` → also answers the rejection response **in S2**, because the tenant
  route does not exist until S3. Every path answers identically, so no
  platform surface can be probed by comparing statuses, and the auth
  middleware never runs — a tenant host never touches a session cookie.

**Ordering is the security property.** Host classification runs *before*
`canonicalRedirect`. Previously canonicalization was the first hop, which
would hand a tenant or unknown host a 308 into the platform before anything
checked whether that host was ours to serve. A static test asserts this
ordering inside the `middleware` function body.

**The 404 is issued from middleware, never `notFound()`**, because under
`cacheComponents` PPR flushes a 200 shell before `notFound()` runs. A test
asserts `notFound(` appears nowhere in `middleware.ts`.

### An existing test pinned the behaviour this story removes

`tests/redirects/middleware.test.ts` carried
`["https://project.weekendmvp.app/ideas/example/", "project.weekendmvp.app"]`
in the "cleans in place without forcing www" matrix. `project.weekendmvp.app`
classifies as a **tenant**, so that case asserted a tenant subdomain being
served the marketing application with a 308 — exactly the fallback WP28
exists to remove. It was written when no tenant host could exist.

The case was removed and replaced by the isolation suite, with a comment left
at the site explaining what used to be there and why it went. Flagged here
because deleting a failing test is normally the wrong move; in this instance
the test encoded the defect.

The S1 inertness test (`middleware.ts` must not reference the classifier) also
fired, as designed. It was replaced with the two structural assertions above
rather than deleted.

### Live evidence — production build, `next build` + `next start -p 3100`

Never measured against `next dev`. Full 7 host × 7 path matrix run; summary:

| Host | Class | `/startup-ideas` | `/dashboard` | `/robots.txt` | `/api/platform/…` | `/nothing-here` |
|---|---|---|---|---|---|---|
| `www.weekendmvp.app` | www | 200 | 307 → `/signin?returnTo=…` | 200 | 405 | 404 |
| `weekendmvp.app` | apex | 308 → www | 308 → www | 308 → www | 308 → www | 308 → www |
| `acme.weekendmvp.app` | tenant | 404 | 404 | 404 | 404 | 404 |
| `admin.weekendmvp.app` | reserved | 404 | 404 | 404 | 404 | 404 |
| `evil.com` | unknown | 404 | 404 | 404 | 404 | 404 |
| `a.b.weekendmvp.app` | multi-label | 404 | 404 | 404 | 404 | 404 |
| `weekendmvp.app.evil.com` | lookalike | 404 | 404 | 404 | 404 | 404 |

Rejection response verified directly: `HTTP/1.1 404`, `cache-control: no-store`,
`x-robots-tag: noindex, nofollow`, `content-type: text/plain`, body exactly
`Not Found` (9 bytes) — no branding, no HTML, no `weekendmvp.app` string. Zero
`set-cookie` headers on tenant, reserved, and unknown hosts. No `location`
header on any rejection.

### Finding: static assets bypass the middleware matcher

`/_next/static/chunks/*.js` returns **200 on every host**, including
`evil.com`, because the matcher excludes `_next/static` (and has since long
before WP28). Measured, not assumed.

Not fixed here, and the S2 acceptance criteria are still met — the criteria
name "marketing content" and "application shell", and a build chunk is
neither. The chunks are already served publicly from `www` to anyone who asks,
so pointing another hostname at the deployment yields nothing that was not
already public, and no HTML means the application does not function there.

The alternative — widening the matcher to cover `_next/static` — would run
middleware on every asset request for **all** hosts including `www`, which is
a real latency and invocation cost paid on every page load to close a gap
with no confidentiality value. Recorded for the S6 independent reviewer to
overturn if they disagree; it is their call, not mine to close silently.

### Mutation testing (trap 10)

Six mutations, each confirmed applied by `cmp` against a backup before running,
and the file confirmed byte-identical to backup afterwards:

| Mutation | Result |
|---|---|
| Unknown/reserved hosts fall through to the platform | **red** (9 failures) |
| Tenant hosts fall through to the platform | **red** (4) |
| Rejection returns 200 instead of 404 | **red** (8) |
| Rejection redirects to www instead of answering | **red** (8) |
| Rejection body leaks branded HTML | **red** (1) |
| Reserved subdomains classified as platform | **red** (3) |

### Checks

- `npm run typecheck` — exit 0
- `npm run lint` — exit 0, 0 errors, 35 pre-existing warnings (unchanged)
- `npm test` — exit 0. Node groups 91/6/**29**/46/4, vitest groups
  **140**/172/57/567 (redirects vitest 125 → 140). Counts confirmed in the
  full run.
- `npm run build` — exit 0, 313 pages
- `npm audit --omit=dev --audit-level=high` — 0 vulnerabilities
- `git diff --check` — clean
- `git diff --stat convex/schema.ts` — empty; schema untouched, as planned

### Known limitation in unit coverage

`convexAuthNextjsMiddleware` calls `headers()` before our handler, which has
no request scope under vitest, so a **clean** path on a platform host cannot
be driven through the full middleware in a unit test. Every pre-existing
platform test happens to use a dirty path that `canonicalRedirect` answers
first, which is why this was never hit before. Platform hosts are therefore
asserted at the pure `hostRoutingDecision` level in unit tests, and that they
still serve is proven by the live matrix above. Stated rather than papered
over.

**Docs updated:** this file, `docs/wp/wp28-stories.md` (S2 checked).

**Not done / out of scope:** tenant hosts serve nothing yet — the tenant route
is S3. Reserved list still provisional pending owner ruling #1.

---

## 2026-08-06 - WP28-S3 tenant route (one AC NOT met — see below)

**What shipped**

- `convex/platform/sites/read.ts` — public `resolvePublishedSite({ hostname })`.
  Returns `{ renderSpec }` and nothing else; every refusal is the same `null`.
- `app/site/[slug]/page.tsx` — the tenant route. Not addressable: middleware
  rewrites `/` on a tenant host to it, and 404s `/site/*` on every platform
  host.
- `middleware.ts` — tenant `/` rewrites (never redirects); every other tenant
  path 404s; `/site/*` 404s on platform hosts.
- `components/preview/templates/index.tsx` — `showPreviewChrome` threaded
  through, **required, never defaulted**.
- `ConsentBanner` / `AnalyticsScripts` — suppressed on a tenant origin.

### One AC is NOT met: refusals answer 200, not 404

The S3 AC says every non-published case "resolves to the S2 404 path". It does
not. Measured on a production build:

| Host | Case | Status | Body |
|---|---|---|---|
| `acme` | published, editorial | 200 | site rendered |
| `brightly` | published, product | 200 | site rendered |
| `lumen` | published, minimal | 200 | site rendered |
| `draftco` | site status `draft` | **200** | not-found body |
| `noversion` | no `currentVersionId` | **200** | not-found body |
| `retired` | current version retired | **200** | not-found body |
| `nosuchsite` | no such hostname | **200** | not-found body |

This is the WP27 soft-404 trap reaching the tenant route: middleware rejects
*hosts* with a genuine 404, but a well-formed tenant host whose site is not
published falls through to the route, where `notFound()` cannot set a status
because PPR has already flushed a 200 shell.

**Not a leak.** The four refusal reasons are indistinguishable from each
other: `draftco` and `retired` produce byte-identical response lengths, and
the only variance across the set tracks slug length, which the shared
not-found page echoes. A stranger cannot tell "not published" from "no such
subdomain", so there is no enumeration oracle.

**It is still a real defect**, and worse here than in WP27, because these are
public customer pages: a taken-down or rolled-back site answering 200 with a
"not found" body is a textbook soft 404, which search engines penalise and
which will keep the dead URL indexed.

**Why it was not fixed in S3.** The only place a genuine status can be set is
middleware, which would have to resolve publish state per request — an
Edge→Convex fetch on every tenant page view, duplicating the lookup the route
then performs, and fail-closed on a Convex blip means one backend hiccup dark
every customer site at once. That is an architecture decision with real
availability consequences, not a code tweak, and it belongs with S4 where the
publish/rollback and takedown paths land. **Escalated rather than decided.**

Consequence for the manifest: WP28's stated gate criterion "unknown tenant is
404" is currently met for unknown *hosts* and not for unpublished *sites*.
`WP28-S6` must not be closed while that is true.

### Defect found live and fixed: platform branding on customer titles

The first build emitted `<title>Verify any collectible… | Weekend MVP</title>`
on the tenant page — the root layout's `template: "%s | Weekend MVP"` stamping
our brand onto a customer's own site. Fixed with `title: { absolute: … }`.
Found only because the live check read the actual `<title>`; no unit test
would have caught it, and it is now asserted in the route suite.

### Live evidence (production build, `next start -p 3100`)

Verified on `acme.weekendmvp.app`:

- `<link rel="canonical" href="https://acme.weekendmvp.app"/>` and matching
  `og:url` — self-canonical, and **zero** occurrences of `www.weekendmvp.app`
- `<title>Verify any collectible in under a minute</title>` — no platform suffix
- Preview chrome absent: no watermark, no "private preview" notice, no claim
  bar, no `claimPreview`
- Platform chrome absent: no cookie banner, no `googletagmanager`, no
  `connect.facebook.net`
- Zero `<form>` tags — lead capture is S5 and is structurally absent
- Zero `noindex` — a published customer site is meant to be indexed
- `/site/acme` → 404 from **both** `www.weekendmvp.app` and the tenant host
- `/about`, `/dashboard`, `/robots.txt`, `/sitemap.xml` on a tenant host → 404

Test data was created by a temporary `devSeed` internal mutation, which was
**deleted before commit** — the real publish path is S4. The seed is therefore
not reproducible from this branch; S6 should re-gather this evidence using
S4's publish mutation.

### Testing notes

- `tests/security/wp28-templates-tenant.test.tsx` re-runs the injection matrix
  per template in the `showPreviewChrome={false}` configuration. WP27's suite
  only ever rendered the preview configuration, so nothing proved escaping
  survived removing the chrome — and this is the first time template output is
  served to strangers rather than to one capability holder.
- Two of my own assertions were wrong first time and are recorded because the
  first was the **known WP27 false-positive family**: `not.toContain(" onerror=")`
  fails against correctly-escaped output, because `&lt;img src=x onerror=&quot;`
  contains that literal text while being completely inert. Replaced with
  assertions on raw markup only. The second wrongly assumed every payload
  contains `<`.
- One Convex test was **vacuous** and was rewritten: asserting on
  `Object.keys(api.…._args)` passes forever because the generated `api` is a
  proxy — probed empirically (`_args` → `{}`) before replacing it with a
  source-level assertion.
- `package.json` `test:security` was extended to name the new `.tsx` suite.
  It globs `*.test.mjs` for node but lists `.tsx` files individually, so the
  new suite would otherwise have been orphaned from `npm test` — the trap that
  once hid 48 tests.

### Checks

- `npm run typecheck` — exit 0
- `npm run lint` — exit 0, 0 errors, 35 pre-existing warnings (unchanged)
- `npm test` — exit 0. Node groups 91/6/**29**/**60**/4, vitest groups
  **147**/172/**84**/**585**. Security node 46 → 60, security vitest 57 → 84,
  Convex 567 → 585. Confirmed in the full run.
- `npm run build` — exit 0, **314** pages (313 + `/site/[slug]`)
- `npm audit --omit=dev --audit-level=high` — 0 vulnerabilities
- `git diff --check` — clean
- `convex/schema.ts` — unchanged

**Docs updated:** this file. `docs/wp/wp28-stories.md` S3 left **unchecked**:
one acceptance criterion is unmet and recorded above.

**Not done:** the soft-404 on unpublished tenant hosts (escalated to S4);
lead capture (S5); reserved list still provisional pending owner ruling #1.
