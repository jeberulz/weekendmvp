# Platform UX Brief

> **2026-08-14 — signed-in home, chrome, and Library are superseded.**
> Do not implement the Hilos dual-rail, dashboard-as-command-center, Saved/Interested-as-nav, home composer, or Explore `All` / `For you` / `Saved` / `Interested` / `Building` from this brief.
> Home: [`docs/design/signed-in-home.md`](../design/signed-in-home.md). Library: [`docs/design/signed-in-library.md`](../design/signed-in-library.md).
> Still in force here: public `/ideas/{slug}` as the sole canonical research page, preview isolation, billing/publish gates, `noindex` on private routes, super-admin as a separate plane.
> Preview customisation and the publish packet are **not** decided by those freezes.

Approved product and interaction contract for the signed-in Weekend MVP build platform. This brief translates the reviewed Hilos and IdeaBrowser patterns into Weekend MVP's own UX; it is not a visual clone. The signed-in **home/shell** sections below are historical for WP23; they are not the build spec.

## Product Promise

Weekend MVP is validation-first: people discover evidence-backed ideas, see a concrete landing-page preview, and only then decide whether to publish and keep building. The public content library remains the acquisition and SEO layer. The signed-in product adds personal state, project state, generated artifacts, billing, and an operating workspace.

The activation path **as shipped in WP23** is:

`Explore -> Research -> Save or mark Interested -> Preview -> Customise -> Publish -> Project`

The **accepted 2026-08-14 home job** is: public idea → preview → last explicit keep → signed-in Day 1 canvas → confirm → publish. Save/Interested are not destinations on home.

The **accepted 2026-08-14 Library job** is: this isn’t the one; pick another from the same public corpus; preview; leave. One picker, no Explore tabs. See `docs/design/signed-in-library.md`.

For a repository idea, the free artifact is the landing-page preview. For a customer's own idea, the first free artifact is the Validation Report after signup.

## Information Architecture

### Public layer

- `/startup-ideas`: crawlable discovery library.
- `/ideas/{slug}`: the sole canonical, shareable research page for a published idea.
- `/build`: platform marketing and example builds.
- `/pricing`: prices in dollars, not internal credits.
- `/build/{slug}`: anonymous preview setup for a repository idea.
- `/preview/{token}`: expiring, watermarked, non-indexable preview.

### Signed-in layer

- `/dashboard`: at-a-glance home with active projects, recent artifacts, credit balance, and next actions.
- `/dashboard/explore`: **historical WP23.** Signed-in Library is `docs/design/signed-in-library.md` — one picker over the public corpus, Preview primary, no destination views.
- `/dashboard/new`: bring-your-own-idea intake.
- `/dashboard/projects/{projectId}`: project cockpit with status, tasks, artifacts, website, leads, credits, and revisions.
- `/dashboard/projects/{projectId}/research`: the persisted Validation Report.
- `/dashboard/billing`: balance, packs, purchases, refunds, and customer portal.

### Super-admin layer

The operator control plane is a separate private surface, not an elevated mode
inside the customer dashboard:

- `/admin`: verified operational totals, task/provider health, policy queues,
  reconciliation warnings, and explicit next actions.
- `/admin/users`: bounded account metadata, status, projects, purchases, and
  credit-ledger history; no default private brief/report body access.
- `/admin/projects`: project/site/task lifecycle, policy state, controlled
  suspend/unpublish/retry actions, and audit history.
- `/admin/billing`: server-verified purchases, grants, full refunds, disputes,
  and reconciliation failures; no direct balance editing.
- `/admin/engine`: M1/M2 signals, candidates, scores, provenance, cost, engine
  configuration, and approval/rejection. Customers never access this route.
- `/admin/content/{ideas|articles|programmatic|newsletter}`: compiler drafts,
  quality evidence, preview/deployment state, explicit approval, activation,
  rollback, and publication history.
- `/admin/audit`: immutable privileged-action history with actor, reason,
  target, timestamp, idempotency key, and outcome.

Every route and Convex operation re-verifies `super_admin` server-side. Hidden
navigation is not authorization. The initial owner account is bootstrapped from
deployment-only configuration and bound to its verified auth user ID; the
bootstrap email is not stored in Git or checked in client code. Admin routes are
`noindex`, private/no-store, and excluded from sitemaps.

The editorial release journey is:

`Candidate -> Approve research -> Draft -> Quality gate -> Admin review -> Branch/preview -> Publish approval -> Deploy/health check -> Activate -> Audit/rollback`

