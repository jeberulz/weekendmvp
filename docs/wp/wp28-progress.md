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
