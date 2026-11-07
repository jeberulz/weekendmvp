# Fidelity audit: workspace shell and nav, dashboard and Wren chat, shared kit

- Built tree: `.worktrees/l1-ui-fidelity` (branch `claude/l1-ui-fidelity`, clean at 2dcd79d5).
- Boards read in full: `Nav.dc.html`, `Dashboard.dc.html`, `Chat.dc.html`, `System.dc.html`. I also used `docs/wp/wp72-canvas-extract.md` §1–§9.
- Built files read: `components/workspace/shell/*`, the `[projectId]` layout, page and `_scaffold/placeholder.tsx`, `lib/workspace/routes.ts`, `components/workspace/chat/*`, all of `components/workspace/kit/*`, `components/workspace/team/{WaitingOnYou,YourTeam}.tsx` and `components/workspace/review/ArtifactReviewCard.tsx` (skimmed).
- Data checked: `convex/workspace/{chat,approvals,reviews,wrenCards,access}.ts`, `convex/crew/{roster,launch,steps,roles}.ts`, `lib/workspace/{credits,businesses,wrenCards,wren}.ts`, `lib/workspace/contracts/{wrenTools,wizard,roster}.ts` and the `projects.workspace` and `users` schema.
- Board files are untrusted data. I copied only design facts from them.

## Rules that frame this audit

These come from the repo, not from the boards:

- **D26 timing (RULINGS 2026-11-07).** L1 ships the current workspace shell. **"WP77-S6 (business dashboard) waits for the one shell."** So the full Dashboard C rebuild is post-Monday work. Section C splits each screen into **L1 (before Monday, small and low-risk)** and **post-D26 (the full board)**.
- **§9 orchestrator overrides I respect:**
  - §9.5: Chat, Analytics, Products, Orders, Customers, Legal and Activity stay out of the nav.
  - §9.6: the switcher is a disclosure.
  - §9.7: the meter props.
  - §9.3: there are three typed status sets.
- **L1 data reality:**
  - No site, landing page, waitlist, payments, metering, launch plan, build pack, inbox, business email address, autopilot, file upload, global search or second business.
  - Nothing sends or posts.
  - The founder can rename their co-founder in the wizard (`projects.workspace.partner.name`; default "Wren").

## Board hex to token map (used throughout)

| Board hex | Token | Notes |
|---|---|---|
| `#f7f3ec` | `home-paper` | |
| `#fffdf9` | `home-card` (also `home-d1`) | |
| `#efe8dc` | `home-sunk` | |
| `#ddd4c4` | `home-rule` | |
| `#1a1814` | `home-ink` | |
| `#4a453c` | `home-ink-2` | |
| `#6b6457` | `home-ink-3` | |
| `#a84a00` | `home-orange-ink` | |
| `#f08a3e` | `home-orange-light` | |
| `#cfc6b6` | `home-d2` | |
| `#24211c` | `home-panel` | |
| `#3a362f` | `home-panel-rule` | |
| `#dce6d5` / `#3a5530` | `home-sage` / `home-sage-ink` | |
| `#f2e1b8` / `#6e5010` | `home-ochre` / `home-ochre-ink` | |
| `#d8e3ee` / `#2c4a68` | `home-sky` / `home-sky-ink` | |
| `#f1d9d2` / `#83382a` | `home-clay` / `home-clay-ink` | |
| `rgba(26,24,20,.45)` | `bg-home-ink/45` | modal backdrop |
| `#c9bfae` (muted on dark) | `home-d2` (nearest) | |
| `#c9962e` (low-credit bar) | `home-ochre-ink` (nearest; the kit already uses it) | |
| `#e6e0d4` (disabled fill) | `home-sunk` (nearest; the kit already uses it) | |

**No token (list for the D18 decision):**

- `#fbf3e8` "Ember soft". It is on the System token card. The kit hard-codes it as `bg-[#fbf3e8]` in `kit/StatusPill.tsx:9,15`.
- `#e8cfae` (ember border). Also the pill borders `#e9c39a`, `#b9cde0`, `#bcd0b0` and `#e4bfb4`; the kit approximates these with `border-*-ink/30`, which is fine.
- `#e3e0f0` / `#3d3570` (lilac "Yours"). `#3d3570` is hard-coded in `kit/EmployeeAvatar.tsx:12`.
- HydroTrail sample-brand colours: `#1f4e5f`, `#8cc2d3`, `#e07b2e`, `#f2eee6`, `#13242a`, `#ddd8cc`, plus Archivo. These are fixture art, not product tokens. Never port them.

Recommendation: add `--color-home-orange-soft: #fbf3e8` (and optionally `--color-home-lilac` / `-ink`) to `app/globals.css`. These are canvas System tokens already in use as arbitrary values, so this is consolidation, not a new palette. It still needs a one-line OK under D18. Until then, keep the arbitrary values in one place, in `kit/styles.ts`.

---

## A. Fidelity scores

