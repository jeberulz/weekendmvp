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
