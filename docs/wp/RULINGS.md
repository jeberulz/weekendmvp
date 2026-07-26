# Rulings

Append-only owner/orchestrator decisions for questions not settled by project docs.

| Date | Scope | Question | Ruling | Decider |
|---|---|---|---|---|
| 2026-07-22 | WP04 | Which 5 programmatic hubs next given full original inventory? | Publish audiences `freelancers`, `creators`, `small-business-owners` and problems `lead-generation`, `content-creation`. Highest SEO/AEO fit to Weekend MVP (AI weekend MVPs for indie builders) with enough taggable ideas; skip new tools (all AI builders covered) and new categories (already complete). | Orchestrator |
| 2026-07-22 | WP04 | Parallelize how? | Manifest tagging stays with orchestrator. Parallel workers: (1) audience route file only, (2) problem route file only. No worktrees — shared-file conflict avoided by file boundaries. | Orchestrator |
| 2026-07-25 | WP07 | About vs author URL model? | Split: `/about` (product) + `/john-iseghohi` (Person entity). Person `@id`/`url` = first-party author page; Cal only in sameAs + CTAs. | Owner |
| 2026-07-26 | WP10 | Apex vs www canonical host? | Canonical host is `https://www.weekendmvp.app`. Apex `weekendmvp.app` must 308 to www. Overrides cutover runbook note that said www→apex — live Vercel primary is already www. | Orchestrator |
