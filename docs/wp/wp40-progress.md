# WP40 Progress - Publish 10 ideas into thin categories

Append-only progress log. Do not rely on chat history for project state.

## 2026-09-10 - Setup

- Branch/worktree: `codex/wp40-underrepresented-ideas` (no worktree)
- Assignment: Mode A publish of 10 unpublished Ideabrowser ideas into the 14–16 count categories
- File boundaries: `content/ideas/{slug}.mdx` × 10, `ideas/manifest.json`, this progress file
- Required checks: section gate, `npm run validate:idea-tags`, `npm run seed:convex` (dev+prod), `npm run og:generate`
- Initial risks: thin MCP competitive_analysis (WP39 already burned one ID); duplicate concepts vs existing corpus

## Selected ideas

| ID | Slug | Category | Title |
|---|---|---|---|
| 7720 | phone-neck-score-app | health | Gamified posture tracking app for phone-addicted Gen Z |
| 8546 | timed-tool-access-contractors | developer-tools | Timed tool access that clocks out when the contract does (SWAPPED from 8126 — STOP: no public competitor pricing) |
| 8816 | contractor-ai-receptionist | automation | AI receptionist so solo contractors never ghost a customer |
| 8918 | ai-site-design-blueprints | ai-tools | Site design blueprints for agencies building with AI |
| 7279 | ai-fashion-lookbook-studio | ecommerce | AI lookbook studio for indie fashion brands |
| 8061 | ai-top-three-task-widget | productivity | Widget that picks your top 3 tasks each morning |
| 9189 | music-royalty-recovery-heirs | fintech | Music royalty recovery platform for musicians' families |
| 7874 | marketplace-meetup-safety | marketplace | Safe meetup tracker for marketplace sellers |
| 9266 | contractor-lead-refund-automation | b2b | Automatic lead refunds for home service contractors |
| 9334 | course-translation-resale-network | education | Global sales & translation network for online course creators |

## 2026-09-10 - MDX + manifest

- 10 MDX files written Mode A; mechanical gate pass (8 H2s, How-it-works, Your Opportunity, 4 prompt blocks, 2299–2614 words, 0 bare `<`/`{`)
- Manifest prepended with provenance/scores/og; `npm run validate:idea-tags` → 225/225 pass

## 2026-09-10 - Seed + OG

- `npm run seed:convex -- --only ideas` → **dev** inserted 10
- `npm run seed:convex -- --deployment first-squirrel-244 --only ideas` → **live** inserted 10
- `og:generate` Recraft for all 10; `og.status=ready`; PNGs under `public/image/og/idea/`
- Pages are **not live** until this branch merges to `main` (same as WP39). Grid cards exist in production Convex; `/ideas/{slug}` 404 until Vercel build.
