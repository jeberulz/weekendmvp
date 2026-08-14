# WP28 activation runbook — tenant host routing

**Owner:** John Iseghohi
**Package:** WP28 (tenant publish, host routing, versions, leads)
**Branch:** `codex/wp28-tenant-hosts` (from `codex/wp27-site-preview` @ `0a13b2b`)
**Staging host:** Vercel preview deployments (owner ruling 2026-08-07)

> ## WP28 DOES NOT EXECUTE THIS RUNBOOK
>
> This document is written and **dry-run** inside WP28. **WP31 alone owns
> activation.** No step below that creates or changes a DNS record, a domain,
> a wildcard, or a certificate may be executed under WP28 — and nothing in
> this package may be merged in a state where deploying it changes what a
> production host serves.
>
> Every step is **owner-executed**. None of it is safe to automate.

---

## 0. What changes the moment a wildcard resolves

This is the whole reason WP28 exists, and the reason it must merge *before*
WP31 activates anything.

Before WP28, `middleware.ts` classified hosts as exactly three things: prod
apex, prod www, and *everything else* — and "everything else" fell through to
the full application. That was safe only while no other host resolved. The
moment `*.weekendmvp.app` resolves, the pre-WP28 code would serve the entire
marketing site **and `/dashboard`** at every tenant and unknown subdomain.

**Therefore: never activate the wildcard against a deployment that does not
contain WP28.** Check first (see §5).

---

## 1. Pre-activation prerequisites

Every item must be ✅ before any DNS change is considered.

- [ ] WP28 package gate passed — `docs/wp/wave-gate-report.md`
- [ ] WP28 merged into whatever branch production deploys from
- [ ] WP38 (super-admin control plane) merged — manifest requires it before
      production activation
- [ ] `preview_capabilities` retention job exists (WP27 follow-up, still open;
      required before the anonymous free preview is public)
- [ ] Production Convex deployment has the WP28 functions
      (`platform/sites/read:isPublished`, `platform/sites/read:resolvePublishedSite`,
      `platform/sites/publish:*`, `platform/sites/leads:*`)
- [ ] `NEXT_PUBLIC_CONVEX_URL` set in Vercel **production** env
      — ⚠️ `NEXT_PUBLIC_*` is inlined at **build** time. If it is empty at
      build, `lib/tenant-publish-check.ts` silently returns `null` for every
      request and every unpublished tenant host soft-404s again. After changing
      it, trigger a fresh build; updating the env var alone does not re-inline it.
- [ ] The reserved subdomain list in `lib/tenant-host.ts` is still the ruled
      40 names (`docs/wp/RULINGS.md`, 2026-08-07)
- [ ] Tenant leads are still synthetic-only, or the WP31 privacy/retention
      text has been written and recorded as a ruling

---

## 2. Wildcard DNS and certificate (WP31 — DO NOT RUN UNDER WP28)

1. In Vercel → Project → Domains, add `*.weekendmvp.app`.
2. Vercel issues a wildcard certificate via Let's Encrypt. This requires a
   **DNS-01** challenge, so the domain's nameservers must be Vercel's, or a
   `_acme-challenge` CNAME must be delegated.
3. Add the DNS record:

   ```
   *.weekendmvp.app.   CNAME   cname.vercel-dns.com.
   ```

4. Wait for the certificate to show **Valid** in the Vercel dashboard before
   proceeding. A wildcard host that resolves without a certificate produces a
   TLS error, not a 404, and no middleware runs at all.

**Do not** add `*.weekendmvp.app` as a redirect. It must serve the project.

**Apex and www are unaffected.** `weekendmvp.app` still 308s to
`www.weekendmvp.app`; the Vercel Domains API apex `redirect` must stay `null`
(WP13 ruling — a host-only domain redirect preserves dirty paths and forces a
second hop).

---

## 3. Host matrix — the acceptance test for activation

Run against the deployment **before** pointing real traffic at it. Every row
must match exactly. Any deviation aborts activation and triggers §6.

| Host | Path | Expected |
|---|---|---|
| `weekendmvp.app` | any | 308 → `https://www.weekendmvp.app/…` |
| `www.weekendmvp.app` | `/startup-ideas` | 200, marketing page |
| `www.weekendmvp.app` | `/dashboard` | 307 → `/signin?returnTo=…` |
| `www.weekendmvp.app` | `/site/acme` | **404** (internal rewrite target, never addressable) |
| `www.weekendmvp.app` | `/__lead`, `/api/tenant/lead` | **404** |
| `{published}.weekendmvp.app` | `/` | 200, the customer's site, self-canonical |
| `{published}.weekendmvp.app` | `/dashboard`, `/robots.txt`, `/sitemap.xml`, `/about` | **404** |
| `{published}.weekendmvp.app` | `/__lead` POST, empty JSON body | 202 |
| `{published}.weekendmvp.app` | `/__lead` POST with an `email` field | **422**, refused |
| `{unpublished}.weekendmvp.app` | `/` | **404**, bare body |
| `admin.weekendmvp.app` (reserved) | any | **404**, bare body |
| `nosuchtenant.weekendmvp.app` | any | **404**, bare body |
| `evil.com` (pointed at us) | any | **404**, bare body |

