# WP43 Progress - Ideas-first dashboard (free and paid)

Append-only progress log. Do not rely on chat history for project state.

## 2026-09-24 - Setup

- Branch/worktree: `claude/wizardly-rubin-a6m2th` (no worktree)
- Assignment: deep dive on what `/dashboard` should be after the ideas-first direction (WP42), for free and paid members. Write a PRD and a build plan. No product code in this step
- File boundaries: `docs/wp/wp43-*`, `docs/PROJECT_STRATEGY.md` (registry row)
- Required checks: `git diff --check`
- Initial risks:
  - Paid plan name, price and limits are not ruled. PRD section 12 lists them
  - The IdeaBrowser MCP failed to connect and ideabrowser.com is blocked by this session's network policy, so its logged-in pages could not be captured

## 2026-09-24 - Audit and research

- Actions taken:
  - Read the current dashboard (`app/dashboard/**`, `components/platform/shell/*`, `components/platform/explore/*`, `convex/platform/ideas.ts`), `PRODUCT.md`, `docs/wp/platform-ux-brief.md`, `docs/wp/v1-scope-cut.md`, WP41 and WP42 docs and rulings
  - Recorded 13 audit findings (PRD section 2). Two are defects worth fixing even without the redesign: nested `main` on `/dashboard/billing` (A10) and per-page search in Explore (A7)
  - Reviewed about 60 Mobbin screens and flows (home, library, saved, paywall, upgrade, onboarding, mobile). 25 are cited in PRD section 13
  - IdeaBrowser: public sources only (plan tiers and free-plan limits)
- Decisions made (proposals, not rulings):
  - Research stays free. The paid plan sells workflow: collections, prompt packs, unlimited weekend plans, a hosted site
  - Free limit is one active weekend plan. Saves stay unlimited
  - Merge Interested into Saved in the UI, keep both flags in data
  - Park "Bring your own idea" until v1.1 reports ship
- Checks run: `git diff --check`
- Result: PRD and stories written. Mockup built on a shared design canvas at the owner's request: [Weekend MVP Dashboard](https://claude.ai/artifact/SoKxJm9Urpeyo8p9NntLG5) with five artboards (Home for a new member, a free member mid-build, a Builder member, the 390px phone layout, and the upgrade sheet), plus notes for module order, upgrade rules and open rulings. A first static HTML draft was dropped in favour of the canvas so there is one visual source
- Next: owner answers R1 to R8 (story S1), then Phase A starts with S2

## 2026-09-25 - Owner rulings R1 to R4

- Actions taken:
  - Recorded four rows in `docs/wp/RULINGS.md`: Builder's Hub at $29 a month (R1), free limits (R2), Interested merged into Saved on screen (R3), own-idea intake parked (R4)
  - PRD: status line, sections 6.5 and 6.6, wireframes 7.1 to 7.4, FR-22, FR-24, sections 9.3, 9.4, 11 and 12 updated. Stories: S1 status, Phase C gate, S10 plan id, S11 name. Registry row updated
  - Canvas: plan name and the $29 price on the free, Builder's Hub and upgrade sheet artboards. Canvas notes updated
- Decisions made:
  - The plan id in code is `builders_hub`. The credit pack catalog already uses the id `builder` for its $79 pack, so the subscription cannot share it
- Found:
  - Credit pack display names clash with the new plan and the Starter Kit: "Starter" ($29, 25 credits), "Builder" ($79, 75 credits), "Studio" ($199, 220 credits). Added as R9 with a recommendation to show packs by size
  - R5 matters more now: the 25-credit pack that publishes one page and a month of Builder's Hub both cost $29
- Checks run: `git diff --check`
- Next: owner answers R5 to R9 and sets the annual price. Phase A can start with S2 (shell and navigation), which R3 and R4 unblock
