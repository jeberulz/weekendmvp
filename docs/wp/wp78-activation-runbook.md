# WP78 activation runbook — generated tenant landings

**Owner executes provider, DNS, deploy, and production changes.** This is a preparation and test plan; no wildcard, certificate, Global Config, production publish, or production lead capture has been activated by WP78. It supersedes the WP28 runbook's §2 DNS instructions, which predate Vercel's current wildcard requirements.

## 1. Release prerequisites

- WP78-S1 approval and policy path merged, independent Claude security review passed, WP78-S2 takedown test deployment verified, and G2 prerequisites met. Public `publish` and `rollback` legacy mutations remain fail-closed.
- `ops_settings.workspaceEnabled` and `publish` kill switch remain off until the owner runs the cohort activation.
- The tenant renderer serves only validated `LandingSpec` and refuses archived or taken-down sites. The public host matrix from `wp28-activation-runbook.md` §3 and §5 must pass on a production build of the exact release commit.
- Real lead capture stays synthetic-only until D5's privacy notice, retention, CSV export, per-contact delete and WP79 opt-in hook ship together.
- Record backup, restore marker, exact frontend/backend SHAs, deployment IDs, preflight output and owner approval under `docs/wp/backup-restore.md`. Production Convex is `first-squirrel-244`; the default `--prod` shortcut is known to select the wrong project.

## 2. Global Config emergency denylist

1. Owner creates a dedicated Vercel Global Config and connects it to the intended Vercel project/deployment. The read connection string is `TENANT_GLOBAL_CONFIG` in Vercel. Add the same read connection string to Convex for the takedown action's readback; add optional Convex `TENANT_GLOBAL_CONFIG_ID`, `TENANT_GLOBAL_CONFIG_WRITE_TOKEN` and, for a team resource, `TENANT_GLOBAL_CONFIG_TEAM_ID`. Scope the write token to this resource if Vercel permits. Keep every value out of Git, logs and client bundles. All are optional for deployment; absent values disable tenant serving or takedown.
2. Inventory every existing `site_configs` row with `takedownAt` and any pending denial from a prior failed Convex commit. Insert each `tenant_takedown_{slug}: true` item. Only after the inventory is reconciled, insert `tenant_takedown_ready: true`. This sentinel is an activation marker, never a fallback value. If it is missing, false, malformed or unreadable, middleware hard-404s **all** tenant requests before the Convex publish check.
3. On an isolated test deployment, verify a missing slug key reads as `undefined` and is allowed past the denylist; verify `tenant_takedown_{testSlug}: true` hard-404s both `/` and `/__lead`. Simulate Convex unavailability: the denied host must still hard-404 with no rewrite. Confirm a clear slug retains the established best-effort Convex check.
4. Takedown is a two step operation in one authenticated Convex action: server-verified super admin and target → Global Config upsert and consistent readback → Convex mark/audit. `site.taken_down` is written once. If Global Config write/readback fails, Convex is unchanged and the request fails. If Convex commit fails after the deny upsert, the slug stays blocked and the same action can be retried to finish the audit. Do **not** delete the deny key on a failed commit.
5. Measure from accepted takedown call to a 404 on the test hostname in at least two regions; abort activation if either exceeds one minute. The consistent readback checks origin state; it does not prove every edge has received the update. Record the actual propagation measurement. During a Global Config outage, tenant hosts fail closed; the published-site Convex check remains fail-open only after a successful denylist read.

The action uses the [Global Config read API](https://vercel.com/global-config) and Vercel's [Edge Config item update REST endpoint](https://vercel.com/docs/rest-api). Global Config is the current name for Edge Config; the REST path still uses `edge-config`.

## 3. Wildcard domain and certificate

1. In the owner-controlled Vercel project, add `*.weekendmvp.app` only after §1–2 pass. Preserve the existing apex/www behavior and all current DNS records (including mail records) before changing nameservers.
2. Follow the exact nameserver values Vercel shows for the domain at the registrar and migrate required DNS records. Current Vercel guidance requires the **nameservers method** for wildcard domains because certificates use DNS-01. Do not rely on the old WP28 runbook's generic `cname.vercel-dns.com` record or `_acme-challenge` delegation as a substitute.
3. Wait for the Vercel Domains dashboard to show the wildcard verified and its certificate valid. Copy the project-specific DNS values from that dashboard; do not assume a fixed CNAME target.
4. Publish one approved owner test landing at a dedicated, non-reserved slug through WP78-S1. Confirm HTTPS, exact self-canonical URL, no platform session cookie or marketing shell, and that only `/` and permitted lead path exist. Re-run the WP28 host matrix against a production build and test arbitrary/reserved hosts as bare 404s; reserved slugs must also refuse publishing. A certificate error or any platform route served on a tenant host is an abort.

Vercel's current [wildcard domain guidance](https://vercel.com/docs/domains/working-with-domains/add-a-domain) and [domain troubleshooting](https://vercel.com/docs/domains/troubleshooting) require Vercel nameservers for wildcard certificate issuance.

## 4. Stop and rollback

- Emergency content removal: use the super-admin takedown action and measure the test host's 404. Keep its Global Config deny entry in place. The `publish` kill switch prevents new publishes but does not remove already live sites.
- If the denylist is unavailable, tenant middleware refuses all tenant traffic; investigate Global Config before restoring service. Never bypass its read or change middleware to fail open.
- For a failed wildcard activation, remove the wildcard domain/DNS first, then consider a code rollback. Reverting host-classification code while wildcard traffic still resolves can expose the platform on tenant hosts (WP28 §6).
- Reconcile an extra deny entry from a failed Convex commit by retrying the authenticated takedown action. Do not remove a deny entry without an explicit owner decision and a tested restoration path.
