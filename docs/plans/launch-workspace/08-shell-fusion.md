# 08 — One shell: the desk and the business workspace

**Status: proposed, 2026-11-06. Not ruled. Nothing is built.**
Mockup: [`mockups/shell-fusion.html`](mockups/shell-fusion.html) (open it in a browser;
it is static HTML with fixture data).

## The short version

The Builder's Hub dashboard (WP44) and the launch workspace (WP67–WP77) are two halves of
one journey: the dashboard is where a member **finds and chooses** an idea, and the
workspace is where they **run the business** built from it. Neither should replace the
other. They should share one shell.

They already share the design system: the `home-*` palette in `app/globals.css`, the
Newsreader serif and `theme-desk` (D18). What splits them is that WP72 built a second
shell (`WorkspaceFrame` / `WorkspaceSidebar`) beside the legacy `WorkspaceShell`, and the
two component sets drifted on shape and type. The ratified plan already said one shell:

- `01-strategy.md` row "Dashboard": "A business workspace is added beside it under one
  shell. Existing member features keep working."
- `02-architecture.md` row "Dashboard": "Shell gains a business switcher and credit meter."

So this proposal brings the build back to the plan. It is not a new pivot.

## 1. What exists today

| | Desk (`/dashboard`, WP44) | Business workspace (`/dashboard/b/{id}`, WP72) |
|---|---|---|
| Shell | `components/platform/shell/WorkspaceShell.tsx` | `components/workspace/shell/WorkspaceFrame.tsx` + `WorkspaceSidebar.tsx` |
| Scope | The member: ideas, saved, builds | One business: crew, launch, brand, site |
| Sidebar fill | `home-sunk` | `home-paper` |
| Logo | Real wordmark (`Logo`), italic W square when collapsed | "W" square + "Weekend *MVP*" in serif |
| Nav rows | Icon + label, 18px lucide icons | Label only (the canvas drew icons; the build left them out) |
| Rail | Collapses to 72px, remembered | Fixed 240px |
| Top bar | Sticky search ("Search 229 ideas", `/`) | None |
| Footer | `PlanCard` + `AccountMenu` | Credits meter card |
| Phone | Bottom tab bar (Home, Ideas, Saved, Builds, Account) | "Menu" disclosure |
| Section labels | Mono, 11px, uppercase, +0.08em | Geist sans, 11px, uppercase, +0.14em |
| Buttons | 9px rounded rectangles | Full pills (`BTN_PRIMARY` in `kit/styles.ts`) |
| Cards | 14px radius | 12px (`rounded-xl`) |
| Home | Greeting, Building now, Idea of the week, Picked for you, Newest ideas, Saved rail | Wren chat only, until WP77-S6 |

Nav rows in the workspace (`lib/workspace/routes.ts`): This weekend — Team HQ, Launch
plan, Build pack, Brand kit. Workspace — Dashboard, Tasks, Email, Ads, Studio, Outbound,
Social, Files, Settings. Billing is the credits card. The canvas also lists Chat,
Analytics, Products, Orders, Customers, Legal and Activity, which have no page yet.

## 2. The proposal

### 2.1 One shell, two contexts

`WorkspaceShell` stays and learns a context: `desk` or `business`. A switcher at the top of
the sidebar moves between them. `WorkspaceFrame` and `WorkspaceSidebar` retire; the kit
(`components/workspace/kit/**`) stays.

```
[Weekendmvp wordmark]                         [collapse]
[ Your desk  ▾ ]   switcher: Your desk · HydroTrail · + Start a business

Desk context (today's nav, unchanged):
  Home · Ideas · Saved 4 · Builds 1 · Live builds
  Collections
  RESOURCES   Starter Kit

Business context:
  THIS WEEKEND (ember)   Team HQ 4 · Launch plan 5/8 · Build pack · Brand kit
  WORKSPACE              Dashboard · Tasks · Email · Social · Ads · Studio · Files · Settings
  LIBRARY                Ideas · Saved

Footer (both):  Credits meter card (members with credits) or PlanCard (free members, desk)
                Account row
```

