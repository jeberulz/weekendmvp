# WP28 Stories - Tenant Publish, Host Routing, Versions, Leads

Branch: `codex/wp28-tenant-hosts` (from `codex/wp27-site-preview`)
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Every story below passes its verification, the required
checks pass, an independent high-risk reviewer finds no remaining
critical/high/medium issue, and `docs/wp/wp28-progress.md` records honest
evidence.

This is a Critical-risk publishing/security package. It is the package that
decides what an arbitrary `Host:` header can reach. Every other platform
package assumed exactly one host; this one makes that assumption false.

**Scope boundary, restated from the manifest:** WP28 owns *reversible* host
routing code, tenant metadata, the lead endpoint, and a dry-run runbook.
**WP28 does not activate wildcard DNS, a production domain, or any live
customer site.** WP31 alone owns activation. Nothing in this package may be
merged in a state where deploying it changes what a production host serves.

## Dependencies (all satisfied)

- WP21 auth compatibility — passed. Session cookies are already host-only
  (`cookieConfig: { maxAge: null }`, no `Domain` value), which is a
  precondition for serving untrusted tenant hosts from the same deployment.
- WP22 platform schema/authorization — passed and frozen.
- WP27 structured renderer and isolated preview — passed 2026-08-06.

## The schema is already sufficient — WP28 changes no table

Verified against `convex/schema.ts` at `0a13b2b`. WP28 is expected to be a
**zero-diff package for `convex/schema.ts`**, which keeps the serialized
one-writer seam free for other packages:

| Need | Already frozen |
|---|---|
| Host lookup | `site_configs.hostname` (optional) + `by_hostname` index |
| Version history | `site_versions` with `version: v.int64()` and `by_siteConfigId_and_version` |
| Live pointer | `site_configs.currentVersionId` |
| Lead capture | `leads` with `synthetic: v.boolean()` and three indexes |
| Publish audit | `audit_events` |

If any story appears to need a schema change, **stop and escalate** rather
than widening the seam. A hostname uniqueness constraint is the one plausible
candidate and is addressed in `WP28-S4` without a schema change.

## Frozen state machines constrain the design (`convex/platform/transitions.ts`)

```
siteTransitions:        draft -> ready -> published        (published: [] — TERMINAL)
siteVersionTransitions: draft -> ready -> published -> retired
```

Two consequences that stories must respect rather than fight:

1. **There is no unpublish.** `site_configs.status` cannot leave `published`.
   Taking a site down, rolling back, and WP30's future project kill switch
   must all operate on `site_versions` and the `currentVersionId` pointer.
   A site whose `currentVersionId` is undefined resolves to 404 while its
   status legitimately remains `published`.
2. **Rollback is forward-only.** Rolling back to version N means promoting a
   version, not un-retiring one — `retired: []` is terminal too.

Do not relax either transition map. They belong to a passed WP22 gate.

## The current fallback, precisely

`middleware.ts` → `canonicalRedirect()` classifies hosts as exactly three
things: prod apex, prod www, and *everything else*. "Everything else" gets
path cleanup and then falls through to the full application.

That is safe today only because no other host resolves. The moment
`*.weekendmvp.app` resolves, **every tenant subdomain and every unknown
subdomain would serve the entire marketing site plus `/dashboard`** — the
platform's own authenticated surface, reachable at a customer-controlled
hostname. This is what the manifest means by "Absent; current fallback
unsafe," and it is why WP28 must land before WP31 activates the wildcard.

## Owner rulings — CLOSED 2026-08-07

Both manifest questions were ruled by the owner on 2026-08-07 and are recorded
in `docs/wp/RULINGS.md` (four rows). **Do not re-litigate.** Every ruling
confirmed the default this freeze was written against, so no story changed.

| # | Manifest question | Ruling |
|---|---|---|
| 1a | Is the dead legacy fallback removed or replaced? | **Removed.** Unknown and reserved hosts answer a bare 404 from middleware — no branding, no shell, no `location`, no `set-cookie`. Redirecting unknown hosts to www was rejected (advertises the deployment as ours), as was splitting behaviour between unknown and reserved (the difference alone reveals the reserved list). |
| 1b | Which subdomains are permanently reserved? | **The 40-name list frozen in `lib/tenant-host.ts`.** Re-checked server-side in `publish`; the client copy is a UX affordance, not the boundary. |
| 2a | What is the tenant-lead retention period? | **Synthetic only — WP28 stores no real tenant lead.** `S5` rejects a real email or free-text payload rather than dropping it silently. Real capture is a WP31 activation item, gated on privacy/retention text. |
| 2b | Which staging host is approved? | **Vercel preview deployments.** No DNS, no certificate, no change to what a production host serves. |