No engine candidate or compiler draft publishes automatically. Customers can
request bounded research/site work for owned projects but cannot see engine
signals, editorial candidates, prompts/providers, canonical drafts, or release
controls. Super-admin does not grant impersonation, generic cross-owner reads,
direct ledger edits, or hard deletion.

Private platform routes, checkout returns, and previews are `noindex` and excluded from the sitemap. Published customer sites have tenant-aware self-canonicals. They must never reuse the fixed `www.weekendmvp.app` metadata helper.

## Desktop Shell

**Superseded for signed-in home/chrome** by `docs/design/signed-in-home.md` (one top bar, current object in the middle, Library + Account as exits). The ASCII below is the WP23 Hilos costume. Do not rebuild it.

The shell uses a narrow product rail plus a contextual sidebar, inspired by Hilos' calm workspace model:

```text
+------+----------------------+-----------------------------------------------+
| WMVP | Weekend MVP          | Search / command             Credits   User  |
|      |----------------------|-----------------------------------------------|
| Home | Workspace            |                                               |
| Ideas|  Overview            |  Good morning                                |
| Build|  Explore ideas       |  What should move forward today?             |
| Docs |  Saved               |                                               |
|      |  Projects            |  +---------------+  +---------------+        |
|      |  Billing             |  | Active builds |  | Ready to act  |        |
|      |                      |  |       2       |  |       4       |        |
|      | Recent projects      |  +---------------+  +---------------+        |
|      |  Acme validation     |                                               |
|      |  Tutor landing page  |  Recent artifacts / project status timeline  |
|      |                      |                                               |
|      |                      |  Ask Weekend MVP...                   Send    |
+------+----------------------+-----------------------------------------------+
```

The persistent composer is contextual help and a shortcut into supported actions. It is not an unbounded autonomous agent. Suggestions must map to explicit, auditable workflows.

## Explore And Research

**Superseded for signed-in Library** by `docs/design/signed-in-library.md`. The bullets below are the WP23 Explore costume. Do not rebuild All / For you / Saved / Interested / Building, or Save/Interested as card actions.

Explore is an authenticated workspace over the same idea records that power the public library. It adds pagination, recommendations, intent state, and project state; it does not fork or duplicate the underlying research.

- `Saved` and `Interested` are independent user intent flags.
- `Building` is derived from the existence of an active project and cannot be set directly.
- Cards lead to the canonical public research page when the user wants the shareable report.
- The primary activation action promises the next artifact: `Preview this idea`.
- A repository idea carries its immutable source slug and a versioned research snapshot into the project brief.

## Preview, Signup, And Publish

1. A visitor selects `Preview this idea` from a public idea or signed-in Explore view.
2. They answer a short, idea-prefilled customisation step.
3. The system generates an expiring, watermarked preview without requiring payment or signup.
4. Signup is required to keep the preview and turn it into a project.
5. Checkout is required to publish the site.
6. Server-confirmed payment and policy checks unlock the publish operation.
7. The user lands in the project cockpit with the live URL, tasks, report, leads, revisions, and remaining balance.

The preview is a rendered artifact, not a public tenant site: it cannot capture production leads, appear in search, or claim a published hostname.

## Responsive And Accessibility Contract

- On mobile, the product rail becomes bottom navigation and the contextual sidebar becomes a focus-trapped sheet.
- Every screen has one semantic `main`; navigation regions are labelled.
- Keyboard focus is persistent and visible; status is never communicated by colour alone.
- Async task, refund, and publish changes announce through an appropriate live region without stealing focus.
- Forms expose labelled fields, inline error relationships, resumable state, and review-before-submit.
- Motion respects `prefers-reduced-motion`; WCAG 2.1 AA contrast is the minimum gate.
- Automated accessibility tooling must be added in WP20 because the previously referenced `a11y-check` skill is not installed.

## Analytics Contract

Client events remain consent-gated and contain no email, brief text, research text, or other PII. Money, credits, publish, and refund outcomes are emitted only after server confirmation.

Required funnel events:

- `idea_preview_clicked`
- `explore_state_changed`
- `preview_started`
- `preview_generated`
- `preview_viewed`
- `signup_completed`
- `checkout_started`
- `checkout_completed`
- `project_created`
- `report_viewed`
- `site_published`
- `revision_requested`
- `task_completed`
- `task_failed`
- `task_refunded`

## Explicitly Deferred

Tier 2 application scaffolds, code export, custom domains, subscriptions, autonomous night shifts, outbound email, ads, social publishing, teams, affiliate/referral systems, a public live-activity feed, staff roles, customer impersonation, and unrestricted support access are not part of v1. WP38 provides one `super_admin`; subscription administration arrives only with the later Builder subscription product.