Rules:

- **The switcher only appears for members with at least one business.** Everyone else sees
  today's dashboard, unchanged.
- **The switcher keeps the WP72 `BusinessSwitcher` behaviour** (disclosure, not a menu;
  Escape returns focus). "Your desk" is its first row. "+ Start a business" keeps the
  Growth gate copy for a second business.
- **Only rows with a page show.** Products, Orders, Analytics and the rest join the nav when
  their page ships. Dead rows add noise, and the short nav is part of why the desk feels
  calm.
- **The library stays one click away inside a business.** A founder mid-launch still saves
  ideas; the Library group links to the desk's Ideas and Saved pages and switches the
  context back.
- **Search stays in the top bar in both contexts.** On the desk it searches ideas (today's
  behaviour). In a business the placeholder becomes "Search HydroTrail" when workspace
  search exists; until then it keeps searching ideas.
- **Phone:** the bottom tab bar stays. In a business its five slots become Dashboard, Team,
  Launch, Chat and Account (the Account sheet carries the switcher and the rest).
- **The idea-request widget stays shell-level.** `IdeaRequestWidget` (Idea 4, merged after
  this was drafted) floats on every desk page. In a business it must not cover Wren's
  composer or the phone tab bar; S2 decides whether it shows there at all.
- **Collapse works in both contexts.** Collapsed, the switcher shows the business avatar
  (or the W mark for the desk) with the name in its accessible label.

### 2.2 The desk home links into the business

The desk home stays as it is, with two additions:

