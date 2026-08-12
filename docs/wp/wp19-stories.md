# WP19 Stories - Playbooks lead-magnet microsites

Branch: `claude/lead-magnet-ideas-mvp-hhsajy`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: A config-driven `/playbooks/{slug}` engine renders chrome-free framework microsites from a hardcoded TypeScript config, The Decision Stack ships as the first instance with a free server-rendered body plus an email-gated pack, the Beehiiv `playbook` campaign is allowlisted end to end, and sitemap, canonical, JSON-LD, and short-alias routing are wired with the configured checks green.

## Stories

- [x] `WP19-S1` - Playbook section component library
  - Scope: `components/playbooks/`
  - Acceptance criteria:
    - Hero, capture, loop-comparison, layer-stack, fan-out, stat-tile, prompt-file, gated-pack, and CTA components exist and are driven entirely by props
    - All theming reads `tokensFor("cream", "orange")` from `components/marketing/section-theme.ts`; no ad-hoc palettes
    - Every dynamically selected Tailwind class is spelled out in a `tailwind:` doc comment so the v4 source scan retains it
    - Diagrams are CSS/flex structures with real text, not images; decorative glyphs are `aria-hidden`; each diagram is labelled by its heading
    - Diagrams degrade to legible stacked layouts below `md` rather than shrinking
  - Verification:
    - `npm run typecheck`; manual WCAG 2.1 AA review at 320px, 768px and 1280px

- [x] `WP19-S2` - `/playbooks/{slug}` route, bare layout, and config registry
  - Scope: `app/playbooks/layout.tsx`, `app/playbooks/[slug]/page.tsx`, `app/playbooks/_playbooks/`
  - Acceptance criteria:
    - The route lives outside `app/(marketing)/` and renders with no `MarketingNav` and no `SiteFooter`, following `app/links/page.tsx`
    - The layout applies `theme-cream` and the `newsreader` variable and supplies its own minimal header and attribution footer
    - `PLAYBOOKS` and `PLAYBOOK_SLUGS` are exported from the registry; `generateStaticParams` and `generateMetadata` are driven from it
    - Unknown slugs return `notFound()`
    - A namespaced segment is used; no root-level dynamic segment is introduced
  - Verification:
    - `npm run build`; `/playbooks/decision-stack` renders chrome-free in `npm run dev`

- [x] `WP19-S3` - The Decision Stack content config
  - Scope: `app/playbooks/_playbooks/decision-stack.tsx`
  - Acceptance criteria:
    - Broken-loop and working-loop sequences, six named layers, fan-out outcomes, four stat tiles, two copy-paste prompts, a gated pack, and a CTA are all present
    - Every stat tile is traceable to a value in this repository; no invented metrics and no income or user-count claims
    - Copy follows the established voice: direct, builder-to-builder, no hype
  - Verification:
    - Each stat tile carries a `source` field naming where its number comes from, in `decisionStack.outcomes.stats` (`app/playbooks/_playbooks/decision-stack.tsx`); the same citations are reproduced in `docs/wp/wp19-progress.md`

- [ ] `WP19-S4` - Email, SEO, and routing plumbing — **pending**: code complete, but the verification criterion below requires a live subscribe response that has not been observed. See `docs/wp/wp19-progress.md`.
  - Scope: `app/api/subscribe/route.ts`, `app/sitemap.ts`, `next.config.ts`
  - Acceptance criteria:
    - `"playbook"` is added to `ALLOWED_UTM_CAMPAIGNS` so the campaign is no longer silently downgraded to `starter-kit`
    - The pre-existing `"dare-workshop"` misattribution is fixed in the same constant
    - `app/sitemap.ts` emits one entry per `PLAYBOOK_SLUGS` member
    - `next.config.ts` gains an explicit per-slug short alias; the `fallback` rewrite to `LEGACY_ORIGIN` remains intact
    - Each playbook exports a canonical URL and a JSON-LD graph built from `lib/seo.ts`
  - Verification:
    - `npm test` (notably `test:sitemap` and `test:redirects`); a live subscribe response reports `routed_to.utm_campaign === "playbook"`

## Out Of Scope

- A new Beehiiv automation, env var, or `AllowedAutomationId` union member; v1 enrolls into the existing default automation
- A dedicated OG card surface in `scripts/generate-og-cards.mjs`; v1 reuses the shared `/image/og-image.png`
- A `/playbooks` index page; deferred until three or more playbooks exist
- A `playbook-8slide` carousel layout in `content/social/_layouts/`
- Additional playbook instances beyond The Decision Stack
- Any change to `/shipable` or `/dare` beyond the UTM allowlist fix

## Notes

- `next.config.ts` has a catch-all `fallback` rewrite to `LEGACY_ORIGIN`. A root-level dynamic segment would capture every unmigrated legacy path and the 404 route, so the playbook route must stay namespaced.
- `CLAUDE.md` says Beehiiv routes use the Vercel Edge runtime, but no route sets `runtime = "edge"`. Match the code, not the doc.
- `.agentic-workflow.yml` lists `npm run lint` in the required checks; `package.json` defines no `lint` script. Record it as N/A rather than chasing it.
- `CLAUDE.md` mandates an `a11y-check` skill that is not present in `.claude/skills/`. Review manually against the reference implementations it names.
- Promote unknown product decisions to `docs/wp/RULINGS.md`.