Command form:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'host: acme.weekendmvp.app' https://<deployment>/
```

⚠️ **Measure against a production build only.** Under Cache Components,
`next dev` reports different statuses; a WP27 progress entry recorded a 404
that was really a 200 because it was measured against `next dev`.

Additional assertions on a published tenant page:

- [ ] `<link rel="canonical">` points at the tenant host, and the body
      contains **zero** occurrences of `www.weekendmvp.app`
- [ ] `<title>` carries no `| Weekend MVP` suffix
- [ ] No cookie banner, no `googletagmanager`, no `connect.facebook.net`
- [ ] No preview watermark and no "private preview" notice
- [ ] Zero `<form>` tags (lead UI is WP31)
- [ ] No `Set-Cookie` on any tenant or rejected host

---

## 4. Publish, rollback, and takedown

These are Convex mutations, owner-scoped, and safe to run at any time — they
change no DNS.

```
platform/sites/publish:publish    { projectId, slug }        → { hostname, version, created }
platform/sites/publish:rollback   { projectId, toVersion }   → { hostname, version, created }
platform/sites/publish:unpublish  { projectId }              → { changed }
```

Semantics that will surprise you if you skip them:

- **Rollback is forward-only.** It promotes the old *content* as a NEW version
  and retires the current one. `siteVersionTransitions.retired` is terminal.
- **Takedown clears `currentVersionId`; it does not change status.**
  `siteTransitions.published` is terminal in the frozen WP22 state machine, so
  a taken-down site legitimately still reads `status: "published"`. The public
  resolver refuses it because the pointer is gone. This is the mechanism
  WP30's kill switch will use.
- **Republishing unchanged content is a no-op** (`created: false`). There is
  no idempotency-key column; idempotency is structural.

---

## 5. Pre-flight check: does this deployment contain WP28?

Run **before** activating the wildcard. If this returns anything other than
404, the deployment predates WP28 and activating the wildcard would expose
`/dashboard` at every subdomain.

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'host: nosuchtenant.weekendmvp.app' https://<deployment>/dashboard
# MUST be 404. A 200 or a 307 means WP28 is not in this deployment — STOP.
```

---

## 6. Rollback

**Rollback is DNS-first.** The code is safe to leave deployed; the wildcard is
what exposes anything.

1. **Remove the wildcard DNS record** and delete `*.weekendmvp.app` from the
   Vercel project. Tenant hosts stop resolving. Apex and www are unaffected.
2. If the code itself must be reverted, the WP28 range is:

   ```
   git revert --no-commit 346bdce d26cbcb 37869a8 acc2ab9 a97b132 3f3fbd6 2f25a87
   ```

   or reset the branch to its base, `0a13b2b` (the WP27 closeout).

   ⚠️ **Reverting WP28 while a wildcard is still live re-creates the original
   vulnerability**: every tenant and unknown subdomain would again serve the
   marketing site and `/dashboard`. Always do step 1 first.

3. Individual customer sites can be taken down without any deploy or DNS
   change — `platform/sites/publish:unpublish` per project (§4).

**Blast radius:** removing the wildcard affects only tenant sites. The
platform (`www`), the anonymous preview funnel, auth, and billing are all
untouched by WP28 and keep working.

---

## 7. Dry-run execution record

Per the owner ruling, the approved staging host is **Vercel preview
deployments**.

### Executed under WP28 — local production build (`next build` + `next start -p 3100`)

Against real local Convex data, seeded sites `acme`/`brightly`/`lumen`
(published), `draftco`/`noversion`/`retired` (not published):

- ✅ §3 host matrix, all rows, including apex 308, www surfaces, tenant 404s,
  reserved/unknown/multi-label/lookalike hosts, and the `/site/*` internal
  target 404ing on platform hosts
- ✅ Published tenant pages: self-canonical, zero `www.weekendmvp.app`, no
  platform title suffix, no consent/analytics chrome, no preview chrome, zero
  `<form>` tags
- ✅ Lead endpoint: 202 empty body, 422 on three PII shapes, 404 unpublished
  and unknown and platform hosts, 403 cross-origin (including our *own*
  platform origin), 415 non-JSON, 405 GET, 429 after burst
- ✅ `npx convex data leads` — every row `synthetic: true`, no `email` or
  `payload` column present
- ✅ §4 publish / rollback / unpublish, including concurrent publishes and
  concurrent hostname claims (Convex tests)
- ✅ §5 pre-flight check returns 404

Full evidence: `docs/wp/wp28-progress.md`.

### NOT executed under WP28

- ❌ **Deploying the branch to a Vercel preview.** Requires pushing
  `codex/wp28-tenant-hosts` to `origin` and creating a deployment — an
  outward-facing action, and the branch is currently local-only. Owner
  decision, not the package's to take.
- ❌ Every step in §2. WP31 owns DNS, domains, wildcards, and certificates.

The §3 matrix should be re-run against a Vercel preview before WP31 activation
to confirm behaviour behind Vercel's proxy — specifically that
`X-Forwarded-Host` handling matches the local result, since middleware reads
`Host` and Vercel's edge sets both.

---

## 8. Known, accepted, and carried forward

| Item | Status |
|---|---|
| `/_next/static/*` returns 200 on **any** host — the middleware matcher excludes it | Accepted: chunks are already public on `www`, and widening the matcher costs middleware on every asset request for every host. Re-judged at the gate. |
| The publish check adds one uncached backend round trip per tenant request | Accepted for now; revisit if tenant traffic grows |
| Lead rate limiting is keyed per IP, shared across tenants | Harmless while leads are synthetic; WP31 must revisit before real capture |
| `preview_capabilities` retention cron (WP27) | **Still open.** Required before the anonymous free preview is public |
| Real tenant lead capture | WP31, gated on privacy/retention text |
