# WP19 Progress — Idea tagging contract + corpus retag

Branch: `cursor/idea-tagging-contract-2db3`
Status: complete (S1–S3); empty-hub decide + thin-surface publish deferred

## Log

- Chose Work Package lane (shared tagging contract + multi-file corpus rewrite).
- Stories frozen in `docs/wp/wp19-stories.md`.
- **S1 done:** `/publish-idea` skill updated with live allowlists, ≥2 tools/audiences, canonical `buildTime`, tagging gate in Step 7 + publishing checklist. Added `scripts/validate-idea-tags.mjs` + `npm run validate:idea-tags`.
- **S2 done:** `scripts/retag-idea-tags.mjs` applied — 81 buildTimes normalized, 55 audiences[] rewritten (all orphans mapped), 13 tools[] cleaned, `AUDIENCE_NAMES` completed for all 10 hubs. Post-retag: **170/170 pass** `validate:idea-tags`.
- **S3 done:** Explicit overrides for the 10 Aug-12 publishes (buyer/stack fit). Dev Convex reseeded. Hub spot-checks:
  - `/ideas/build-in-weekend` — all 10 now eligible (was 0 of 10); page shows the new slugs
  - `/build-with/no-code` — shopify-seo, small-order-wholesale, workflow-audit
  - `/build-with/v0` — ai-slide-deck-maker
  - `/build-with/lovable` — ai-tutor-matchmaker
  - `/build-with/replit` — healthsync
  - `/build-with/bolt` — course-completion (other bolt-tagged Aug-12 ideas may sit below the byTool builder_confidence cap of 30 — data-correct, display-capped)
  - `/ideas-for/small-business-owners` 9→25 corpus / hub shows retagged SMB ideas
  - `/ideas-for/creators`, `/marketers`, `/non-technical` — retagged Aug-12 ideas present
- Ruling appended to `docs/wp/RULINGS.md`.
- Checks: `npm run validate:idea-tags` 170/170; `npm run typecheck` pass; `npm run seed:convex` (dev) ok.
- Deferred (steps 4–5): fill-or-delete `passive-income` / `quick-wins` / `build-in-1-week`; targeted publish into thin secondary surfaces (`designers` still 11).

## Coverage after retag

| Audience hub | Before → After |
|---|---|
| designers | 11 → 11 |
| freelancers | 13 → 23 |
| creators | 10 → 23 |
| marketers | 18 → 24 |
| small-business-owners | 9 → 25 |
| non-technical | 18 → 36 |
| weekend-builders | 43 → 43 |
| side-hustlers | 35 → 45 |
| developers | 66 → 68 |
| solo-founders | 140 → 151 |

| Build-time hub | Before → After |
|---|---|
| build-in-weekend | ~89 → **170** |
| build-in-8-hours | 25 → 26 |
| build-in-1-week | 0 → 0 (deferred) |