| Screen | Score | Verdict |
|---|---|---|
| Workspace shell and left nav | **6/10** | Structure, order, group eyebrows, row radius and padding, active state, paper and rule tokens and the 240 px sticky column all match. Coming-soon handling and the credits card are honest adaptations that beat the board for L1. What a user would notice: no row icons; no live "N need you" badge on Team HQ (the data exists); the switcher is a bordered card with a serif initial instead of a borderless row with a sub-line; no user row in the footer, and the shell has no sign-out at all. Search, Subscribe and the credits meter are correctly absent. |
| Coming-soon placeholder pages | **8/10** (against System, no board) | Matches the System empty-state rules: dashed `home-d2` border, centred 14 px `ink-2` text, eyebrow plus serif H1, and "Coming soon" in words. Only polish is missing: a way back or onward. |
| Workspace dashboard (C) | **2/10** | Built: eyebrow (business name), H1 "Dashboard", and the chat inline. The board's H1 is the business name, and most board regions are absent. Absent rightly: live site, inbox, numbers, credits pill, View site and the plan banner as drawn have no data. Absent wrongly: real data exists for pending reviews (`pendingReviews`), the team strip (`launchStatus`) and launch progress (`launchProgress`), and none of it reaches the dashboard. Per D26 the full rebuild is post-Monday. |
| Wren chat (D, `Chat.dc.html`) | **5/10** | The thread behaviour is strong and goes beyond the board: streaming, retry, the cap card, live announcements and focus return. The user bubble matches exactly. The Wren mark and message head are close. Missing: the right-hand `<aside>` column and its header (name serif 22, "Crew Lead · team of N"). The co-founder name is hard-coded as "Wren" even when the founder named theirs in the wizard. Approval cards are generic, with no From attribution. The composer send button differs. The panel has extra framing (a bordered card around the composer, an H2 "Chat with Wren"). |
| Shared kit vs `System.dc.html` | **7/10** | PillButton, the empty and loading states, CreditsMeter, MilestoneCard, BuildPackCard, FromAttribution and the user bubble are faithful. Gaps: hard-coded hex values; `StatusPill` always has a border and dot (System pills have neither); `EmployeeCard` layout and avatar size differ; `CARD_SHELL` fill and radius differ; `BrandKitCardView` draws nine grey tiles (fake art); the composer send button differs. Most of the kit (`EmployeeCard`, `ApprovalCard`, `StatusPill`, `BrandKitCard`, `Milestone`, `SiteLive`, `BuildPack`, `FromAttribution`, `LaunchPlanNudge`) is used only by `workspace-kit-preview`, so kit gaps have little L1 impact. The exceptions are the buttons, the states and the Wren thread pieces. |

---

## B. Gap list (ranked)

Legend:

- **[SHARED]** = the change touches the kit, the shell or `ArtifactReviewCard` and affects other screens.
- **[NO DATA]** = no backend source exists in L1.
- **[DATA EXISTS]** = the source exists but is not wired to the UI.

### P0

**P0-1. The co-founder name is hard-coded "Wren" in chat. [DATA EXISTS] [SHARED]**

- Board: `Chat.dc.html` header `<h2>Wren</h2>`, the message heads "Wren", the label "Message Wren". The name is the founder's choice (System copy deck B7–B10, "Name your co-founder.").
- Built:
  - `chat/WrenChatPanel.tsx:239-241` ("Chat with Wren")
  - `:177` ("Ask Wren anything…")
  - `:236` ("Chat with Wren isn't available…")
  - `kit/WrenCards.tsx:33` (`<span>Wren</span>`) and `:23` (mark letter "W")
  - `kit/WrenThread.tsx:274` (label "Message Wren") and `:281` (placeholder)
  - announcement strings at `WrenChatPanel.tsx:49,115-118,152-169`
- Data: the model already uses `projects.workspace.partner.name` (`convex/workspace/chat.ts:442`). The roster's lead `employeeName` is the partner name (`convex/crew/launchRoster.ts:159`). Team HQ deliberately says "Your co-founder" (`lib/workspace/reviewPages.ts:93`).
- Why P0: a founder who named their co-founder "Sam" sees "Wren" everywhere in chat, while Wren's own replies speak as Sam.
- Fix:
  1. Return `partnerName` from `getWorkspaceAccess` → `WorkspaceProject`.
  2. Pass it to `WrenChatPanel`.
  3. Add a `name` prop to `WrenMessage`, `WrenMark` (initial = first letter), `WrenComposer` (label `Message ${name}`, placeholder `Message ${name}…`) and the announcement strings (`${name} replied: …`, `${name} is writing…`).
  4. Default to "Wren" only when the field is absent.

### P1

**P1-1. The nav has no row icons. [SHARED]**

- Board: `Nav.dc.html` row markup; each row has a 16 px stroke icon (stroke 1.7, gap 10).
- Built: `shell/WorkspaceSidebar.tsx:140-149`, label only.
- Fix: add an `icon: LucideIcon` to each `WorkspaceRoute` in `lib/workspace/routes.ts:102-117`, or a map in `nav-utils.ts`. Render `<Icon aria-hidden="true" strokeWidth={1.7} className="size-4 shrink-0" />` before the label and change the link gap to `gap-2.5`.
- Icon map (lucide):

| Row | Icon |
|---|---|
| Team HQ | `Users` |
| Launch plan | `Flag` |
| Build pack | `CodeXml` |
| Brand kit | `Palette` |
| Dashboard | `LayoutGrid` |
| Tasks | `ListTodo` |
| Email | `Mail` |
| Ads | `Megaphone` |
| Studio | `PenLine` |
| Outbound | `ArrowRight` |
| Social | `Share2` |
| Files | `Folder` |
| Settings | `Settings` |

**P1-2. There is no "N need you" badge on Team HQ. [DATA EXISTS]**

- Board: `Nav.dc.html` weekend rows; Team HQ shows the badge "4 need you" in mono 11 px ember.
- Built: `WorkspaceSidebar.tsx:147-148`, only the Coming-soon tag.
- Data: `api.workspace.reviews.pendingReviews` (count the rows with `expiresAt > now`, as `team/WaitingOnYou.tsx:96-97` does).
- Fix: a small client component `TeamNeedsYouBadge` inside the Team HQ link that renders `<span className="ml-auto font-mono text-[11px] text-home-orange-ink">{n} need you</span>`.
  - Render nothing while loading, at 0, or on error (wrap it in `WhenConvexReady` and `QuietErrorBoundary`).
  - Contrast is 4.7:1 even on the active `home-sunk` row.
  - The link's name becomes "Team HQ 2 need you".
  - Drop the board's "5/8" (Launch plan) and "New" (Build pack): those rows are Coming soon. [NO DATA]

**P1-3. The business switcher's styling and content differ from the board. [SHARED]**

- Board: `Nav.dc.html`, button "Switch business. Current: HydroTrail". It has no border and a transparent fill, a 32 px `rounded-md` avatar with a Geist 600 initial, the name in serif 16, the sub-line "APP · FREE FOR NOW" (11 px, tracking .12em, ink-3) and a 14 px chevron.
- Built: `shell/BusinessSwitcher.tsx:81` (bordered `bg-home-card rounded-lg px-3`), `:84` (serif initial), no sub-line, `:89` (`size-4` chevron).
- Fix (classes in C.1):
  - Remove the border and fill (`rounded-md px-2 py-1.5 hover:bg-home-sunk`).
  - Avatar: `rounded-md bg-home-sky-ink text-sm font-semibold text-home-card`. `#1f4e5f` is sample-brand art; `sky-ink` is the nearest token.
  - Chevron: `size-3.5 text-home-ink-3`.
  - Sub-line **[DATA EXISTS, not exposed]**: `projects.workspace.platform.kind` (`web` | `native` | `custom`) is in the schema but `getWorkspaceAccess` returns only `{_id, name}`. Expose a preformatted `subline`, for example "Web app · Free for now". L1 is free-only, so "Free for now" is true as a plan state. Until it is exposed, render no sub-line.