`WP28-S6` is no longer blocked on owner rulings.

## Architecture Decisions (orchestrator, not owner rulings)

- **Unknown and reserved hosts 404 from middleware, never from `notFound()`.**
  Under `cacheComponents`, PPR flushes a 200 shell before `notFound()` runs —
  proven on WP27 for `/preview/{token}` and `/build/{slug}`. A route-level
  `notFound()` therefore produces a *soft* 404, which would fail this
  package's "unknown tenant is 404" gate criterion outright. Middleware runs
  before the route and can return a genuine status, so host rejection lives
  there. This is a hard constraint, not a preference.
- **Host classification is a pure function in its own module.** `lib/tenant-host.ts`
  takes a host string and returns a discriminated result. No I/O, no Convex,
  no `next/server` import, so it is directly testable from `node --test` and
  reusable by middleware, the tenant route, and the runbook. Mirrors the
  existing `lib/canonical-path.ts` split.
- **Host → site resolution never trusts the client.** The tenant route derives
  `siteConfigId` from the `Host` header via `by_hostname` server-side. No
  project, owner, or site identifier is ever accepted from a query parameter,
  body, or cookie on a tenant host.
- **Canonicalization must not leak across host classes.** `canonicalRedirect`
  currently redirects any dirty path on any host. On a tenant host it must
  never redirect to `www.weekendmvp.app`, or a customer's visitor lands on our
  marketing site.

## Stories

- [x] `WP28-S1` - Host contract and classifier (no behaviour change)
  - Scope: new `lib/tenant-host.ts` + tests. **No edit to `middleware.ts` in
    this story** — this story must be provably inert.
  - Acceptance criteria:
    - A pure `classifyHost(host)` returns a discriminated union covering at
      minimum: `apex`, `www`, `tenant` (carrying the normalized slug),
      `reserved`, `platform-preview` (Vercel preview deployments), `local`,
      and `unknown`.
    - Host normalization strips the port, lowercases, and rejects trailing
      dots, embedded credentials, and IDN/punycode confusables rather than
      guessing. An unparseable host classifies as `unknown`, never as
      `tenant`.
    - A frozen reserved-subdomain list is exported as a constant. Proposed
      starting set for owner confirmation: `www`, `app`, `api`, `admin`,
      `auth`, `login`, `dashboard`, `mail`, `smtp`, `imap`, `ns1`, `ns2`,
      `mx`, `ftp`, `cdn`, `static`, `assets`, `img`, `blog`, `docs`, `help`,
      `support`, `status`, `staging`, `preview`, `test`, `dev`, `internal`,
      `billing`, `pay`, `stripe`, `webhook`, `webhooks`, `security`, `abuse`,
      `postmaster`, `webmaster`, `root`, `system`, `weekendmvp`.
    - Slug shape is constrained (length bounds, `[a-z0-9-]`, no leading or
      trailing hyphen, no double hyphen at positions 3–4 which is the
      punycode prefix) so a tenant slug can never collide with a reserved
      name or a DNS label that some resolver treats specially.
    - Multi-label subdomains (`a.b.weekendmvp.app`) do **not** classify as
      `tenant`.
  - Verification: unit tests over an explicit host matrix including the
    reserved list, case variance, ports, trailing dots, `xn--` prefixes, an
    empty host, and a host header carrying a path or `@`. Confirm the new
    suite's count moves in the **full** `npm test`, not just standalone.

