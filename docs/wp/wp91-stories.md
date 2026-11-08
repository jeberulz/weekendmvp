# WP91 Stories — Roster per idea (idea-driven crew hiring and varied lead names)

Branch: `claude/roster-per-idea-plan`
Lane: Work Package
Plan: `docs/wp/roster-per-idea/PLAN.md` (John's Q1–Q6 decisions, 2026-11-07)
Definition of done: the idea decides the optional crew (the blueprint proposes it, code keeps the guardrails
and falls back to the rules); the chat lead uses the name the founder chose; each wizard session suggests its
own lead names; the UI says which roles are core and which the lead chose; fixture runs give different ideas
different teams at zero AI spend. Typecheck, tests, prompt lock and build green. No live AI spend, no image
spend, no deploy.

## Stories

- [x] `WP91-S1` — The chat lead uses the founder's name
  - `wrenShared.ts` no longer says "You are Wren"; it reads `partner.name` from the business context.
    `wren-chat@4`, `wren-plan-turn@4` (the @3 entries are retired in the lock).
  - Acceptance: a business whose lead is Juno gets "I am Juno, your Crew Lead"; the rules never name Wren.
- [x] `WP91-S2` — Lead-name suggestions per wizard session
  - `LEAD_NAME_POOL` (24 names), `leadNameSuggestions(sessionId)` (FNV-1a, no clock or randomness), first
    suggestion preselected; presets stored as `preset`, other names as `custom`.
  - Acceptance: two sessions get different suggestions; a reload keeps the same three; a11y via axe.
- [ ] `WP91-S2b` — About 6 lead avatars (Recraft, one-time image spend). **Waiting for John's OK on count
  and cost.** Not started.
- [x] `WP91-S3` — Contracts and `planRoster` guardrails
  - `CORE_ROLE_KEYS` = lead, brand, email, social. Optional `team` on the blueprint; `cleanTeamProposal`
    drops bad entries (core or unknown role, duplicates, long or multi-line reasons, links, invented proof,
    own-idea market numbers). Order in `planRoster`: forced (paid push → Ads, course → Curriculum), then the
    lead's proposal (`decidedBy: "lead"`), then the old rule. Rules version `2026-11-08.1` (`2026-11-05.1` and `2026-11-07.1` are legacy).
  - Acceptance: a bad reason never blocks the blueprint or the roster; core roles can't be skipped.
- [x] `WP91-S4` — Blueprint prompts v3 and per-idea fixtures
  - `crew-blueprint-personalise@3`, `crew-blueprint-own-idea@3` (WP90's v2 text plus the team rules in
    `teamShared.ts`, team-required output schema). `crew-brand-kit`, `crew-email-sequence`, `crew-social-pack`
    bumped to @3 and `crew-idea-seed` to @2 because the contracts they import changed (text unchanged).
  - Fixture client: five team profiles picked by keyword from the idea's own words (default consumer app).
  - Acceptance: locally an AI receptionist hires Outbound, a course hires Curriculum and Community.
- [x] `WP91-S5` — UI copy
  - Meet your co-founder: Core / "{lead} chose" / Added; "{lead} skipped". Why this team?: "Hired · core",
    "Hired · {lead} chose", "Hired · added", "Skipped". Employee pages already say "Why {lead} hired …".
  - Acceptance: a11y-check pass; axe passes on the new case.
- [ ] `WP91-S6` — Live smoke test of 3–5 ideas. **Gate: needs John's OK for live spend.** Not started.

## Out of scope

- Codex gaps (not edited here): G1 `crew_members.hiredBy` gains `"lead"` (a lead-chosen hire is stored as
  `"rule"` today, with `decidedBy: "lead"` in the plan JSON); G2 a `suggested` partner-name kind.
- A hire cap (Q5: none).
- Hiring a skipped role later ("coming soon").