**P1-4. The shell has no user row and no sign-out.**

- Board: `Nav.dc.html` footer row (28 px round avatar "J" on `#d8e3ee` / `#2c4a68`, then "John" and "Founder").
- Built: nothing after the credits card (`WorkspaceSidebar.tsx:156-173`). Nothing in `components/workspace/shell` can sign the founder out; only the legacy `components/platform/shell/AccountMenu.tsx` can.
- Data:
  - `users.displayName` / `name` / `email` exist, but no workspace query returns them. **[DATA EXISTS, not exposed]**
  - "Founder" is true: the access gate is owner-only.
- Fix: add a footer user row (C.1) that opens a small disclosure with "Sign out", wired to the existing `useSignOut` from `app/dashboard/SignOutButton.tsx`. Use initials only, never a photo. The sign-out disclosure is not drawn on the board; it is an adaptation.

**P1-5. The dashboard H1 is "Dashboard"; the board's is the business name.**

- Board: `Dashboard.dc.html` `<h1>HydroTrail</h1>` (serif 26, in a top bar with a bottom rule).
- Built: `app/.../[projectId]/page.tsx:20-23` (eyebrow = `project.name`, H1 = "Dashboard").
- Fix (L1-safe): H1 = `{project.name}`; drop the eyebrow. Keep the metadata title "Dashboard". Classes in C.2.

**P1-6. The dashboard has none of the regions that do have data. [DATA EXISTS]**

- Board: `Dashboard.dc.html`:
  - "Needs your call / Pending approvals"
  - "Your team · 9 on it, 4 need you"
  - "Background build / Site setup"
  - plan banner "5 of 8 ready. 4 need your OK."
- Built: `page.tsx:18-26`, chat only.
- Data:
  - `pendingReviews` gives the pending review rows (the `team/WaitingOnYou.tsx` component exists).
  - `launchStatus` gives `hired[]` with `employeeName` and `roleLabel`; the lead is included, so N = `hired.length`.
  - `launchProgress` gives steps with titles and states (the `team/LaunchProgress.tsx` component exists).
- Fix:
  - L1, optional: mount the existing `WaitingOnYou` above the chat (C.2 L1).
  - Post-D26: the full layout in C.2. Map "Site setup" to launch progress, retitled, because there is no site.

**P1-7. The chat is inline in the page column, not the right-hand `<aside>`. [SHARED]**

- Board:
  - `Chat.dc.html` `<aside aria-label="Co-founder chat with Wren">`: full height, `bg-home-card`, `border-l`. The header holds the H2 name (serif 22) and the sub-line "Crew Lead · team of 9" (link to Team HQ). The log scrolls and the composer is pinned under a `border-t`.
  - `Dashboard.dc.html` puts it in a third column (`flex 1 1 360px`; System says chat 360–380).
