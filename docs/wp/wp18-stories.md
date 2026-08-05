# WP18 Stories - Weekly validation digest

Branch: `cursor/weekly-validation-digest-fde5`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Weekend MVP emits a consistent idea-to-revenue event funnel, generates a thresholded weekly GA4 comparison report, emails it to the configured owner address, and requires validation metadata for newly published ideas.

## Stories

- [x] `WP18-S1` - Funnel event contract
  - Scope: shared analytics helper and existing idea, hub, newsletter, checkout, and purchase client islands.
  - Acceptance criteria:
    - Prompt copies emit `idea_prompt_copied`.
    - Starter-kit clicks emit `starter_kit_clicked`.
    - Successful newsletter enrollments emit `newsletter_subscribed`.
    - Checkout intent and return-page purchase confirmation emit `checkout_started` and `purchase_completed`.
    - Events include stable context such as `idea_slug`, `source_surface`, `source_path`, and `cta_id` where applicable.
    - Existing GA4 ecommerce events and consent gating remain intact.

- [x] `WP18-S2` - Validation metadata contract
  - Scope: idea manifest/Convex schema/seed path and `/publish-idea`.
  - Acceptance criteria:
    - Ideas may carry `validation.audience`, `validation.hypothesis`, and `validation.primaryAction`.
    - The seed path preserves and validates the object.
    - New Mode A and Mode B publishes must author the object before publishing.
    - Existing ideas remain valid without a speculative metadata backfill.

- [x] `WP18-S3` - Weekly GA4 report
  - Scope: pure report module, CLI, package script, and tests.
  - Acceptance criteria:
    - Compare seven complete UTC days, ending after a two-day GA4 processing lag, with the preceding 28 complete days.
    - Normalize baseline volume to a seven-day equivalent.
    - Require at least 25 current views and 100 baseline views before page-level signals.
    - Flag at least 25% relative volume movement or two percentage points of conversion movement.
    - Write deterministic Markdown and HTML-ready output.

- [x] `WP18-S4` - Scheduled email delivery
  - Scope: Resend transport, GitHub Actions schedule/manual dispatch, and operator runbook.
  - Acceptance criteria:
    - Weekly workflow generates and uploads the report artifact.
    - The same report is emailed to `VALIDATION_REPORT_EMAIL_TO`.
    - Missing/invalid GA4 or email credentials fail clearly rather than claiming delivery.
    - No email address or API credential is committed.

## Out Of Scope

- Customer identity stitching or user-level behavioral profiles
- AI-written recommendations
- Daily alerts
- Automatic backlog, issue, or work-package creation
- Historical hypothesis backfill for existing ideas
