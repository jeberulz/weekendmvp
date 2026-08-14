# Signed-in experience — implementation brief

Status: **build packet** (2026-08-14). Give this to the implementing agent (poteto or otherwise).
Branch to build on: **new** `feat/signed-in-experience` cut from `design/platform-experience`. Do **not** keep implementing on `design/platform-experience` (that commit is the freeze). Do **not** open a PR until the owner asks.
Lane: Work Package. One agent. Do not spawn WP30. Do not resume `codex/wp23-*`.

This is not a new product. The law files are the product. This file is sequencing, visual temperature, and a kill map.

## Design read

Signed-in product chrome for a solo builder making one page, cream/paper language, Hilo *temperature* (light, soft radius, quiet pastels), Weekend MVP *IA* (one bar, current object, canvas). Not a Hilos dashboard. Not a dark zinc cockpit.

## Law (read first, do not re-litigate)

| Surface | Law | Wireframe |
|---|---|---|
| Home + chrome | [`signed-in-home.md`](./signed-in-home.md) | [`signed-in-home-wireframe.html`](./signed-in-home-wireframe.html) |
| Library | [`signed-in-library.md`](./signed-in-library.md) | [`signed-in-library-wireframe.html`](./signed-in-library-wireframe.html) |
| Preview | [`preview.md`](./preview.md) | [`preview-wireframe.html`](./preview-wireframe.html) |
| Publish | [`publish.md`](./publish.md) | [`publish-wireframe.html`](./publish-wireframe.html) |
| Account | [`account.md`](./account.md) | [`account-wireframe.html`](./account-wireframe.html) |

Taste gate: walk localhost against the wireframes. `npm run typecheck` is not the gate.

Public `/ideas/{slug}` stays the only canonical research page. Preview isolation (7-day, `noindex`, watermark, inert leads, claim-only) is unchanged. Stripe exact-once and WP30 Hold-after-pay are unchanged. Super-admin stays a separate plane.

## Visual

### Steal from the Hilo screenshot (temperature only)

- Light. Cream paper, not `#050505`.
- Soft, large radius (16–24px on cards/menus). Ink on paper, not zinc on black.
- Quiet pastel fills (sage / blush / butter) as **backgrounds for a card or rail**, never as a four-tile metric dashboard.
- Serif is for the **compiled page** (the site they’re making). Chrome stays Geist/sans.
- Existing hook: `.theme-cream` (`#faf7f2` / `#1c1917`) already used on idea pages. Signed-in product uses that family. Wireframe paper `#f3f1eb` is the chrome ground.

### Do not steal from that screenshot (IA)

Illegal, even in pastels:

- Left workspace sidebar / dual rail
- “We saved your place, {name}”
- Unread / On your plate / Shipped / In motion
- Conversations + Docs columns
- Floating “Ask anything” / Catch me up composer
- Line-art mascot as a home hero
- Channels, DMs, Threads, workspace switcher

That screenshot is why we froze a different product. Recreating it fails the home contract.

### Dark theme

Signed-in product is **light**. The current dashboard dark (`WorkspaceShell` zinc, `#050505`, tracking-wide “workspace”) feels off because it’s performing cockpit software while the job is “look at this page.” Kill it on signed-in routes.

Public marketing may stay dark-first (existing homepage). Do not add a dark-mode toggle. Do not dark-theme the preview canvas to match the old dashboard.

## Kill / redirect map

Leftover WP23/24/29 routes must not remain reachable in product chrome. Prefer replace-in-place under `/dashboard` so auth layout stays; do not invent a parallel `/app` tree.

| Today | Becomes |
|---|---|
| `/dashboard` | Home states (Day 0 keep / Day 0 cold / Day 1 canvas+proposal / Day n live) |
| `/dashboard/explore` | Signed-in Library (one picker). Redirect `?view=saved\|interested` → Library with no tabs |
| `/dashboard/billing` | No page. 302 to `/dashboard`. Account is a menu |
| `/dashboard/projects` | 302 to `/dashboard` |
| `/dashboard/projects/[id]` | 302 to that object’s home (Day 1 or Day n), not a cockpit |
| `/dashboard/new` | Hide from chrome. 302 to `/dashboard` (own-idea is v1.1) |
| `/build/[slug]` | Mint + redirect. Not a CMS. Kill `BuildPreviewForm` |
| `/preview/[token]` | Compiled page + stamp + Keep this site (until preview host exists) |

Nav: one top bar — wordmark · **current object** · Library · Account. Mobile: Home, Library, Account. No Billing. No Saved. No Interested. No New idea.

## Sequence (one agent, this order)

Do not parallelize. Each step must be walkable before the next.

1. **Chrome + tokens** — cream signed-in shell: one bar, no dual rail, `.theme-cream` on dashboard layout. Account menu stub (email + sign out). Redirects in the kill map that don’t need new UI yet (`/billing`, `/projects`, `/new`).
2. **Preview** — `/build/[slug]` mints and redirects. Compiled page + optional stamp + Keep this site. No template picker. Isolation unchanged.
3. **Home** — last explicit keep; Day 0 cold = three canonical-score cards; Day 1 = live canvas + one proposal; Day n = live URL in chrome, **no revision product**.
4. **Library** — one picker, Preview then leave. Current / Building marks only.
5. **Publish packet** — Day 1 rail/sheet: editable `{slug}.weekendmvp.app`, one dollar price, one confirm. Clash / Hold / unpaid return per `publish.md`. Do not build a pack shop. If live Stripe isn’t available, wire the packet UI to the existing checkout mutation and fail closed — don’t fake “you’re live.”
6. **Account** — menu: email, sign out → `/`. Switcher if 2+. Receipt + Stripe portal if a charge exists. No list of one.

## v1 out

- Day n revision / “Request a revision” / credit-priced edits (home named it; charging is unfrozen; v1.0 already deferred it). Day n is live canvas + Library + Account.
- Own-idea `/dashboard/new` journey and Validation Report compiler.
- GDPR delete in Account.
- Custom domains, subscriptions, real lead capture, fake visitors/revenue.
- Visual “design system” documentation beyond tokens in `globals.css`.
- WP31 wildcard DNS / production Stripe activation.
- Exact dollar figure (one charge; use the existing launch price as a single number, not packs).

## Acceptance

Fails if any of these are true:

1. Signed-in home is still empty lists, dual nav, or a Hilos greeting + metric tiles.
2. Day 1 is not the real preview render as the primary canvas.
3. `/build/[slug]` is still a form.
4. `/dashboard/billing` is still a destination.
5. Account is a settings page or a list of one.
6. Credits appear as chrome or as a publish gate.
7. Tests pass by substring-matching `WorkspaceShell` / `ExploreWorkspace` / `BuildPreviewForm` source.
8. The Hilo screenshot was used as a layout reference.

Walk: public idea → preview → Keep → Day 1 → packet (stop before live charge if Stripe isn’t live) → Library → Account → sign out to `/`.

## Agent rules

- One agent. No sub-agents for parallel WPs.
- Do not implement super-admin, policy classifier, or wildcard DNS.
- Do not “improve” the job sentences.
- Prefer deleting WP23 furniture over wrapping it.
- Record progress in `docs/wp/` only if a WP id is assigned; otherwise keep this brief as the packet.