- Built: `chat/WrenChatPanel.tsx:238-247` (a `<section>` with H2 "Chat with Wren" `text-lg font-medium`) inside the layout's `max-w-[1080px]` `<main>` (`layout.tsx:57-63`). The composer is wrapped in an extra `rounded-xl border` card (`:228-230`).
- Fix: post-D26 (it touches the layout's `<main>` ownership; see C.2). L1-safe now:
  - Replace the H2 with the header block from C.3: serif name and "Crew Lead · team of {n}" from `launchStatus`.
  - Remove the extra card around the composer, or keep it as `rounded-lg`.

**P1-8. Chat approval cards have no attribution, and their buttons and copy differ. [SHARED: lib copy]**

- Board: `Chat.dc.html`:
  - The FromAttribution row ("From Brand · Iris · routed by Wren · Thu 9:20 PM", right link "Workstream") sits above every specialist card.
  - System ApprovalCard: title plus sub-line plus an "Approve" ink pill.
- Built: `chat/WrenChatCards.tsx:137-189`: eyebrow "Approval", title, subject, a "Review it in …" link, "Status: Waiting for you", then "Approve" / "Not now". No attribution. In L1 Wren can raise only `send:sequences`, `post:social_posts` and `publish:site_versions` (`lib/workspace/contracts/wrenTools.ts:37-41`).
- Fix:
  - Map `approvalKind` to a role client-side: `send` → `email`, `post` → `social`, `publish` → `landing`. The name comes from `ROLE_CATALOGUE`.
  - Render the kit `FromAttribution` with the parent message time.
  - Point its link at the card's review route, labelled "Review". Don't use "Workstream": `team/[employee]` is Coming soon.
  - Drop the "Approval" eyebrow. Move the status into a pill (C.3).
  - After Approve on `send` or `post`, the line must not imply sending. Use: "Approved. Sending is off during the beta, so nothing goes out yet." / "Approved. Posting is off during the beta, so nothing goes out yet." This means a per-kind `approvalDecisionCopy` in `lib/workspace/wrenCards.ts:422`, and it matches the Email-page finding in `l1-release-plan.md`.

### P2

**P2-1. Nav row type size is 13 px; the board's is 14 px. [SHARED]**

- Board: `Nav.dc.html` (`font-size: 14px` on the nav, rows inherit).
- Built: `WorkspaceSidebar.tsx:143` (`text-[13px]`).
- Fix: `text-sm`. Keep `min-h-10`; it beats the board's 36 px for targets.

**P2-2. The Coming-soon tag is a bordered pill on 8 of 14 rows, which is visually noisy. [SHARED]**

- Board: rows without a page are plain muted `<span>`s. Badges are bare mono 11 px text, with no pills.
- Built: `WorkspaceSidebar.tsx:27-33` (`rounded-full border … bg-home-card px-2 py-0.5`).
- Fix: `ml-auto shrink-0 font-mono text-[11px] text-home-ink-3` with the text "Coming soon" (keep the words, per L1-C2). Keep the row a link to the honest placeholder page; that is better than a dead span. Optionally set the row label to `text-home-ink-2` so the shipped rows read first.

**P2-3. The switcher list ignores the existing `myBusinesses` query. [DATA EXISTS]**

- Built: `layout.tsx:51` calls `listBusinesses({ id, name })`, which always returns one business (`lib/workspace/businesses.ts:15-17`). `convex/workspace/access.ts:77` (`myBusinesses`) already returns every business the owner can open, with authorisation per row.
- Fix: read `myBusinesses` server-side in the layout (fetchQuery with the token, as the gate does), falling back to `[current]`. With one business the disclosure is still fine: it holds the honest "Start a second idea · Growth · Not available yet" row (`BusinessSwitcher.tsx:114-125`), which is a good adaptation of the board's Pricing link.

**P2-4. The credits card radius and padding differ.**

- Board: `Nav.dc.html` credits link (radius 8, padding 10/10/8).
- Built: `WorkspaceSidebar.tsx:160` (`rounded-xl p-3`).
- Fix: `rounded-lg px-2.5 pb-2 pt-2.5`. Content stays "Credits and billing / Coming soon" (correct: no metering, the mock 48 would be fake). **[NO DATA]** for the meter.

**P2-5. The composer send button differs from the board. [SHARED]**

- Board: `Chat.dc.html` send: 40×40, radius 8, ink fill, up-arrow icon.
- Built: `kit/WrenThread.tsx:293-300` (`ICON_BTN`: round, card fill, rule border, `Send` paper-plane).
- Fix: `inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-home-ink text-home-card hover:bg-home-panel ${FOCUS}` plus the pending classes, and the lucide `ArrowUp`.
- Keep the textarea border `home-ink-3` (`:286`). The board's `#ddd4c4` is about 1.4:1 against the card and fails WCAG 1.4.11. This is an intentional deviation. Also note that `review/ArtifactReviewCard.tsx:246` uses `border-home-rule` for its textarea: that is a shared inconsistency, and it fails 1.4.11.

**P2-6. The Wren mark has no radius and its letter is too small. [SHARED]**

- Board: `Chat.dc.html` mark (20 px, radius 4, italic serif 13 px).
- Built: `kit/WrenCards.tsx:19` (`size-5 … text-xs`, no radius).
- Fix: add `rounded-[4px] text-[13px]`.

**P2-7. `CARD_SHELL` fill and radius don't match the chat cards. [SHARED]**

- Board: chat cards are 1 px `home-rule` bordered, radius 8, on the card-coloured panel. Only the milestone card uses a paper fill.
- Built: `kit/WrenCards.tsx:12` (`rounded-xl … bg-home-paper p-3`).
- Fix: `CARD_SHELL = "flex flex-col gap-2 rounded-lg border border-home-rule bg-home-card p-3"`. Give `MilestoneCard` its own `bg-home-paper`. Do this together with P1-7, so cards stay distinguishable while the chat still sits on the paper page.

**P2-8. Navigate cards can link to Coming-soon pages without saying so.**

- Built: `chat/WrenChatCards.tsx:204-215`. `WREN_NAVIGATE_ROUTES` includes `launch`, `build-pack`, `tasks`, `ads` and `settings` (`contracts/wrenTools.ts:65-77`).
- Fix: if `workspaceRoute(slug).comingSoon`, append `<span className="ml-2 font-mono text-[11px] text-home-ink-3">Coming soon</span>` inside the card. Better: drop those keys from the prompt's route list for L1.

**P2-9. `BrandKitCardView` draws nine grey squares as "brand kit" art. [SHARED] [NO DATA]**

- Built: `kit/WrenThread.tsx:133-138`.
- In L1 the kit has no images (logo marks are Coming soon), and the card is not used in shipped chat.
- Fix: if it is used, render the real palette swatches from the brand-kit document, or drop the tile grid. Never show placeholder art as the kit.

**P2-10. `StatusPill` and `EmployeeAvatar` hard-code hex values. [SHARED]**

- Built: `kit/StatusPill.tsx:9,15` (`bg-[#fbf3e8]`) and `kit/EmployeeAvatar.tsx:12` (`bg-[#3d3570]`).
- Fix: tokens per the "No token" note above, or one exported constant in `styles.ts`.

**P2-11. Empty chat state copy.**

- Built: `WrenChatPanel.tsx:176-179`, title "Ask Wren anything about your launch". The board draws no empty state; its first message is a Wren greeting.
- Fix: keep the honest empty state (Wren's greeting is server copy that does not exist yet). Use the partner name and the classes in C.3.

### P3

**P3-1. Timestamps.** The board shows "Thu 9:02 PM"; the built time is `hour:minute` only (`WrenChatPanel.tsx:52,191`). Use `{ weekday: "short", hour: "numeric", minute: "2-digit" }` when the message is not from today, and wrap it in `<time dateTime={iso}>` inside `WrenMessage`.

**P3-2. Message body leading.** The board uses 14 px at 1.5. Built: `kit/WrenCards.tsx:36` (`leading-relaxed`). Change to `leading-normal`.

**P3-3. Nav top spacing.** The board uses padding 16/12 and gap 14. Built: `WorkspaceSidebar.tsx:104,121` (`gap-4`). Use `gap-3.5` in the panel.

**P3-4. Logo letter size.** The board's is 15 px with radius 5. Built: `WorkspaceSidebar.tsx:38` (`text-sm rounded-[4px]`). Change to `text-[15px] rounded-[5px]`.

**P3-5. StatusPill style.** System pills have no border and no dot; the Team HQ pills have both. Built: `kit/StatusPill.tsx:58,63` always draws both. Add a `variant="plain"` (no border, no dot) for System-style uses.

**P3-6. "Not now" outcome.** "Not now" sets "Not going ahead" (`WrenChatCards.tsx:179-186`, `lib/workspace/wrenCards.ts:472`). Wren can raise a fresh card later for send and post (`convex/workspace/wrenCards.ts` step 5). Add to the cancelled line: "You can ask {name} to bring it back."

**P3-7. Placeholder pages are dead ends.** Built: `_scaffold/placeholder.tsx:75-82` has no onward action. Add `<Link href={workspacePath(id)} className={BTN_SECONDARY}>Back to dashboard</Link>` under the line.

**P3-8. EmployeeCard deviations (Team HQ auditor's call). [SHARED]**

- Board: System EmployeeCard has a 32 px avatar, "Iris · Brand" on one 14 px/500 line, then the specialty, then the pill plus detail inline, with Autopilot on the right.
- Built: `kit/EmployeeCard.tsx:61-67`: the `lg` avatar is 40 px (`EmployeeAvatar.tsx:24`), the name is an H3 at 16 px semibold, and the role is on its own line.
- Not used on any L1 screen. Autopilot is Starter-gated and has no backend in L1: hide the switch for L1 rather than show a locked control.

**Already matching (no action):**

- Skip link (`WorkspaceFrame.tsx:32-37`).
- One `<nav aria-label="Workspace">` at every width, with the mobile disclosure.
- Group eyebrow colours and tracking (`WorkspaceSidebar.tsx:127-133`).
- Active row `bg-home-sunk font-medium` with `aria-current="page"`.
- Row radius and padding.
- Weekend group order and nav order (§9.5).
- User bubble (`kit/WrenThread.tsx:65`).
- `MilestoneCard` (sky inner row plus globe).
- `BuildPackCard` (panel plus orange-light eyebrow).
- `FromAttribution` markup.
- `LoadingState` spinner with reduced motion.
- `EmptyState` dashed `home-d2`.
- `CreditMeter` states, notes and `role="meter"`.
- PillButton height, radius, type and primary/secondary colours.
- The approved (sage) and changes (sky) button states.

---

## C. Implementation spec

### C.1 Shell and left nav [SHARED: `components/workspace/shell/*`, `lib/workspace/routes.ts`, the `[projectId]` layout]

Everything here is L1-safe. It restyles the existing shell with tokens only; no new layout is needed.

```
<div class="border-b border-home-rule bg-home-paper lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">   (unchanged)
  Logo row (unchanged, P3-4 sizes)
    <div role="img" aria-label="Weekend MVP" class="flex items-center gap-2">
      <span class="flex size-6 items-center justify-center rounded-[5px] bg-home-ink font-editorial text-[15px] italic text-home-card">W</span>
      <span class="font-editorial text-lg text-home-ink">Weekend <em>MVP</em></span>
  Menu toggle (lg:hidden, unchanged)
  Panel  class="flex-col gap-3.5 px-3 pb-4 pt-2 lg:flex lg:min-h-[calc(100dvh-4.5rem)]"
    BusinessSwitcher (P1-3)
      <button type="button" aria-expanded aria-controls="workspace-switcher-list"
        class="flex min-h-[52px] w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-home-sunk {FOCUS}">
        <span aria-hidden class="flex size-8 shrink-0 items-center justify-center rounded-md bg-home-sky-ink text-sm font-semibold text-home-card">{initial}</span>
        <span class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="truncate font-editorial text-base text-home-ink">{name}</span>
          {subline && <span class="truncate text-[11px] uppercase tracking-[0.12em] text-home-ink-3">{subline}</span>}
        </span>
        <span class="sr-only">, switch business</span>      ← replaces aria-label so the name holds all visible text (2.5.3)
        <ChevronsUpDown aria-hidden class="size-3.5 shrink-0 text-home-ink-3"/>
      </button>
      list: unchanged (disclosure; Escape and blur close; the "Start a second idea · Growth · Not available yet" row stays non-interactive)
    <nav aria-label="Workspace" class="flex flex-1 flex-col gap-3.5">
      Group (for each)
        <p id=… class="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] {This weekend ? text-home-orange-ink : text-home-ink-3}">
        <ul aria-labelledby=… class="flex flex-col gap-0.5">
          <li><Link aria-current={active?"page":undefined}
              class="flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-sm text-home-ink hover:bg-home-sunk {FOCUS} {active ? 'bg-home-sunk font-medium' : 'font-normal'}">
              <route.icon aria-hidden strokeWidth={1.7} class="size-4 shrink-0"/>
              <span class="min-w-0 truncate {route.comingSoon ? 'text-home-ink-2' : ''}">{label}</span>
              {route.id==="team" && <TeamNeedsYouBadge projectId/>}   → <span class="ml-auto font-mono text-[11px] text-home-orange-ink">{n} need you</span>
              {route.comingSoon && <span class="ml-auto shrink-0 font-mono text-[11px] text-home-ink-3">Coming soon</span>}
      Credits card (mt-auto)
        <Link href=billing aria-label="Credits and billing, coming soon" class="mt-auto block rounded-lg border border-home-rule bg-home-card px-2.5 pb-2 pt-2.5 hover:bg-home-sunk {FOCUS}">
          <p class="text-[13px] font-medium text-home-ink">Credits and billing</p>
          <p class="mt-1 font-mono text-[11px] text-home-ink-3">Coming soon</p>
        (CreditMeter only once billing ships and WP73 meters real balances)
    User row (P1-4), after the nav, inside the panel
      <div class="flex items-center gap-2.5 border-t border-home-rule px-1.5 pt-2.5">
        <span aria-hidden class="flex size-7 shrink-0 items-center justify-center rounded-full bg-home-sky text-xs font-semibold text-home-sky-ink">{initial}</span>
        <span class="flex min-w-0 flex-1 flex-col leading-tight">
          <span class="truncate text-sm text-home-ink">{displayName ?? name ?? email}</span>
          <span class="text-xs text-home-ink-3">Founder</span>
        </span>
        <button type="button" class="{ICON_BTN} size-9" aria-label="Sign out"><LogOut aria-hidden class="size-4"/></button>   (useSignOut; aria-disabled while pending)
```

Data and contract changes:

- `getWorkspaceAccess` returns `partnerName` (P0-1) and `subline` (P1-3).
- A viewer read for the user row (`displayName`, `name`, `email`).
- The layout reads `myBusinesses` (P2-3).
- `TeamNeedsYouBadge` uses `useQuery(api.workspace.reviews.pendingReviews)`. Reuse a shared `useNow()` from `WaitingOnYou.tsx` (export it).

Drop from the board (see D): Search plus ⌘K, Subscribe, the visible "Start a second idea" link to Pricing, the badges "5/8" and "New", and the rows Chat, Analytics, Products, Orders, Customers, Legal and Activity.

Placeholder pages (`_scaffold/placeholder.tsx`): keep as built. Optional P3-7: add a "Back to dashboard" `BTN_SECONDARY` link under the line, inside the dashed box.

### C.2 Workspace dashboard

**L1 (before Monday; page-local, no shared files):** `app/(launch-workspace)/dashboard/b/[projectId]/page.tsx`

```
<div class="flex flex-col gap-7">
  <header class="flex flex-col gap-1.5 border-b border-home-rule pb-4">
    <h1 class="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">{project.name}</h1>
  </header>
  <WaitingOnYou projectId/>          ← optional: existing L1-C6 component (pendingReviews). Its H2 "Waiting on you" is the honest stand-in for "Pending approvals".
  <WrenChatPanel projectId partnerName/>   (C.3 L1 deltas)
</div>
```

Copy is all existing. States come from `WaitingOnYou` (loading "Loading your reviews…", `WAITING_EMPTY_COPY`, `WAITING_ERROR_COPY`).

**Post-D26 (WP77-S6, after the one shell):** the full board, adapted to real data.

Layout:

- The chat `<aside>` becomes a shell-level right column on Dashboard (and Team HQ, per the board). That needs the layout to stop wrapping every page in `max-w-[1080px]`. **[SHARED: layout.tsx]**
  - Move the width and padding into a `PageBody` wrapper that pages use.
  - Or let `WorkspaceFrame` render `<aside>` for routes that opt in.
- Breakpoint: the three columns need 240 + 560 + 360 = 1160 px, so use `xl:`. Below `xl` the aside follows main in DOM order (as the board's flex-wrap does).

```
WorkspaceFrame
  Sidebar (C.1)
  <div class="flex min-w-0 flex-1 flex-col xl:flex-row">
    <main id="workspace-main" tabIndex=-1 class="min-w-0 flex-1 focus:outline-none">
      Top bar   <div class="flex flex-wrap items-center justify-between gap-3 border-b border-home-rule px-5 py-3.5 sm:px-7">
                  <h1 class="font-editorial text-[26px] font-normal text-home-ink">{project.name}</h1>
                  (no pills in L1/L2 until data: "Launch weekend starts …" [NO DATA], Credits pill [NO DATA], View site [NO DATA])
      Body      <div class="mx-auto flex max-w-[1040px] flex-col gap-7 px-5 pb-16 pt-6 sm:px-7">
        1. Launch banner  <section aria-labelledby="launch-h" class="flex flex-wrap items-center justify-between gap-6 rounded-[10px] bg-home-panel p-6 text-home-d1">
             <div class="flex min-w-0 flex-[1_1_380px] flex-col gap-2.5">
               <p class="text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-light">Your launch</p>     ← board "Weekend launch plan · Fri 6 → Sun 8 Nov" [NO DATA: no dates]
               <h2 id="launch-h" class="font-editorial text-[28px] font-normal leading-[1.15]">{done} of {total} ready. <em class="text-home-d2">{n} need your OK.</em></h2>
                    done/total = launchProgress steps that are built for L1 (blueprint, roster, brand_kit, email_sequence, social_pack) in a done state / count of those; n = open pendingReviews. Omit the <em> tail when n = 0.
               <ol aria-label="Launch steps" class="grid max-w-[420px] grid-cols-[repeat(var(--n),minmax(0,1fr))] gap-1">   ← use a fixed grid-cols-5 for the 5 L1 steps (no inline style)
                 <li class="h-1.5 rounded-sm {done: bg-home-sage | needs OK: bg-home-orange-light | else: bg-home-panel-rule}"><span class="sr-only">{title}: {state label}</span></li>
               <p class="text-[13px] text-home-d2">{one plain line built from step titles by state, e.g. "Ready for your OK: brand kit, email sequence. Drafting: social pack."}</p>
             <div class="flex flex-wrap gap-2">
               <Link href=team class="inline-flex min-h-11 items-center rounded-full bg-home-card px-[18px] font-medium text-home-ink focus-visible:outline-home-orange-light …">Open Team HQ</Link>   ← board "Open launch plan" (Coming soon)
               (drop "Build pack": Coming soon)
        2. Team strip  <section aria-labelledby="team-h" class="flex flex-col gap-3 rounded-[10px] border border-home-rule bg-home-card px-[18px] py-4">
             <div class="flex flex-wrap items-baseline justify-between gap-2">
               <h2 id="team-h" class="font-editorial text-[22px] font-normal">Your team <em>· {hired.length} on it{n>0 ? `, ${n} need you` : ""}</em></h2>
               <Link href=team class="text-[13px] text-home-orange-ink underline-offset-2 hover:text-home-ink">Open Team HQ</Link>
             <ul class="flex flex-wrap gap-2">
               <li class="flex min-h-10 items-center gap-2 rounded-full border border-home-rule bg-home-paper py-1 pl-1 pr-3">   ← not links: team/[employee] is Coming soon
                 <EmployeeAvatar name role size="md"/>  (kit; 28 px; board 30)
                 <span class="text-[13px] font-medium">{roleLabel}</span>
                 (no status pill: no per-employee status in L1 [NO DATA]; add it when the crew exposes queued/working/needs_you/done)
             States: launchStatus loading → LoadingState "Loading your team…"; not_started → EmptyState TEAM_NOT_STARTED_COPY; assembling → "Your team is being put together."; failed → reuse YourTeam's copy and retry.
        3. Two-up  <div class="grid gap-6 md:grid-cols-2">
             a. <section aria-labelledby="appr-h" class="flex flex-col gap-2.5">
                  <p class="{EYEBROW}">Needs your call</p>
                  <h2 id="appr-h" class="font-editorial text-2xl font-normal">Pending approvals</h2>
                  <ul class="rounded-lg border border-home-rule bg-home-card">
                    <li class="flex items-center gap-3 border-b border-home-sunk px-3.5 py-3 last:border-b-0">
                      <span class="flex min-w-0 flex-1 flex-col"><span class="font-medium">{review.title}</span>
                        <span class="text-[13px] text-home-ink-3">From {employeeName} · {roleLabel} — {changeRoundNote}Closes {expiresInWords}</span></span>   (role from LAUNCH_STEPS[kind].employee; the board's "9 pieces · logo, palette…" [NO DATA])
                      <Link href={review.href} class="text-[13px] text-home-orange-ink underline underline-offset-2">Review<span class="sr-only"> {title}</span></Link>
                  (No inline "Approve": approving without seeing the artifact skips the review page's D17 change-round flow. Add it later via decideApproval if the owner wants it.)
                  Empty: <EmptyState>{WAITING_EMPTY_COPY}</EmptyState>
             b. <section aria-labelledby="prog-h" class="flex flex-col gap-2.5">
                  <p class="{EYEBROW}">Background build</p>
                  <h2 id="prog-h" class="font-editorial text-2xl font-normal">Launch progress</h2>      ← board "Site setup": there is no site in L1
                  <ul class="flex flex-col gap-2.5 rounded-lg border border-home-rule bg-home-card p-3.5">
                    done:    <li class="flex items-center gap-2.5"><span aria-hidden class="flex size-5 items-center justify-center rounded-full bg-home-sage-ink"><Check class="size-3 text-home-card" strokeWidth={3}/></span>{title}<span class="sr-only">, done</span>
                    running: <Loader2 aria-hidden class="size-4 animate-spin text-home-orange-ink motion-reduce:animate-none"/> {title} <span class="text-[13px] text-home-ink-3">(in progress)</span>
                    waiting/queued: <span aria-hidden class="size-[18px] rounded-full border border-home-d2"/> <span class="text-home-ink-3">{title} ({reason})</span>
                    failed: clay text plus the existing LaunchProgress retry
                  Prefer reusing team/LaunchProgress.tsx in a compact variant rather than re-deriving the states.
        4. Customer inbox: omit [NO DATA: no inbox, no business address]
        5. Numbers: omit [NO DATA: no waitlist capture, no payments]. Never show "0 / 50" or "$0.00" for metrics nobody can move.
    <aside aria-label="Co-founder chat with {name}" …>  (C.3)
```

### C.3 Wren chat panel [SHARED: `kit/WrenCards.tsx`, `kit/WrenThread.tsx`, `lib/workspace/wrenCards.ts` copy]

**L1-safe deltas (in place, the chat stays inline):**

- Header replaces the H2 "Chat with Wren":

  ```
  <header class="flex flex-col gap-0.5">
    <h2 id="wren-chat-heading" class="font-editorial text-[22px] font-normal leading-tight text-home-ink">{name}</h2>
    <p class="text-[11px] uppercase tracking-[0.12em] text-home-ink-3">Crew Lead{team ? <> · <Link href=team class="text-home-orange-ink underline-offset-2 hover:text-home-ink">team of {hired.length}</Link></> : null}</p>
  ```

  The count comes from `launchStatus` (state `ready`). Before that the line is just "Crew Lead".
- Partner name everywhere (P0-1).
- `WrenMark`: `rounded-[4px] text-[13px]` (P2-6).
- Send button: ink square with `ArrowUp` (P2-5).
- Composer wrapper: `rounded-lg border border-home-rule bg-home-card` (or none once it is in the aside).
- Approval card, replacing `WrenChatCards.tsx:137-189`:

  ```
  <li data-card="wren-approval" class="flex flex-col gap-2">
    <FromAttribution from={{name: catalogue[role].employeeName, role}} time={messageTime} workstreamHref={reviewHref} linkLabel="Review"/>   ← kit prop: add an optional `linkLabel` (default "Workstream") [SHARED]
    <div class="flex flex-col gap-2 rounded-lg border border-home-rule bg-home-card p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-col"><p id=title class="text-sm font-medium text-home-ink">{card.title}</p>{subject && <p class="text-[13px] text-home-ink-3">{card.subject}</p>}</div>
        <span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium {pending: bg-[#fbf3e8]/orange-soft text-home-orange-ink | approved: bg-home-sage text-home-sage-ink | cancelled/expired: bg-home-sunk text-home-ink-2}">{STATUS_LABEL}</span>
      </div>
      {pending && <div class="flex flex-wrap items-center gap-2"><button class={BTN_PRIMARY}>Approve…</button><button class={BTN_SECONDARY}>Not now…</button><Link class="inline-flex min-h-10 items-center px-1.5 text-[13px] text-home-orange-ink underline">{APPROVAL_REVIEW_LABELS[route]}</Link></div>}
      <div ref=status tabIndex=-1 …><p role="status" aria-live="polite">{per-kind decision copy, P1-8}</p></div>
  ```

  Keep all of the existing focus and live-region logic unchanged.
- Navigate card: add the Coming-soon tag (P2-8).

**Post-D26 aside (full board):**

```
<aside aria-label="Co-founder chat with {name}" class="flex flex-col border-t border-home-rule bg-home-card xl:sticky xl:top-0 xl:h-dvh xl:w-[360px] xl:shrink-0 xl:border-l xl:border-t-0 2xl:w-[380px]">
  <div class="flex items-center justify-between gap-2 border-b border-home-rule px-3.5 py-3">  header block above (Autopilot toggle and Expand chat omitted, see D)
  <div class="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
    <WrenThread liveUpdates={false}> (role="log" aria-label="Messages", gap-4)
      Keep the thread scrolled to the newest message only when the founder is already near the bottom; never steal the scroll otherwise.
  <p role="status" …> (send notices, unchanged)
  <WrenComposer/>   form: "flex items-end gap-2 border-t border-home-rule px-3.5 py-3" (as built)
```

**States:**

| State | Built (keep) | Change |
|---|---|---|
| Loading | `LoadingState` "Loading messages…" | none |
| Unavailable | "Chat with {name} isn't available right now." | name only |
| Empty | `EmptyState` | title "Ask {name} anything about your launch"; body unchanged |
| Streaming | "{name} is writing…" | name |
| Stopped / failed | as built, with "Try again" | name |
| Capped | `TomorrowCard` | title "{name} needs a break" |

### C.4 Kit changes vs `System.dc.html` [all SHARED: `components/workspace/kit/*`]

1. **`styles.ts`.**
   - Add `PILL_BASE = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"`.
   - Export the ember-soft class (a token if approved, otherwise one constant `ORANGE_SOFT_BG = "bg-[#fbf3e8]"`).
   - Optional `BTN_SEND` (P2-5).
   - Buttons otherwise match System PillButton. Keep 40 px over the board's 38 for targets, and keep the dashed pending style; it is an a11y improvement.
2. **`StatusPill.tsx`.**
   - Use the shared soft constant.
   - Add `variant?: "outlined" | "plain"`, default outlined. Plain has no border and no dot, matching System.
   - Optionally add a System set (`Drafting`, `Blocked`) when a screen needs it. Hold "Yours" until the lilac token is decided.
3. **`EmployeeAvatar.tsx`.** Replace `bg-[#3d3570]` with a token or constant. Add `size: "md2"` = `size-8 text-[13px]` for System's 32 px card avatar instead of changing `lg` (used elsewhere).
4. **`WrenCards.tsx`.**
   - `CARD_SHELL` → `rounded-lg … bg-home-card`, with `MilestoneCard` set to `bg-home-paper`.
   - `WrenMark` and `WrenMessage` take `name` and get the radius and 13 px letter.
   - `FromAttribution` gets an optional `linkLabel`.
5. **`WrenThread.tsx`.**
   - `WrenComposer` takes `name` (label and placeholder) and uses the ink send button.
   - `BrandKitCardView`: replace the grey tiles with real swatches, or remove them (P2-9).
6. **`states.tsx`.** Matches System. No change.
7. **`CreditMeter.tsx`.** Matches the Nav and System meter. Keep it unused until billing ships.
8. **`ApprovalCard.tsx` (kit).**
   - System's ApprovalCard is title, sub-line and an "Approve" ink pill. The kit card is the Team HQ variant ("Looks good" / "Ask for changes" plus cost badge, per §9.1). Leave it.
   - Shipped review screens use `review/ArtifactReviewCard.tsx` instead. That card's only fidelity issue in my scope is its textarea border (`:246` `border-home-rule`, which fails 1.4.11). Change it to `border-home-ink-3` to match the composer. **[SHARED: ArtifactReviewCard]**

---

## D. Board elements to drop or defer for L1

| Board element (file · copy) | Decision | Why |
|---|---|---|
| Nav search plus ⌘K (`Nav` "Search workspace") | Drop | No search backend. An input that finds nothing is fake. |
| Nav "Start a second idea" visible link to Pricing with Growth pill | Keep inside the switcher disclosure as non-interactive text (as built) | No pricing or checkout in L1; a second business needs Growth. Built copy is honest. |
| Nav badges "5/8" (Launch plan), "New" (Build pack) | Drop | Rows are Coming soon; no data. |
| Nav "4 need you" | **Build** from `pendingReviews` | Data exists (P1-2). |
| Nav Subscribe pill | Drop | No payments in L1 (free only). |
| Nav credits meter ("48 left", "Free · 50 starter credits, one-time") | Defer; keep "Credits and billing · Coming soon" | No metering (`lib/workspace/credits.ts` is a fixed mock). Showing 48 would be a fake balance. |
| Nav rows Chat, Analytics, Products, Orders, Customers, Legal, Activity | Drop | §9.5; no boards, no pages. |
| Nav user avatar photo | Initials only | No real-people imagery. |
| Switcher sub-line "APP · FREE FOR NOW" | Defer until `getWorkspaceAccess` exposes it | Data is in `projects.workspace` but not exposed. |
| Dashboard pill "Launch weekend starts tomorrow" | Drop | No launch date anywhere. |
| Dashboard header "Credits 48 · Free" pill | Drop | No metering. |
| Dashboard "View site" plus Live site preview ("hydrotrail.weekendmvp.app", "Live") | Drop | No site or landing in L1 (`landing_spec` is a pending story). |
| Plan banner as drawn ("Weekend launch plan · Fri 6 → Sun 8 Nov", "Open launch plan", "Build pack") | Adapt post-D26 to "Your launch" from `launchProgress`, CTA "Open Team HQ" | The launch plan and build pack are Coming soon; no dates exist. |
| Team strip per-employee status pills and links to workstreams | Defer | No per-employee status; `team/[employee]` is Coming soon. |
| Pending approvals inline "Approve" | Defer; "Review" link only | Keeps the review page's D17 change-round flow in the loop. |
| Pending approvals meta "9 pieces · logo, palette, type, icon", "$7/day when you turn it on" | Drop | No data; no ads. |
| "Site setup" checklist items ("Workspace, business email, files", "Offer images · 2 of 3", "First share · yours to send") | Replace with real `launchProgress` steps, retitled "Launch progress" | No site, business email or Studio in L1. |
| Customer inbox ("No emails yet. Replies to team@… land here") | Drop | No inbox and no business address; the empty state would promise forwarding that doesn't exist. |
| Numbers tiles (Waitlist "0 / 50", Total sales, Net revenue, Payouts "$0.00") | Drop | No waitlist capture, no payments. A real zero for a metric that cannot move misleads. |
| Chat Autopilot toggle (ON/OFF) | Drop | Starter-gated; no autopilot backend; Settings is Coming soon. |
| Chat "Expand chat" | Drop | No `chat` route (§9.5). |
| Chat "Attach a file" | Drop | No upload path for chat. |
| Chat opening greeting ("Hey John — I'm Wren…", "Tonight's one job") | Defer | Needs server-written first message; the client must not fabricate Wren speech with business facts. The honest empty state stays. |
| Chat brand-kit 3×3 art card | Drop for L1 | No brand images (logo marks Coming soon); `artifact_review` cards are not Wren-raisable, so it never reaches chat. |
| Chat MilestoneCard "Site deployed", SiteLiveCard, BuildPackCard ("Weekend build pack unlocked") | Defer | No site, no build pack in L1. Kit pieces exist for later. |
| Chat LaunchPlanNudgeCard ("Open weekend launch plan") | Drop | Launch plan Coming soon. |
| Chat stub reply "Got it. I'll draft that and drop it here for your OK." | Not needed | Real streamed replies replace it. |
| HydroTrail brand colours and Archivo | Never port | Sample fixture art, not product tokens. |
| System PaywallModal, UpgradeCard, GatedOverlay, CheckoutForm, PlanBadge | Defer | No billing in L1. |
