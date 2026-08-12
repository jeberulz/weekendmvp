# Build Platform v1 Scope Cut

**Status:** Owner-facing scope revision (2026-08-12)  
**Supersedes:** The 2026-08-16 launch target in `docs/wp/program-manifest.md` for scheduling purposes only. Security, ownership, payment, preview-isolation, restore, and super-admin gates remain binding.  
**Consolidation branch:** `codex/wp28-tenant-hosts` → `main` (draft PR)  
**Lane:** Program/Migration orchestration doc — not a worker re-scope by itself. Workers still follow `docs/wp/program-manifest.md` until the owner records rulings that adopt this cut.

## Why this exists

The platform program reached a **preview + tenant-publish shell** (WP21–25, WP27–28) while the **workflow engine** (WP26 S2–S6) and **operations layer** (WP29–31, WP38) stalled. The original v1 date is not achievable without either dropping scope or accepting unacceptable gate waivers.

This document defines **v1.0 Repository Launch**: one complete stranger journey using **published repository ideas only**.

## v1.0 — IN (ship)

### User journey (must work end-to-end on production)

```text
/ideas/{slug}  →  Preview this idea  →  /build/{slug}
  →  anonymous preview (/preview/{token})
  →  sign up / sign in  →  claim preview into project
  →  buy credits (live Stripe)  →  policy gate  →  publish
  →  {project}.weekendmvp.app live  →  owner sees project + URL in dashboard
```

### Already built on `codex/wp28-tenant-hosts` (merge as one unit)

| Area | Packages | Notes |
|---|---|---|
| Auth (dev-complete) | WP21 | Resend magic link proven locally; **Google OAuth E2E required before go-live** |
| Schema + authz | WP22 | Frozen 16-table contract + `preview_capabilities` additive table |
| Signed-in shell | WP23 | Dashboard, Explore, Saved/Interested |
| Credits (test mode) | WP24 | **Live Stripe activation is a WP31 gate**, not waived |
| Intake + CTA | WP25 | Own-idea intake code ships; **own-idea journey is not v1.0** |
| Preview renderer | WP27 | `/build`, `/preview`, claim flow — package gate passed 2026-08-06 |
| Tenant code | WP28 | Host routing, publish/rollback, synthetic leads — package gate passed 2026-08-07 |

### Still required before production (minimum slices)

| WP | v1.0 minimum | Full manifest scope deferred |
|---|---|---|
| **WP29** | Project cockpit: status, publish action, tenant URL, credit balance, link back to canonical `/ideas/{slug}` | Revision tasks, artifact browser, refund UX beyond existing ledger |
| **WP30** | Manual policy gate before first publish; project kill switch; publish rate limits; audit event on deny/approve | Full classifier corpus, automated escalation playbooks, retention policy automation |
| **WP38** | Bootstrap one `super_admin`; immutable privileged-action audit; activation/rollback commands; no customer impersonation | Full editorial engine UI, compiler surfaces (WP32–36) |
| **WP31** | Staging activation dry run → owner approval → wildcard DNS + live Stripe smoke → stranger journey on production | Homepage repositioning, case studies, public live-activity counters |
| **Ops** | `preview_capabilities` retention cron; backup/restore markers per `backup-restore.md` | — |

### WP26 for v1.0 — narrowed

**Repository ideas do not need a generated Validation Report.** Public research already lives at `/ideas/{slug}`.

| WP26 story | v1.0 | Rationale |
|---|---|---|
| S1 Contracts | ✅ Done | Already gated |
| S2 Provider adapters | **Defer** | No own-idea report in v1.0 |
| S3 Workflow execution | **Defer** | Publish path is synchronous via WP28 mutations today |
| S4 Cost cap / refund | **Defer** | No metered AI tasks in v1.0 |
| S5 Report compiler | **Defer** | Repository path only |
| S6 Quality evals | **Defer** | No report output to evaluate |

**Re-open WP26 when v1.1 own-idea reports or credit-priced revision tasks ship.**

## v1.0 — OUT (explicit deferrals)

Do not block v1.0 on these; track as v1.1+ unless the owner re-expands scope:

- **Own-idea path** end-to-end (signup → Validation Report → preview → publish)
- **WP26 S2–S6** full workflow and M3 reports
- **Credit-priced revision tasks** and autonomous agent runs
- **Real tenant lead capture** (synthetic-only until retention/privacy ruling)
- **WP32–WP37** Idea Engine and Ideabrowser retirement (Sep 2026 deadline unchanged for Wave 5)
- Homepage replacement with platform-first positioning (additive `/build` marketing only)
- Subscriptions, teams, custom domains, code export, night shifts, ads/outbound automation
- Partial-refund / dispute-resolution Stripe paths beyond current WP24 test contract

## Revised sequencing (post-consolidation)

```text
NOW     Merge codex/wp28-tenant-hosts → main (draft PR, CI green)
        │
PARALLEL├─ WP29-min  project cockpit + publish UX
        ├─ WP38-min  super_admin bootstrap + audit + activation seam
        └─ WP30-min  policy gate + kill switch (needs owner rulings § below)
        │
THEN    WP31        staging dry run → owner approval → production activation
        │
LATER   v1.1        WP26 S2–S6 + own-idea path + revision tasks
        Wave 5      WP32–WP37 on existing manifest schedule
```

**Critical path after merge:** WP29-min → WP30-min → WP38-min → WP31. WP26 is off the v1.0 critical path.

## Owner rulings needed before WP31 (unchanged defaults)

Record in `docs/wp/RULINGS.md` when decided — do not invent:

1. **WP30:** prohibited-content policy, regulated-claims handling, escalation owner
2. **WP31:** platform-first homepage vs additive `/build` launch surface
3. **Tenant leads:** retention period and privacy text (synthetic-only default stands until ruled)

## Gate bar for v1.0 launch (non-negotiable)

- Standard checks green on `main` after merge
- `npm audit --omit=dev --audit-level=high` clean on auth/routing/data paths
- Stranger journey on **staging**, then **production**, with evidence in `wave-gate-report.md`
- Google OAuth E2E + live Stripe smoke (not waived from WP21/WP24)
- Super-admin audit trail for activation and rollback
- WCAG 2.1 AA on new cockpit/policy surfaces
- Canonical `/ideas/{slug}` SEO regression suite passes
- Backup inventory, dry-run, and owner approval per `backup-restore.md`

## Success criteria

A stranger can, without staff intervention:

1. Land on a published idea page on `www.weekendmvp.app`
2. Generate a free preview, sign up, and claim it
3. Purchase credits with a real card
4. Pass policy review and publish to `{project}.weekendmvp.app`
5. See the live URL and project status in the signed-in dashboard

## References

- `docs/wp/program-manifest.md` — binding program contract
- `docs/wp/program-platform-plan.md` — vision and positioning
- `docs/wp/wave-gate-report.md` — gate evidence through WP28
- `docs/PROJECT_STRATEGY.md` — WP registry (updated 2026-08-12)