1. **"Building now" becomes "Launching now" for a member with a business.** Same card, same
   FRI / SAT / SUN / MON strip (it already matches the canvas's Fri → Sun launch plan).
   It shows the business name, "5 of 8 ready · 4 need your OK" and a primary
   "Open workspace". Members without a business keep today's prompt-pack card.
2. **Idea of the week gains the build button.** `BuildIdeaCta` ("Build this idea, free")
   sits next to "Read the research", linking to `/start/{slug}` through sign-up as today.

### 2.3 The business dashboard follows the desk's layout

WP77-S6 builds `/dashboard/b/{id}` in the desk's composition so the two read as one
product:

- Mono dateline ("FRI 6 NOV · LAUNCH WEEKEND"), serif H1 ("HydroTrail."), one status line
  ("4 things need your OK. Wren has the rest.").
- Main column: the dark plan banner (`home-panel`) as the page's single dark moment, then
  approvals as hairline rows in the "Newest ideas" style, then the team strip, then the
  live-site preview and numbers.
- Right rail: Wren, in the slot the desk uses for Saved. "Expand chat" opens the full
  Chat page.

### 2.4 Landing after sign-in

Proposed default: a member with a business in an active launch weekend lands on that
business's dashboard. Everyone else lands on the desk. The switcher remembers the last
context per device. **This is an owner call** (open question 1).

## 3. Design system changes

All within D18: the same `home-*` tokens and shadcn/ui primitives, no new palette. Where
the two sets disagree, the desk wins, because it is the shipped and liked one.

| # | Change | Where |
|---|---|---|
| 1 | **Actions are 9px rounded rectangles; pills are for state.** Buttons, button-links and icon buttons use the desk's 9px radius. Full pills stay for status pills, category tags and filter chips. Shape then carries meaning: a pill tells you a state, a rectangle is something you do. | `kit/styles.ts` (`BTN_*`, `ICON_BTN`) |
| 2 | **Cards are 14px.** | `kit/styles.ts` (`CARD`) |
| 3 | **Section labels are mono** (11px, uppercase, +0.08em). Datelines, counters and "N°" numbering are the research-desk voice; the workspace speaks it too. The ember colour for "This weekend" stays. | `kit/styles.ts` (`EYEBROW`), nav group headings |
| 4 | **Category tags and status pills look different.** Sage means "E-commerce" on the desk and "Approved" or "Live" in the workspace. Category tags stay mono uppercase with no dot. Status pills stay sentence case Geist with a 6px dot. Colour never carries meaning alone (already a kit rule). | `StatusPill`, desk tag component |
| 5 | **One logo.** The real wordmark everywhere; the italic W square only as the collapsed mark. Retire the serif "Weekend *MVP*" placeholder. | Shell |
| 6 | **Nav rows have icons** (lucide, 18px, `aria-hidden`), as the canvas drew them and the desk already does. | Shell |
| 7 | **Sidebar fill is `home-sunk`** in both contexts (the desk's choice), so the content area reads as the paper. | Shell |
| 8 | **"Yours" has one colour.** The canvas uses lilac (`#e3e0f0` / `#3d3570`) on the System board and brick (`home-clay`) on Team HQ. Proposed: lilac, so "Yours" never looks like "Blocked" (brick). Lilac is not a `home-*` token yet; adding it is a two-line token change. | `globals.css`, `StatusPill` |

Unchanged: palette, fonts, focus ring (`home-orange-ink`), ember for attention, the
`aria-disabled` pending look, every a11y rule in the kit.

## 4. How it would land

One work package in the Claude lane (it owns `components/platform/shell/**`,
`components/workspace/**` and `app/(launch-workspace)/**` per `05-lanes-codex-claude.md`).
Everything stays behind the workspace flag; with the flag off the desk renders exactly as
today.

| Story | Scope | Done when |
|---|---|---|
| S1 Primitives | Changes 1–4 and 8 from §3 in `kit/styles.ts`, `StatusPill`, `globals.css` | Kit preview (`/workspace-kit-preview`) and existing tests pass with the new shapes; a11y-check on the kit preview |
| S2 One shell | `WorkspaceShell` takes `context`; business nav, switcher and credits footer move in; `(launch-workspace)` layout mounts `WorkspaceShell`; `WorkspaceFrame` / `WorkspaceSidebar` removed. Changes 5–7 from §3 | Flag off: desk DOM unchanged (snapshot). Flag on: one `<nav aria-label="Workspace">`, one `main`, switcher works by keyboard; a11y-check on desk and business pages |
| S3 Desk hooks | "Launching now" card variant; `BuildIdeaCta` on Idea of the week | Members without a business see no change; GA events fire only after consent |
| S4 Business dashboard | WP77-S6 built in the desk layout (§2.3) | a11y-check; reduced motion; phone layout |

The WP72 guard test that forbids `<WorkspaceShell` in the launch-workspace layout
(`docs/wp/wp72-progress.md`) is replaced by one that requires it.

## 5. Proposed ruling (D26)

> **One shell for the desk and the business workspace.** `WorkspaceShell` serves both, with
> a business switcher at the top. `WorkspaceFrame` and `WorkspaceSidebar` retire; the
> workspace kit stays. Where the desk and kit styles disagree, the desk's shapes and type
> win (9px actions, 14px cards, mono section labels), within D18. Nav rows appear only
> when their page exists.

Recording it in `docs/wp/RULINGS.md` and adding the work package to
`docs/wp/wp67-program-manifest.md` are owner actions. The manifest is frozen, so the new
work package needs the owner's approval; this proposal aligns the build with the ratified
strategy rather than changing its scope.

## 6. Open questions for the owner

1. **Landing after sign-in:** business dashboard during an active launch weekend, desk
   otherwise (proposed)? Or always the desk?
2. **"Yours" colour:** lilac (proposed) or brick?
3. **Phone tab bar in a business:** Dashboard, Team, Launch, Chat, Account (proposed)?
4. **Timing:** land S1–S2 before WP77-S6 (proposed, so the business dashboard is built once
   in the final shell), or after the L1 private beta?
