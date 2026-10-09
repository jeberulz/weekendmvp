# WP65 Stories — Owner-authorized preliminary idea publication

Branch: `codex/wp65-manual-thin-ideas`
Lane: Work Package
Definition of done: four editable concept pages are accurately labelled, tags/prompts/MDX and configured checks pass, and the exact production publication and catalogue seed are verified or a concrete external blocker is reported.

- [x] S1 — Author four preliminary concepts from the existing briefs
  - Scope: four idea MDX files, four manifest rows, generated slug list, package docs.
  - Acceptance: the original thin categories and wedges are retained; no fabricated research, quotes, scores or passing-audit claim. Eight sections and four standard build prompts per page.
  - Verification: prompt/tag lint, MDX compilation, duplicate check, configured project checks.
- [x] S2 — Publish the exact content batch
  - Scope: content-only commit/PR/merge and production deployment; exact-slug catalogue seeds on `first-squirrel-244` after page availability, with backup/dry-run inventory.
  - Acceptance: public URLs respond with the expected titles and concept qualification; four catalogue rows appear. No unrelated root work or engine repair ships.

Out of scope: engine approval/record fabrication, release flag changes, billing activation, unrelated content/dependency changes, bulk reseeding.

Completed 2026-10-09 through PR #132. Production pages and the four category links return 200; four exact-slug catalogue inserts are verified. Publication evidence is in `wp65-progress.md`. This documentation closeout uses `codex/wp65-publication-closeout`.

- [ ] S3 — Complete the four missing individual OG cards
  - Follow-up branch: `codex/wp65-og-cards`; lane: Work Package, existing WP65 scope.
  - Scope: four generated PNG assets, exact manifest OG status changes and package records; preserve the preliminary text and all other catalogue metadata.
  - Acceptance: the existing branded OG generator creates a distinct image per idea; each image is visually checked; the deployed page's Open Graph and Twitter metadata reference its own healthy image URL; discovery cards receive ready status.
  - Verification: dimensions/image inspection, tags, configured checks/PR CI, exact production deployment and bounded metadata update with backup/dry run.
