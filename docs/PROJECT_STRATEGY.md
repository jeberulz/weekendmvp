# Project Strategy

This registry tracks reserved, active, and completed Weekend MVP work packages. Individual story and progress files remain the detailed status source for historical packages; `docs/wp/program-manifest.md` controls the Build Platform program.

## Existing Work Packages

| WP | Title | Lane | Branch | Status | Definition of done |
|---|---|---|---|---|---|
| WP01 | Social video link hub | Work Package | `feat/wp01-links-hub` | Complete | `/links` serves the current campaign destination and passes configured checks. |
| WP02 | Released ideas archive | Work Package | `feat/wp02-links-archive` | Gate pending | Searchable, filterable, future-safe released-ideas archive passes visual and configured gates. |
| WP03 | Five AEO/SEO articles | Work Package | `cursor/publish-5-articles-aeo-seo-f2aa` | Complete | Five researched MDX articles are seeded, illustrated, linked, and verified. |
| WP04 | Five programmatic SEO hubs | Work Package | `cursor/publish-5-programmatic-hubs-8e5e` | PR ready | Five audience/problem hubs, tags, links, and checks are complete; production seed remains owner-side. |
| WP05 | Five automation ideas | Work Package | `content/automation-ideas-batch-5` | Complete — live | Five automation idea pages, records, and OG assets are live. |
| WP06 | Marketplace and B2B idea batch | Work Package | `content/marketplace-b2b-batch-10` | Complete — live | Ten marketplace/B2B ideas are published and return 200. |
| WP07 | About and author pages | Work Package | `feat/about-author-pages` | Complete; merge pending in log | `/about` and canonical person page, structured data, links, and sitemap are verified. |
| WP08 | Five thin-category ideas | Work Package | See progress log | Ready to deploy | MDX, manifest, Convex seeds, and OG assets are complete; commit/push remains. |
| WP09 | Five automation and AI-tool ideas | Work Package | See progress log | Seeded; OG/PR pending | Five ideas are researched and seeded; OG/PR/deploy closeout remains. |
| WP10 | Host canonicalization | Work Package | `fix/wp10-host-canonicalization` | Infra live; code closeout pending | Canonical www host, apex redirect, sitemap/robots, and internal emitters are consistent. |
| WP11 | Convex database I/O audit and safe fixes | Work Package | `cursor/deploy-wp11-convex-perf-d2d5` | Vercel live; Convex deploy pending | Indexed/bounded reads are live in web code; production Convex functions require owner deploy. |
| WP12 | Reserved / no package | — | — | Unused | Identifier is intentionally recorded as unused; no WP12 story/progress files exist. |
| WP13 | One-hop redirect chains | Work Package | See progress log | Complete — live | Host and dirty-path canonicalization resolve in one permanent hop. |
| WP14 | GSC www URL-prefix property | Work Package | See progress log | Complete | The www URL-prefix property is verified and sitemap submitted through the API. |
| WP15 | Build-with growth push | Work Package | `cursor/wp15-build-with-growth` | Complete; live smoke pending | Build-with hub copy, featured rails, Claude Code hub, and navigation changes pass checks. |
| WP16 | Bolt and Windsurf hub enrichment | Work Package | `cursor/wp16-bolt-windsurf-enrichment` | Complete | Both hubs have improved search copy and featured idea rails. |
| WP17 | Sitemap indexing signals | Work Package | `cursor/wp17-sitemap-indexing` | Complete — merged (#42) | Stable idea lastmod, apex system-file redirects, and indexing runbook/check script are present. |
| WP18 | Five research-backed startup ideas | Work Package | `feat/publish-five-ideas` | Complete — merged (#44) | Five pages pass research/section gates, are seeded, and have OG assets live on `main`. |
| WP39 | Starter Kit feedback and effectiveness insights | Work Package | `codex/wp39-starter-kit-feedback` | PR ready — production secret provisioning pending | Starter Kit visitors can submit anonymous-by-default, abuse-bounded feedback and the operator can retrieve a bounded effectiveness summary without exposing responses publicly. |

## Build Platform Program

**Consolidation:** `codex/wp28-tenant-hosts` is the integration tip for Waves 0–3 platform work (WP19–28). Draft PR targets `main`. Revised v1 launch scope: `docs/wp/v1-scope-cut.md` (2026-08-12).

| WP | Title | Wave | Branch | Status | Definition of done |
|---|---|---|---|---|---|
| WP19 | Program freeze and recovery inventory | 0 | `codex/platform-wave0-manifest` | Complete — Wave 0 passed | Audits, rulings, UX brief, manifest, registry, session ledger, gate report, and restore plan pass independent review and are committed. |
| WP20 | Dependency, security, CI, test baseline, and read-only migration preflight | 1 | `codex/wp20-security-baseline` | Complete — Wave 1 passed | Both audits are clean; CI/lint/security/a11y gates run; routing regressions are covered; auth/environment inventory is complete. |
| WP21 | Convex Auth compatibility migration | 2 | `codex/wp21-convex-auth` | Development complete — Google/go-live activation deferred | Compatibility foundation and credential-backed Resend flow are green. Deterministic Google contracts pass; real Google E2E plus backup, dry run, production secrets, independent review, and approval remain go-live gates. |
| WP22 | Platform schema, state, and authorization | 2 | `codex/wp22-platform-contracts` | Complete — contract gate plus additive index amendment passed | Additive indexed contracts and two-user ownership/state-machine tests are frozen; WP23's exact active source-project lookup amendment passed independent review. |
| WP23 | Signed-in shell, dashboard, Explore, and intent | 2 | `codex/wp23-platform-explore` | Complete — code gate plus authenticated browser/a11y gate passed 2026-08-06 | Shell/dashboard/Explore and owner-scoped intent pass independent code review; safe signed-in desktop/mobile visual, keyboard, focus, and a11y evidence gathered live and recorded in `docs/wp/wp23-progress.md`. |
| WP24 | Credits and Stripe | 2 | `codex/wp24-credits-stripe` | Complete — test-mode code gate passed; activation pending | Exact-once Checkout/ledger/full-refund/dispute-created paths and legacy separation pass independent review. Credential-backed E2E plus partial-refund/dispute-resolution owner policy remain live blockers. |
| WP25 | Intake, briefs, projects, and public idea bridge | 2 | `codex/wp25-intake-projects` | Complete — code gate plus authenticated browser/a11y gate passed 2026-08-06 | Repository/own-idea intake, versioned briefs/projects, and public CTA pass code review; safe signed-in desktop/mobile autosave/conflict/focus/a11y evidence gathered live and recorded in `docs/wp/wp25-progress.md`. |
| WP26 | Durable workflow and Validation Reports | 3 | `codex/wp26-research-workflow` (integrated in consolidation branch) | `S1` complete 2026-08-06; `S2`–`S6` **deferred to v1.1** per `docs/wp/v1-scope-cut.md` | Contract subgate passed; full workflow/reports not required for repository-only v1.0. |
| WP27 | Structured renderer and isolated preview | 3 | `codex/wp27-site-preview` → `codex/wp28-tenant-hosts` | **Complete** — package gate passed 2026-08-06 | Preview is capability-scoped, expiring, non-indexable; `/build` and claim flow verified. Retention cron still required before public preview at scale. |
| WP28 | Tenant publish code, host routing, versions, leads, and runbook | 3 | `codex/wp28-tenant-hosts` | **Complete** — package gate passed 2026-08-07; **consolidation PR open** | Host matrix, publish/rollback, synthetic leads, activation runbook; no live wildcard until WP31. |
| WP29 | Project cockpit, revisions, and task refunds | 3 | `codex/wp29-project-cockpit` | **Next** — v1.0 minimum slice per scope cut | Cockpit + publish UX for repository path; full revision/refund UX deferred to v1.1. |
| WP30 | Trust, safety, abuse controls, and observability | 3 | `codex/wp30-trust-safety` | Pending WP29-min; owner rulings open | v1.0 minimum: manual policy gate, kill switch, rate limits; full classifier corpus deferred. |
| WP38 | Super Admin and Operator Control Plane foundation | 3 | `codex/wp38-admin-plan` | Planned — v1.0 minimum slice parallel with WP29 | Bootstrap super-admin, audit, activation/rollback; full editorial/compiler UI deferred to Wave 5. |
| WP31 | Production activation, launch surface, and analytics | 4 | `codex/wp31-platform-launch` | Pending WP29-min + WP30-min + WP38-min | Owner-approved live payment, wildcard, rollback, stranger journey; see revised scope cut for launch bar. |
| WP32 | Signal ingestion and idea generation/scoring | 5 | `codex/wp32-idea-engine` | Pending WP26 contract + WP38 | Provenanced signals produce deduplicated, scored candidates in a super-admin-only review queue; no automatic publication exists. |
| WP33 | Owned idea-page compiler | 5 | `codex/wp33-idea-compiler` | Pending WP32 + WP38 | Engine-to-idea output meets fixed-corpus quality and a super-admin-only staged preview, approval, deploy-health-check, activation, audit, and rollback gate. |
| WP34 | Owned article compiler | 5 | `codex/wp34-article-compiler` | Pending WP32 + WP38 | Engine-backed article research meets provenance/SEO gates and a super-admin-only branch-first approval and activation gate. |
| WP35 | Owned programmatic compiler | 5 | `codex/wp35-programmatic-compiler` | Pending WP32 + WP38 | Engine taxonomy/keyword evidence meets provenance/build gates and requires audited super-admin approval before activation. |
| WP36 | Owned newsletter compiler | 5 | `codex/wp36-newsletter-compiler` | Pending WP32 + WP38 | Newsletter selects current engine signals and requires audited super-admin approval before any external send. |
| WP37 | Ideabrowser backlog and retirement | 5 | `codex/wp37-ideabrowser-offboarding` | Pending WP32-WP36 | Backlog is zero, all replacement gates pass, engine-only daily cycle works, defaults flip, and live credentials/config are retired by 2026-09-05. |

## Program Sequencing Rules

- **Consolidation first:** merge `codex/wp28-tenant-hosts` to `main` as one unit before opening new platform feature branches off `main`.
- WP20 is the implementation entry gate. No auth or dashboard merge starts while the production dependency audit remains red.
- WP23, WP24, and WP25 may proceed in parallel only after WP22 freezes schema/authz contracts and the orchestrator serializes shared-file changes.
- WP27 may begin only after WP26's named report/site-input contract subgate. WP28 owns host-routing code and the activation runbook; WP31 alone owns live wildcard/domain/payment activation.
- **v1.0 critical path (2026-08-12 scope cut):** WP29-min → WP30-min → WP38-min → WP31. WP26 S2–S6 is **not** on the v1.0 path (repository ideas only).
- WP38-min gates WP31 production activation. Full WP38 editorial/compiler surfaces remain required for Wave 5 (WP32–WP36).
- WP33-WP36 may proceed in parallel after WP32 freezes the engine record/eval API and WP38's admin seam is available. WP37 alone owns MCP configs and the final default/credential switch.
- The detailed risk, file boundaries, owner rulings, and gates in `docs/wp/program-manifest.md` are binding unless the owner adopts `docs/wp/v1-scope-cut.md` via a ruling.