- [x] `WP28-S2` - Middleware host routing and isolation
  - Scope: `middleware.ts` (serialized one-writer seam — coordinate before
    editing), `lib/canonical-path.ts` if the apex/www predicates need to
    compose with the classifier.
  - Acceptance criteria:
    - Apex and www behaviour is **unchanged**, including the existing one-hop
      canonicalization and the auth-managed path decisions. Regression tests
      from WP13/WP21 still pass untouched.
    - Unknown and reserved hosts receive a genuine HTTP **404** issued from
      middleware, with no marketing content, no application shell, and no
      redirect to a platform host.
    - A tenant host cannot reach any platform surface: `/dashboard/**`, the
      auth routes, `/build/**`, `/preview/**`, `/api/platform/**`, `sitemap.xml`,
      and `robots.txt` are all unreachable, and none of them leaks its
      existence through a differing status or redirect.
    - No path on a tenant host redirects to an apex or www URL.
    - Session cookies remain host-only — no `Domain` attribute is introduced,
      so a platform session is never presented to a tenant host and a tenant
      host can never set a cookie the platform will read.
    - The middleware `matcher` still covers every private path it covers today.
  - Verification: a host × path matrix asserting real status codes against
    **`next build` + `next start`** (never `next dev` — WP27 recorded a false
    404 measured that way). Include at minimum apex, www, a known tenant, a
    reserved name, an unknown name, and a Vercel preview host, each crossed
    with a public path, a dashboard path, and an auth path. Mutation-test the
    isolation assertions: break the guard on purpose and confirm red.

- [x] `WP28-S3` - Tenant route rendering a published version
  - **Deviation raised at S3, CLOSED in S4 (2026-08-07).** Unpublished,
    retired, and unknown sites answered 200 with the not-found body, because
    `notFound()` cannot set a status under PPR. Resolved by a best-effort,
    **fail-open** publish check in middleware: only a definitive "not
    published" produces a 404, and any ambiguous result serves the route
    exactly as before. Verified live — all four refusal cases now return a
    genuine 404. See `docs/wp/wp28-progress.md`.
  - Scope: new tenant route segment, host→site resolver in
    `convex/platform/sites/*`, `next.config.ts` headers for tenant hosts.
  - Acceptance criteria:
    - A tenant host whose `site_configs` row has `status: "published"` and a
      `currentVersionId` renders that version's `SiteRenderSpec` through the
      WP27 renderer. The renderer is reused, not reimplemented or forked.
    - Every other case resolves to the S2 404 path: no such hostname, site not
      published, `currentVersionId` undefined, version retired, project or
      site archived.
    - The rendered page is **self-canonical** to the tenant host. It never
      emits a canonical, OG, sitemap, or JSON-LD URL pointing at
      `weekendmvp.app`, and never inherits the platform's `sitemap.xml` or
      `robots.txt`.
    - No WP27 preview affordance appears on a published tenant site: no
      watermark, no `PreviewNotice`, no claim bar.
    - The published tenant page carries no platform analytics that would
      attribute a customer's visitors to our property, and no capability
      token can appear in any tenant URL.
    - Content is server-rendered. Per-template XSS assertions are re-run at
      the tenant route, because this is the first place template output is
      served to a *public* audience.
  - Verification: live evidence at a production build for each of the six
    resolution cases; axe-core AA scan per template at two widths on a
    published tenant host; explicit assertion that the response contains no
    `weekendmvp.app` canonical.

- [x] `WP28-S4` - Atomic publish, versioning, and rollback
  - Scope: `convex/platform/sites/publish.ts` (+ tests). No schema change.
  - Acceptance criteria:
    - Publish is a single Convex mutation that derives identity server-side
      via the existing owner helpers and **never accepts a caller-supplied
      owner or project ID as the authorization**.
    - Publishing is atomic: version status, `currentVersionId`, and site
      status move together or not at all. A partially published site is not
      reachable at any point.
    - Version numbers are monotonic per `site_configs` row and gap-free,
      derived server-side from `by_siteConfigId_and_version`. Two concurrent
      publishes must not produce duplicate version numbers — assert this under
      real OCC contention, not in sequence.
    - Hostname assignment is exactly-once and collision-free without a schema
      uniqueness constraint: claiming a hostname reads `by_hostname` and
      writes inside the same transaction, and the reserved list from S1 is
      re-checked **server-side** (the client list is a UX affordance, not the
      boundary).
    - Rollback promotes a prior version's content as a **new** version and
      retires the current one, honouring `retired: []` and `published: []`
      terminality. The previously live version is never mutated in place.
    - Every publish, rollback, and hostname change writes an `audit_events`
      row.
    - Repeating a publish request with the same idempotency key does not
      create a second version.
  - Verification: Convex tests including a two-user denial matrix, concurrent
    publish, concurrent hostname claim, replayed publish, rollback then
    forward again, and publish attempts against archived projects.

- [ ] `WP28-S5` - Tenant lead endpoint (synthetic only)
  - Scope: lead API route on tenant hosts, `convex/platform/sites/leads.ts`.
  - Acceptance criteria:
    - `projectId`, `ownerId`, and `siteConfigId` are **all derived from the
      resolved host**, never from the request body. A forged body cannot
      attach a lead to another owner's project.
    - The endpoint exists only on tenant hosts and only for a published site.
    - **Ruled 2026-08-07: synthetic only.** Every stored lead has
      `synthetic: true`, and the endpoint refuses to persist a real email or
      free-text payload. Failing closed is required; silently dropping PII is
      not acceptable, the request must be **rejected**. Real capture is a WP31
      activation item, gated on privacy/retention text being written first.
    - Rate limited per IP with the same IPv6 `/64` truncation WP27 uses, and
      origin-checked the same way `app/api/platform/preview/_server.ts` does.
    - Leads are readable only by the owning user through an owner-scoped
      query. No cross-tenant read is possible.
    - No lead identifier, email, or payload reaches analytics or logs.
  - Verification: forged-owner attempt, cross-tenant read attempt, rate-limit
    exhaustion, PII rejection, and an assertion that no production lead row
    can be created while ruling #2 is open.

- [ ] `WP28-S6` - Activation runbook (dry run) and package gate
  - Scope: `docs/wp/wp28-activation-runbook.md`, `docs/wp/wp28-progress.md`,
    `docs/wp/wave-gate-report.md`.
  - Acceptance criteria:
    - A runbook covering wildcard DNS, certificate issuance, the host matrix,
      rollback, and the exact revert commit — **executed as a dry run only**
      against **Vercel preview deployments** (ruled 2026-08-07). No DNS
      record, domain, or wildcard is created or changed.
    - Both owner rulings are recorded in `docs/wp/RULINGS.md` (closed
      2026-08-07, four rows). Verify they still match what shipped.
    - Full checks pass and are reported honestly: `npm run typecheck`,
      `npm run lint` (0 errors), `npm test`, `npm run build`,
      `npm audit --omit=dev --audit-level=high`, `git diff --check`.
    - `git diff --stat` confirms `convex/schema.ts` is unchanged by WP28.
    - Independent high-risk review with no unresolved critical/high/medium
      finding, covering at minimum: host confusion and header spoofing
      (`X-Forwarded-Host` vs `Host`), tenant→platform isolation, cookie
      scope, publish atomicity under concurrency, and lead ownership.
    - The WP27 follow-ups are re-stated, not silently inherited: the
      `preview_capabilities` retention cron is still required before public
      free-preview exposure.
  - Verification: gate report entry appended to `docs/wp/wave-gate-report.md`
    with evidence, matching the WP27 entry's format.

## Traps carried forward from WP27 (verified, still apply)

1. Soft-404 under Cache Components — `notFound()` returns 200. Measure status
   against `next build` + `next start`, never `next dev`.
2. `convex-test` ignores public/internal visibility; assert that boundary
   statically.
3. The generated `api` object is a proxy — `Object.keys` is `[]` and any
   assertion built on it is vacuous forever.
4. `import.meta.glob` in Convex tests must be root-absolute (`"/convex/**/*.ts"`),
   and every rejection assertion must name its expected error.
5. Green targeted tests do not prove CI wiring — confirm counts move in the
   full `npm test`.
6. Strip comments before static security assertions (`readCode()` in
   `tests/security/wp27-preview-*.test.mjs`).
7. A rate limit consumed inside a mutation that later throws is rolled back —
   keep quota consumption in its own committed mutation.
8. `grep` masks exit codes; use `${pipestatus[1]}` in zsh.
9. Mutation-test every security suite.
10. Never print, log, or commit a secret.
11. **Convex typechecks with `convex/tsconfig.json`, not the root one.** A
    mismatch makes `convex dev` stop pushing while the local backend keeps
    serving stale functions, so the symptom is "Could not find public function"
    against an otherwise healthy backend — not a visible error. Cost real time
    at S4.
