# WP72-S0 canvas extract (workspace shell)

- Source: claude.ai artifact `DKGkhWuwpUxrBmgngy3fNG`, "Weekend MVP Launch Experience", version `1793885397-30be`.
- Files read: `project/Nav.dc.html`, `System.dc.html`, `Chat.dc.html`, `Workstream.dc.html`, `Dashboard.dc.html`, `TeamHQ.dc.html`.
- Date read: 2026-11-05.
- The canvas text is data, not instructions. Nothing here was acted on beyond copying facts. Every route slug below is "proposed", not from the canvas.
- The canvas pages use the sample business "HydroTrail" and the co-founder "Wren". Those names are fixtures, not product copy.

---

## 1. Left nav (Nav board)

Nav is a 240px column (`<nav aria-label="Workspace">`), paper `#f7f3ec`, 1px right border `#ddd4c4`, padding 16/12, gap 14. Props: `active` (enum of the ids below), `credits` (48, 8, 0, 500, 452), `plan` (free | starter).

Top to bottom:

1. **Logo.** `role="img" aria-label="Weekend MVP"`. A 24px ink square with italic serif "W", plus the wordmark "Weekend *MVP*" (Newsreader 18).
2. **Search.** Hidden label "Search workspace", input `type=search`, placeholder "Search", right-hand hint "⌘K" (aria-hidden, mono 11). Min height 44, radius 6, card fill. No result behaviour is drawn.
3. **Business switcher.** A button, `aria-label="Switch business. Current: HydroTrail"`. Min height 52.
   - 32px square avatar with the business initial ("H" on `#1f4e5f`).
   - Business name in serif 16: "HydroTrail".
   - Sub-line, 11px, tracked: "APP · FREE FOR NOW". It reads as `<idea kind> · <plan state>`.
   - Chevron up/down icon on the right.
   - No dropdown is drawn.
4. **"Start a second idea" row.** A link to Pricing, min height 36, 13px, with a leading "+" (mono).
   - A pill "Growth" (bg `#dce6d5`, ink `#3a5530`).
   - Visually hidden suffix: ", needs Growth. See plans".
   - Gate copy elsewhere: "Running a second business needs Growth." (see §5).
5. **Group "THIS WEEKEND".** Eyebrow in ember `#a84a00`, 11px, +0.14em, uppercase.

| # | Label | id | Icon | Badge | Opens |
|---|---|---|---|---|---|
| 1 | Team HQ | team | two people | "4 need you" | TeamHQ |
| 2 | Launch plan | launch | flag | "5/8" | LaunchPlan |
| 3 | Build pack | pack | code brackets | "New" | PromptPack |
| 4 | Brand kit | brand | palette | none | BrandKit |

6. **Group "WORKSPACE".** Eyebrow in muted `#6b6457`. Sixteen rows in this order. Rows with no destination page on the canvas are plain `<span>`s (not links, no `aria-current`), muted ink.

| # | Label | id | Icon (path idea) | Opens |
|---|---|---|---|---|
| 1 | Chat | chat | speech bubble | not a link on canvas |
| 2 | Dashboard | dashboard | 2x2 grid | Dashboard |
| 3 | Analytics | analytics | bar chart | not a link on canvas |
| 4 | Tasks | tasks | list lines | Tasks |
| 5 | Email | email | envelope | Email |
| 6 | Products | products | box / cube | not a link on canvas |
| 7 | Orders | orders | shopping bag | not a link on canvas |
| 8 | Customers | customers | two people | not a link on canvas |
| 9 | Ads | ads | megaphone | Ads |
| 10 | Studio | studio | pencil | Studio |
| 11 | Outbound | outbound | right arrow | Outbound |
| 12 | Social | social | share nodes | Social |
| 13 | Files | files | folder | Files |
| 14 | Legal | legal | scales | not a link on canvas |
| 15 | Settings | settings | sun / gear | Settings |
| 16 | Activity | activity | pulse line | not a link on canvas |

   - No badges or counts appear in the Workspace group.
   - Icons are inline 24-box strokes at 16px, stroke 1.7, `aria-hidden`.
   - Active row: `aria-current="page"`, bg `#efe8dc`, weight 500. Inactive rows have a transparent bg and weight 400. Row height 36, radius 6, padding 0 10, gap 10.
   - "Team HQ", "Launch plan", "Build pack" and "Brand kit" live only in the This weekend group. They are active ids too.

7. **Footer (pinned to the bottom).**
   - **Subscribe button.** Shown only when plan = free. A pill with ink fill, "Subscribe", min height 44. It links to Pricing and takes `aria-current="page"` when `active=subscribe`.
   - **Credits meter card.** A link to Billing, `aria-current` when `active=billing`. See §4 "CreditsMeter".
   - **User row.** A top border, a 28px round avatar "J" (bg `#d8e3ee`, ink `#2c4a68`), name "John", role "Founder".

Credit meter as drawn in Nav:
- Row 1: "Credits" label, a plan pill ("Free" bg `#efe8dc` / ink `#4a453c`; "Starter" bg `#d8e3ee` / ink `#2c4a68`), and right-aligned mono text.
- Row 2: a `role="meter"` track (6px, `#efe8dc`).
- Row 3: a note line (11px muted).

| State | Right text | Colours (text / bar) | Note |
|---|---|---|---|
| Normal (free, 48 of 50) | "48 left" | `#3a5530` / `#3a5530` | "Free · 50 starter credits, one-time" |
| Low (n > 0 and n <= 20% of max) | "8 left · low" | `#6e5010` / `#c9962e` | same as normal for free |
| Zero | "0 left" | `#a84a00` / `#a84a00` | "Studio extras paused · see plans" |
| Starter | "500 left" etc. | same thresholds | "500 refresh on the 5th" |

Max is 50 on free and 500 on starter. The meter has `aria-label="Credits"`, `aria-valuemin=0`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext` = "N of MAX credits left".

---

## 2. Workspace pages

The canvas gives page file names, not routes. Slugs are proposed under `/dashboard/b/[projectId]/…`.

| Nav label | Canvas file | Proposed slug | Purpose |
|---|---|---|---|
| Dashboard | Dashboard | `/` (the index) | Launch plan summary, team strip, live-site preview, approvals, setup checklist, inbox, numbers, and Wren chat. |
| Chat | none | `chat` (proposed) | Full-width co-founder chat. The chat panel already shows the "Expand chat" button; no board is drawn. |
| Team HQ | TeamHQ | `team` | Crew lead card, approvals routing, 8 specialist cards with status filter and Autopilot, owner plan, skipped roles. |
| (employee) | WsBrand, Landing, WsMarketing, Email, Social, WsEngineering, Ads, and so on | `team/[employee]` (proposed) | The shared Workstream panel for one employee. Kinds are in §4. |
| Launch plan | LaunchPlan | `launch` | Weekend (Fri to Sun) launch checklist by owner. |
| Build pack | PromptPack | `build-pack` | Four phases, 8 build prompts. The "WMVP only" component is gated to Weekend MVP. |
| Brand kit | BrandKit | `brand` | Approve the 3x3 brand kit. |
| Analytics | none | `analytics` (proposed) | No board drawn. |
| Tasks | Tasks | `tasks` | "N things need you. Wren has the rest." (copy deck). |
| Email | Email | `email` | Inbox plus the 4-email waitlist sequence ("Approve all 4"). |
| Products, Orders, Customers | none | `products`, `orders`, `customers` (proposed) | No boards. The Dashboard shows "Total sales", "Net revenue", "Payouts" tiles as zeros. |
| Ads | Ads | `ads` | One $7/day campaign, readiness checks. Gated on Starter. |
| Studio | Studio | `studio` | Images and video; credit-metered "Make". |
| Outbound | Outbound | `outbound` | Cold outreach campaigns, 3 touches. |
| Social | Social | `social` | 7 launch posts, platform connect cards. |
| Files | Files | `files` | Plain-text files Wren knows, editable. |
| Legal | none | `legal` (proposed) | No board. |
| Settings | Settings | `settings` | "How Wren works for HydroTrail." |
| Activity | none | `activity` (proposed) | No board. |
| Subscribe | Pricing | `/pricing` (outside workspace, or `billing/plans`) | Free vs Starter vs Growth. |
| Credits card | Billing | `billing` | Billing and usage. |

Not in nav but linked from the dashboard: Landing (View site), BrandKit, Roster ("Why this team?"), TeamAssembly. Pages in the workspace for row 02 (this extract): Dashboard (C + D) and Team HQ (T2) only.

---

## 3. Dashboard (C) and Chat (D) layout as drawn

- Three columns: Nav (flex 240), main (flex 999, min 560), Chat (flex 360, shell range 360 to 380). The preview is 1440 wide.
- **Header bar** (padding 14/28, bottom border):
  - H1 "HydroTrail" (serif 26).
  - Pill "Launch weekend starts tomorrow" (bg `#f2e1b8`, ink `#6e5010`, with a dot).
  - Credits pill link: "Credits 48" + "Free" pill, visually hidden " of 50, open billing and usage".
  - Outline pill link "View site".
- **Plan banner** (dark `#24211c`, radius 10):
  - Eyebrow "Weekend launch plan · Fri 6 → Sun 8 Nov" in `#f08a3e`.
  - H2 "5 of 8 ready. *4 need your OK.*"
  - An 8-segment progress strip (aria-hidden): one segment `#dce6d5`, four `#f08a3e`, three `#3a362f`.
  - Detail line: "Live: landing + waitlist. Ready for your OK: brand kit, 4 emails, 7 posts, ad creative. Drafting: offer images (2 of 3). Yours: download the build pack, send the first share."
  - Buttons: "Open launch plan" (light pill), "Build pack" (outline pill).
- **Team strip** (card): H2 "Your team *· 9 on it, 4 need you*", link "Open Team HQ". A list of 9 pill links, each with a 30px initial avatar (`role="img" aria-label="Iris, Brand (AI employee)"`), role name, and a status pill.
- **Live site preview:** URL "hydrotrail.weekendmvp.app", "Live" pill (green dot), icon link `aria-label="Open live site"`. A static mock of the landing page.
- **Two-up row:**
  - "Needs your call" eyebrow, H2 "Pending approvals".
    - Rows: title, meta, "Approve" button, "Review" link.
    - After approve: `role="status"` text "Approved".
    - Four rows: Brand kit; "Email sequence · 4 emails"; "7 launch posts"; "1 ad creative".
  - "Background build" eyebrow, H2 "Site setup".
    - Check items (green dot), a spinner item (in progress), and a hollow circle (waiting).
    - Items: "Workspace, business email, files"; "Landing page + waitlist · Site deployed"; "Brand kit, 4 emails, 7 posts, ad creative drafted"; "Product build pack written"; "Offer images · 2 of 3 (in progress)"; "First share · yours to send (waiting)".
- **Customer inbox:** eyebrow "Customer inbox", H2 "Emails". Empty state: dashed box, "No emails yet. Replies to **team@hydrotrail.weekendmvp.app** land here and forward to you."
- **Numbers** (4 tiles on a 1px grid): "Waitlist · first goal" "0 / 50" (amber fill `#f2e1b8`); "Total sales" "$0.00"; "Net revenue" "$0.00"; "Payouts" "$0.00" with the note "Payments off · free for now".
- **Chat panel** (`<aside aria-label="Co-founder chat with Wren">`): see §4 "Wren thread".

---

## 4. Component inventory (System board)

The System board has a Tokens section, 35 component cards, the mermaid flow source, an AI-team data block, and two copy tables. All components below come from it unless marked otherwise.

### Buttons and chips
- **PillButton.** Primary (ink fill, "Start building"), secondary (card fill, hairline border, "Ask for changes"), disabled (`#e6e0d4` fill, muted ink, "Turn on"). Min height 38. Radius 999. Geist 500 13px. Used everywhere.
- **Eyebrow + SerifHeading.** Eyebrow 11px/500/+0.14em upper, muted. Serif heading with an italic tail: "5 of 8 ready. *4 need your OK.*" Rule: existing words first, only an italic tail is appended.
- **SuggestedChip** (wizard, not workspace): "✓ Suggested" (bg `#fbf3e8`, ink `#a84a00`, border `#e8cfae`); selected option: 1.5px ink border, e.g. "Mobile web, installable"; unselected: hairline, e.g. "iOS + Android".
- **StepProgress** (wizard): 10 segments; done = ink, current = ember, todo = hairline. Caption mono "STEP 4 OF 10 · MODEL". A labelled `<ol>`, current has `aria-current="step"`.
- **BlueprintCard + MatchStamp** (wizard): name, tagline, a rotated circle stamp "87% MATCH" (`aria-label="87% match"`, border and ink `#3a5530`).
- **FounderSignal** (wizard aside): pills "KEPT" (green) and "EDIT" (ember) with a line such as "Name · TrekSip → HydroTrail".
- **RenameRiskCallout:** "**Renaming later costs links.** Pick now; the site, email and brand kit use it."

### EmployeeCard (Team HQ, T2)
- **Fields:**
  - Avatar: 40px circle with an initial in serif, colour per employee, `role="img" aria-label="<Name>, <Role> (AI employee)"`, and an "AI" micro badge (mono 8px, card fill, hairline border) at bottom-right.
  - H3 name (16/600), role line, status pill (see StatusPill), specialty, and a detail line (sr-only prefix "Status detail: ").
  - Optional blocker line with a clock icon: "**Waiting on Brand** · the creative needs the approved logo" (colour `#6e5010`).
  - Footer: "Open workstream" link (sr suffix " · Name, Role") and the Autopilot switch.
- **Card border:** `#e9c39a` when Needs you, else hairline.
- **Autopilot switch** (30x18 track, 11px knob):
  - A button with `aria-pressed`, mono "On" / "Off" text, and sr-only " for Name, Role".
  - Tooltip (title) when on Free: "Autopilot is on Starter. On Free, <Name> asks before acting."
  - On Starter the tooltip is "Autopilot for <Name>".
  - On Free it also shows a lock glyph and sr " (on Starter)".
  - Clicking on Free opens the gate (see "Wren gate" below); on Starter it toggles, with a status note.
  - Starter note: "Autopilot preview on for <Name>. Nothing changes today: <Name> still waits for your OK." and "Autopilot off for <Name>."
- **Grid:** `auto-fill, minmax(236px, 1fr)`, gap 14. List `aria-label="Specialists"`.
- **Filter group** `role="group" aria-label="Filter specialists by status"`: toggle buttons `aria-pressed`, label plus mono count: "All 9", "Needs you", "Working", "Queued", "Done". The live region says "Showing N of 8 specialists" with " · <Filter>." when a filter is on.
- **Empty states** (dashed box):
  - Needs you filter: "Nobody needs you right now. Wren will bring the next decision here."
  - Any other filter: "No one is <filter lowercase> right now."
- **Autopilot footer bar:** "**Autopilot is on Starter.**" (or "Autopilot is on for your plan.") + "Nothing sends, posts or spends without your OK." plus a status line.
- **Header copy:** eyebrow "Team HQ · HydroTrail". H1 "9 on the team. *4 need you.*" (or "*Nobody needs you right now.*"). Summary: "Wren is routing N approvals. Of 8 specialists: X need you, Y working, Z queued, W done. Nothing sends, posts or spends without your OK." Button "Why this team?".
- **Lead card** (border 1px ink, radius 12):
  - Eyebrow "Crew Lead · runs the team", H2 "Wren *routes every approval.*"
  - Body: "Sets the order, routes approvals, brings you one decision at a time. Specialists never message you directly: their work reaches you as cards from Wren."
  - Status pill "Working · Routing N approvals" (or "All approvals routed · next: your first share").
  - Note: "**Chat stays with Wren.** The chat on the right is Crew Lead only. Ask Wren and it brings in the right specialist."
- **The 9 employees (canvas fixtures):**

| Name | Role | Avatar colour | Specialty |
|---|---|---|---|
| Wren | Crew Lead | `#1a1814` | (lead card) |
| Iris | Brand | `#a84a00` | Logo, palette, type and voice |
| Leo | Landing | `#2c4a68` | Site, waitlist form and early-access section |
| Sana | SEO | `#3a5530` | Search terms, page titles, first article |
| Marco | Marketing | `#6e5010` | Positioning, weekend launch plan, first-share plan |
| Elle | Email | `#83382a` | 4-email waitlist sequence |
| Theo | Social | `#3d3570` | 7 launch posts and posting calendar |
| Kai | Engineering | `#24211c` | PRD slice and phased build pack |
| Ada | Ads | `#4a453c` | One $7/day waitlist test |

- **Data shape** (System board, "mock only, no agent runtime"):
  - `EmployeeRole`: lead, brand, landing, seo, marketing, email, social, engineering, ads, curriculum, community, merch, outbound.
  - `Employee`: id, name, role, specialty, `status: "queued" | "working" | "needs_you" | "done"`, statusDetail, autopilot, avatarColor.
  - `RosterPlan`: businessId, `ideaKind: "app" | "course" | "service" | "physical"`, hires `{role, reason, rule: "always" | "added"}[]`, skips `{role, reason}[]`, createdAt.
  - `Workstream`: employeeId, brief, outputs `{id, title, kind, status: "draft" | "ready" | "approved" | "changes_requested", approvalId?}[]`, files `string[]`, blockers `{waitingOn: EmployeeRole, detail}[]`, ask?.
  - `LaunchPlanItem` gains `ownerEmployeeId`, `contributors?: EmployeeRole[]`.

### RosterAssembly (Team assembly T1)
Header "SELECTING SPECIALISTS · 7 OF 9" (mono). Rows with pills: "Hired" ("Engineering · an app idea needs a product build"), "Added" ("Ads · a small paid test helps the 50-signup goal"), "Skipped" ("Merch · nothing physical to sell"). Rows appear in an `aria-live` list; reduced motion shows all at once.

### Skipped roles (Team HQ)
- Section "Not on the team", H2 "Skipped for HydroTrail, *on purpose.*"
- Body: "Wren left these out because they don't move your first 50 signups. Hire one any time and Wren will brief them."
- Cards (dashed): role name, pill-like block "**Skipped** · <reason>" (bg `#f1d9d2`, ink `#83382a`), and button "Hire" (becomes "Hire requested" after use).
- Roles and reasons (fixtures): Merch, Outbound, Curriculum, Community.
- Hire opens the credit gate (see "Wren gate").

### StatusPill (fixed list)
Text label always present; colour never carries meaning alone. Pill radius 999, padding 2/10, 12px/500.

**System board status pills** (text / fill / ink):

| Label | Fill | Ink | Meaning |
|---|---|---|---|
| Live | `#dce6d5` | `#3a5530` | site or item is live |
| Approved | `#dce6d5` | `#3a5530` | founder approved |
| Ready | `#fbf3e8` | `#a84a00` | waiting for your OK |
| Drafting | `#efe8dc` | `#4a453c` | in progress, calm |
| Yours | `#e3e0f0` | `#3d3570` | founder owns it |
| Blocked | `#f1d9d2` | `#83382a` | cannot proceed |

**Employee status** (Team HQ), with 1px border colours:

| Status id | Label | Fill | Ink | Border |
|---|---|---|---|---|
| queued | Queued | `#efe8dc` | `#4a453c` | `#ddd4c4` |
| working | Working | `#d8e3ee` | `#2c4a68` | `#b9cde0` |
| needs_you | Needs you | `#fbf3e8` | `#a84a00` | `#e9c39a` |
| done | Done | `#dce6d5` | `#3a5530` | `#bcd0b0` |
| yours | Yours | `#f1d9d2` | `#83382a` | `#e4bfb4` |

(The Team HQ launch-plan list uses `yours` with a brick colour. The System board's "Yours" is lilac `#e3e0f0`. See open questions.)

Pill has a 6px dot (aria-hidden) in Team HQ.

**Output status** (Workstream panel): Draft (`#efe8dc` / `#4a453c`), "Ready for your OK" (`#fbf3e8` / `#a84a00`), Approved (`#dce6d5` / `#3a5530`), "Changes requested" (`#f1d9d2` / `#83382a`).

**Approval row pills** (Team HQ): "Waiting on you" (ember), "Approved" (green), "Changes asked" (blue).

**Readiness items** (Ads): OK (green), Blocked (brick), Check (ember).

### ApprovalCard
- **System board card:** title "Email sequence · 4", sub-line "Ready for your OK", button "Approve" (ink pill, min 34). Used on Dashboard, chat, Launch plan.
- **Dashboard approvals list:** title, meta ("From Iris · Brand — 9 pieces · logo, palette, type, icon"), "Approve" (button), "Review" (link). Done state `role="status"` "Approved".
- **Team HQ approvals** ("Approvals Wren is routing", counter mono "N of 4 waiting"), each row:
  - A 28px initial avatar, mono line "From Brand · Iris", title link, a pill.
  - Buttons "Looks good" and "Ask for changes". Each has an sr-only suffix " · <title>" and `aria-pressed`.
  - Pressing the same button again returns the item to open: "<title> is back in your queue."
  - States: open, approved (Looks good turns green, with a "✓ " prefix), changes (Ask turns blue).
  - Status messages (fixtures):
    - "Brand kit approved. Iris moves on to the offer images, and Ada can start the ad creative."
    - "Changes asked on the brand kit. Iris is reworking it; Ada stays queued."
    - "Email sequence approved. It sends from team@hydrotrail.weekendmvp.app on each signup."
    - "Changes asked on the emails. Elle is rewriting them."
    - "7 posts approved. Copy them as they come up, or connect an account to schedule."
    - "Changes asked on the posts. Theo is redrafting them."
    - "Build pack approved. Download it from the launch plan when you're ready to build."
    - "Changes asked on the build pack. Kai is reworking it."
- **Cost badge:** NOT FOUND on any of the six boards read. The only cost surfaces are in the credit components below (see open questions). Nothing shows a cost badge on an approval card.

### MilestoneCard
Round green check, "**Site deployed** · THU 9:14 PM" (mono time). Chat timeline. In the chat the milestone is a bordered `#f7f3ec` box: "Milestone reached: **Site deployed**", with an inner blue row (`#d8e3ee`, ink `#2c4a68`): "Site deployed" / "Landing + waitlist live · Thu 9:14 PM", and a globe icon in a white circle.

### SiteLiveCard
Mono URL "hydrotrail.weekendmvp.app", a green "Live" pill (with dot), a brand-colour preview strip. In chat: title row, "Landing page, waitlist and privacy page.", button-link "Open site" (outline pill).

### BuildPackCard (WMVP only)
- **System board:** dark `#1a1814` card, "**Weekend build pack unlocked**", "4 phases · 8 prompts", light button "Open".
- **In chat:**
  - Eyebrow "Weekend build pack unlocked" (`#f08a3e`).
  - Serif title "Build the real HydroTrail app — *not just the page.*"
  - Body: "4 phases · 8 prompts · written for mobile web, one login, offline-first. Works in Cursor, Claude Code or Codex."
  - Button "Open build pack", caption "Phase 1 takes about 45 min".

### The Wren thread and its card types (Chat panel)
- **Panel header:** H2 "Wren" (serif 22), sub-line "Crew Lead · team of 9" (link to Team HQ), and an Autopilot toggle button. `aria-pressed`, label "Autopilot" with a 30x18 switch and mono "OFF" / "ON". Also an icon button `aria-label="Expand chat"`.
- **Thread** `role="log" aria-label="Messages"`.
- **Wren message:** 20px ink square with italic serif "W", name "Wren" (500), time ("Thu 9:02 PM").
  - Sample: "Hey John — I'm Wren, your co-founder. HydroTrail is moving: a mobile-web hydration app for long solo hikes, free at launch, aiming for your first 50 waitlist signups this weekend."
  - And: "**Tonight's one job:** approve your brand kit so the site, emails and posts can use it. Everything else is drafting in the background."
- **FromAttribution row** (before a specialist card): a 20px employee avatar (`role="img" aria-label="Iris, Brand (AI employee)"`) + "**From Brand** · Iris · routed by Wren · Thu 9:20 PM" + a right-aligned link "Workstream". Wren stays the only voice; specialists are credited, not chatting.
- **Brand kit card:**
  - Bordered, linked 3x3 tile grid (`aria-label="Open brand kit"`).
  - "Generated brand kit · 9 pieces".
  - States: pending (buttons "Looks good", "Ask for changes", link "Open brand kit"), approved (`role="status"` "Approved. Site, emails and Studio now use it."), asking (`role="status"` "Tell me what to change below — I'll rework it right here.").
- **Milestone card** (above).
- **Site live card** (above), with Wren text: "HydroTrail is live, with a waitlist form — so the first visitor can already count toward your 50." From Landing · Leo.
- **Build pack card** (above), From Engineering · Kai.
- **Launch plan nudge:** Wren text "5 of 8 launch items are ready. Your brand kit, 4 emails, 7 posts and an ad creative are waiting on your OK — approve them in one go, or item by item." Button-link "Open weekend launch plan".
- **User bubble:** right-aligned, bg `#efe8dc`, radius `10 10 2 10`, max 85%. Wren reply is a stub: "**Wren** · Got it. I'll draft that and drop it here for your OK."
- **Composer** (form):
  - Icon button `aria-label="Attach a file"`.
  - Hidden label "Message Wren". Textarea, placeholder "Message Wren…", 1 row, min height 40.
  - Send icon button `aria-label="Send message"`. Empty input does not send.
- **Card types:** text message, FromAttribution + card (brand kit, site live, build pack, approval, upgrade), milestone, nav link card, user message.

### Wren gate card (Team HQ, inline)
`role="region"`, bg `#fbf3e8`, border `#e8cfae`. Header: 24px "W" avatar, eyebrow "From Wren", right pill "Draft pricing" (bg `#f2e1b8`, ink `#6e5010`). H3 (focus target, `tabindex=-1`, focused on open).
- Autopilot: "Autopilot is on Starter." Body: "Your team keeps drafting on Free and I bring you each approval. Autopilot lets <Name> act without asking each time. Spend still waits for your OK." Buttons: "See plans" (primary), "Keep asking me".
- Hire: "Hiring <Role> costs 20 credits once." Body: "You have N credits. Or it's included on Growth, with every skipped role. I'd still brief them after launch weekend so the 50-signup goal stays first." Buttons: "Use 20 credits · N-20 left" (primary, only if credits >= 20), "See plans", "Not now".
- After pay: "<Role> hired for 20 credits (mock). N credits left. Wren will brief them after launch weekend."

### WorkstreamPanel (kind enum)
- **Kind enum:** `brand | landing | seo | marketing | email | social | engineering | ads` (default `engineering`). The System board card only says "kind enum: brand · marketing · engineering"; the Workstream file lists all eight. The panel is one template, parameterised by employee.
- **Page frame:** `<article aria-labelledby="ws-h">`.
  - Avatar (`role="img" aria-label="Name, Role (AI employee)"`).
  - Eyebrow "AI employee · HydroTrail workstream".
  - H1 "<Name> · *<Role>*", specialty line.
  - Line "Reports to **Wren, Crew Lead** · Why hired: <reason>".
  - Status pill + bold label, status detail, and counts text "N outputs · N waiting · N approved".
- **Fields per kind:**

| kind | Employee | Brief | Outputs | Files | Waits (blockers) | Holds (waiting on this employee) |
|---|---|---|---|---|---|---|
| brand | Iris | 4 bullets | Brand kit 3x3 board; Logo lockup; Voice & tagline | BRAND.md, brand-kit.png, mark.svg, offer images | none ("Iris needs only your OK and your final logo upload.") | Ads, Studio image 3 |
| landing | Leo | 3 bullets | Landing page; Waitlist form; Early-access section | LANDING.md, hero-ridge.svg, waitlist-signups.csv | Soft: Engineering | none |
| seo | Sana | 3 bullets | Search terms; 12 page titles; First article | SEARCH_TERMS.md, page-titles.csv, article.md | none | none |
| marketing | Marco | 5 bullets | Positioning one-liner; Weekend launch plan; First-share message; Channel plan | POSITIONING.md, LAUNCH_PLAN.md, share message, CHANNEL_PLAN.md | Soft: Social | You (first share) |
| email | Elle | 3 bullets | 4-email sequence; Welcome email | EMAIL_SEQUENCE.md, welcome-email.html | Soft: Brand | none |
| social | Theo | 3 bullets | 7 launch posts; Posting calendar | SOCIAL_POSTS.md, posting-calendar.csv | Blocking: You (connect account) | none |
| engineering | Kai | 5 bullets | PRD slice (PRD.md); Phased build pack (8 prompts) | PRD.md, PRODUCT_PROMPTS.md, carry-checks.csv | Soft: Brand | Landing |
| ads | Ada | 3 bullets | Waitlist test $7/day; Readiness checks; Decision log | ADS_DECISION_LOG.md, ad-creative-draft.png | Blocking: Brand | none |

- **Sections:**
  - **Brief** ("*from the Blueprint*", "Blueprint approved Thu 9:02 PM"; bulleted list).
  - **Read this first** (engineering only): "Landing page ≠ is not the *product.*" with two cards ("LEO · LANDING · DONE" and "KAI · ENGINEERING · NEEDS YOU").
  - **Outputs** (H2 "Outputs *for your OK*", sub "Approvals go to Wren, who routes them to the rest of the team."), status `role="status"`.
  - **Files** ("Files *<Name> owns*", link "Open all files"; file rows doc or image icon + name + meta).
  - **Blockers** (H2 "Blockers"; H3 "<Name> is waiting on" and "Waiting on <Name>").
  - **Ask** (H2 "Ask <Name> *a scoped question*", sub "General questions go to Wren in the chat.").
- **Output card:** kind label (mono), H3 title, status pill, and a preview body (see below). Footer: buttons "Looks good", "Ask for changes" (`aria-expanded`), and once approved: "Approved · Wren will route this".
  - Ask form: label "What should <Name> change in "<title>"?", textarea (3 rows), placeholder "Be specific — e.g. what to keep, what to drop.", buttons "Send to <Name>" and "Cancel".
  - After a change request: "**Your note to <Name>:** "<text>"".
  - Messages: "<title> approved. Wren will route this<routeTo>." "Sent to <Name>. A new version of <title> comes back here, and Wren will flag it in chat." Empty-submit error: "Write what <Name> should change in <title> first."
  - Panel status rolls up: all approved gives Done "All outputs approved · Wren is routing them"; all remaining ones changes-requested gives Working "Revising after your notes".
- **Output preview types:** `board` (3x3 tiles + palette list), `lockup` (logo on three grounds), `voice` (tagline "Drink before you're thirsty.", tags Calm, Practical, Trail-tested, Never preachy; Say / Don't say lines), `prd` (Problem / User / The one loop / Must-haves / Not now, Success, a check table), `pack` (stack list, tool toggle, 4 phase buttons, prompt cards), plus generic key/value lines, quote, note, and link.
- **Prompt card (build pack):**
  - Header "PROMPT n · <time>" (mono) and title. A "Copy prompt" button (aria-label "Copy prompt n: <title>", becomes "Copied" or "Copy blocked").
  - A tool line per tool, a `<pre>` body, and two lines: "**Do not build:** …" (brick soft) and "**Done when:** …" (sage soft).
  - Tool toggle (`role="group" aria-label="Coding tool"`): Cursor, Claude Code, Codex. "Copy all 8" / "Copied all 8" / "Copy blocked here".
  - Phase buttons (`role="group" aria-label="Build phase: Discovery, Scaffold, Core loops, Ship"`): Discovery (FRI NIGHT), Scaffold (SAT MORNING), Core loops (SAT AFTERNOON), Ship (SUNDAY).
  - Copy status messages: "Copied Prompt N for <Tool>.", "Copied all 8 prompts for <Tool>.", "Copy is blocked in this preview. Select the prompt text and copy it by hand."
  - Prompts: Lock the one loop (15 MIN), Data model + carry formula (30 MIN), Project setup (60 MIN), Plans: create, edit, delete (60 MIN), Planner + forecast (60 MIN), Active hike: reminders + one-tap log (2 HRS), Offline + installable (2 HRS), Deploy + early access (90 MIN). Bodies are product-specific fixtures; each ends in "Do not build:" and "Done when:".
- **Mock thread:** user messages and an employee reply tagged "mock reply". `aria-live="polite"`. Empty text: "<Name> answers questions about <scope> only. Anything else, Wren picks up in the chat." Empty-send error: "Type a question for <Name> first." Input label "Ask <Name> about <scope> only", button "Send to <Name>".

### AssigneeChip / FromAttribution / LaunchPlan owner
- **AssigneeChip:** 22px round avatar + role, e.g. "Engineering" and "You". `role="img" aria-label="Kai, Engineering (AI employee)"` / "John, founder". Used on Tasks, Launch plan, the Dashboard strip. Backed by `LaunchPlanItem.ownerEmployeeId`.
- **Team HQ plan list** ("This weekend's plan, *by owner.*", link "Open the full launch plan"): a row has title, owner chip (sr prefix "Owner: Name, "), optional dashed chip "Marketing drafted it" (sr "Drafted by Marco, ") on "you" items, a meta string, and a status pill. Eight rows:
  - Landing page live
  - Brand kit approved
  - First share · waitlist live
  - Email sequence (4) approved
  - 7 social posts copy-ready
  - Product prompt pack downloaded
  - 3 offer images in Library
  - 1 ad creative ready

### Other shared components on the System board (workspace-adjacent)
- **LaunchChecklistRow:** a "Ready" pill, "7 launch posts", buttons "Approve" and "View".
- **SequenceStep:** "02 · +2 DAYS" (mono), "The 500 ml rule", "Why most hikers carry the wrong amount". Ember left border.
- **PlatformConnectCard:** a 28px square badge ("IG") + "Instagram", button "Connect". Eight platforms.
- **ReadinessItem:** OK / Blocked / Check pills with "Creative approved", "Ad account not connected", "Signup event firing".
- **PromptCard:** "02 · Data model + carry formula", "25 MIN", mono snippet, "Do not build:" line, "Done when:" line. WMVP only.
- **StatTile:** eyebrow "Waitlist", "0 / 50". Rule: a real zero, never a fake number.
- **GatedOverlay:** "Ads run on Growth." / "Your campaign is drafted and waits here." / button "Subscribe". Free-plan state, `role="dialog"`.
- **CheckoutForm:** Monthly / "Yearly · 2 months free" toggle, mock card, "500 credits now · refresh on the 5th", "Mock checkout — no card is charged". Labelled fields, inline errors via `aria-describedby`.
- **PlanBadge:** "Current: Free" (1.5px ember border), "Starter" (`#d8e3ee` / `#2c4a68`), "Growth" (`#dce6d5` / `#3a5530`), "Draft pricing" (`#f2e1b8` / `#6e5010`). Scale shows as "Coming", never selectable.

### CreditsMeter
Appears on Nav (compact), Studio Make, Settings, Billing.
- Three states: "48 left" (calm green `#3a5530`, bar 96%), "8 left · low" (amber `#6e5010`, bar `#c9962e` 16%), "0 left" (ember `#a84a00`, empty bar).
- Track 6px, radius 3, `#efe8dc`.
- `role="meter"` plus `aria-valuetext`. Colour is always paired with text. Calm, then amber at 20% or below, then ember at 0.
- The Dashboard header shows a compact pill version: "Credits 48" + plan pill, sr " of 50, open billing and usage".

### UpgradeCard
- Soft: card surface. Hard: ember-soft surface. First line names the value delivered. One ask only.
- Header: 20px "W" avatar + "From Wren" (10px upper). Bold line "You're on 8 credits. Studio Make needs 2." Body "Upgrade for 500/mo or keep going carefully." Buttons "See plans", "Not now".

### PaywallModal
- Studio at 0 credits. Dim backdrop `rgba(26,24,20,.45)`, card radius 10.
- Title (serif 17) "Make offer image needs 2 credits." / "Only Studio extras pause." / button "See plans" / "Copy the prompt instead · Close".
- `role="dialog" aria-modal`. Escape closes. Focus returns to the trigger. Never stacked.

### Empty, loading and error states
- **Empty:** dashed 1px `#cfc6b6` box, radius 8 to 12, centred 14px text in `#4a453c`.
  - Dashboard inbox (text above).
  - Team HQ filters (text above).
  - Workstream: "No blockers. <emp.noWait>" (e.g. "Iris needs only your OK and your final logo upload.").
  - Workstream thread empty text (above).
  - StatTile zero rule.
- **Loading:** only a spinner on the Dashboard's in-progress item (16px circle, top border ember, class `wm-spin`, 1s linear; disabled under `prefers-reduced-motion`). Roster assembly rows appear in an `aria-live` list. No skeleton and no loading text are drawn.
- **Error:**
  - Form validation messages (Workstream ask and question forms, above).
  - Copy failure: "Copy blocked" / "Copy blocked here".
  - Failed payment banner (billing deck): "Your card was declined. Nothing is lost."
  - No page-level error or 404 state is drawn.
- **Disabled:** PillButton disabled style only (`#e6e0d4` fill, muted ink).

---

## 5. Copy deck

### Billing and Wren cards (System, "Wren cards + pricing FAQ")
Format: Moment — Kind — Headline — Body · actions.

1. Launch plan 5/8 — soft — "Your weekend shell is free." — "Site, brand kit, emails, posts and all 8 build prompts are yours on Free. Studio extras and ads run on credits or Starter. · See plans / Got it"
2. Studio low — soft — "You're on 8 credits. Studio Make needs 2." — "Upgrade for 500 credits a month, or keep going carefully. · See plans / Not now"
3. Studio zero — hard — "Make offer image needs 2 credits. You have 0." — "Your site, waitlist, brand kit, drafts and build pack stay free. Only Studio extras pause. · See plans / Copy the prompt instead / Close"
4. Ads — hard — "Going live with ads needs Starter." — "Ada drafted the campaign, creative and cap. Meta bills you directly, with no markup. · See plans / Close · keep the draft"
5. Custom domain — hard — "Your own domain is included on Starter." — "hydrotrail.app is about $12/yr at the registrar. · Included on Starter · See plans"
6. Social — hard — "Publishing from here is on Starter." — "3 copy-and-post posts are free; all 7 stay drafted. · See plans / Close"
7. Email — hard — "This send needs Starter." — "Your first 50 sends were free. The sequence stays approved and waiting. · See plans / Close"
8. Second idea — hard — "Running a second business needs Growth." — "HydroTrail stays yours on Free and Starter. Growth runs up to three. · See plans / Back to HydroTrail"
9. Autopilot — hard — "Autopilot is on Starter." — "Your team keeps drafting on Free and I bring you each approval. Spend still waits for your OK. · See plans / Keep asking me"
10. Hire skipped role — credits — "Hiring Outbound costs 20 credits once." — "Or it's included on Growth. · Use 20 credits / See plans / Not now"
11. Failed payment — banner — "Your card was declined. Nothing is lost." — "We retry for 3 days. Site, waitlist and drafts keep working; credit-using actions pause after that. · Update card"
12. FAQ, "What stays free?" — "Your whole first weekend launch." — "Wizard, team, brand kit, landing + waitlist, email and social drafts, launch plan, all 8 build prompts and Wren chat for one business."
13. FAQ, "What are credits?" — "Credits pay for compute-heavy extras." — "Images 2, short video 15, launch film 25, regenerations 5–10. Free gets 50 once; Starter gets 500 a month."
14. FAQ, "Do ads cost extra?" — "Ad spend is billed by Meta." — "Starter lets you connect and run; Meta bills you directly. We add no markup in v1."

Copy principles (stated): name the value already delivered before asking; never imply the team stops on Free, only metered or gated actions pause; one ask per card, no stacked modals; same calm tone as "Looks good" / "Ask for changes". All numbers are draft.

### Key copy by screen (System "HydroTrail copy deck")
Format: Screen — Headline — Primary action — Key line.

- A · Homepage — "Pick an idea. Paste the prompt. Ship it by Sunday." — "Build this idea, free" — "Production copy kept. Prompt 1 is free. A free account starts the build: plan, brand kit, landing page and every prompt."
- A2 · Idea page — "Build HydroTrail this weekend. Free." — "Create free account and start building" — "One free account starts the build and opens the full research."
- B1 · Idea — "What are we building?" — "Use suggested · Continue" — "A hydration app for hikers that tells you how much water to carry."
- B2 · Blueprint — "Here's how I'd build it." — "Looks good" — "87% match. Or: I'd change some things."
- B3–B5 — "Where should it live first? · How will it make money? · What's the first win?" — "Use suggested" — "Mobile web, installable · Free for now · First 50 waitlist signups, this weekend."
- B6 · Name — "What do we call it?" — "Keep HydroTrail" — "Renaming later costs the links you've shared. Pick now."
- B7–B10 — "How should your co-founder work? · Name your co-founder. · Hi, I'm Wren." — "Assemble my team" — "Strategist: calm, explains the why, one priority at a time. Next: Wren hires your team."
- T1 · Team assembly — "Wren is hiring your team." — "Meet the team" — "Analyzing idea, selecting specialists. Every hire and every skip has a reason."
- T2 · Team HQ — "Nine on it. Four need you." — "Open workstream" — "Wren leads. Specialists report to Wren; you approve their work."
- T3 · Workstreams — "Kai · Engineering" — "Copy prompt" — "The landing page is not the product. PRD slice, then Discovery, Scaffold, Core loops, Ship."
- P1 · Pricing — "Free finishes your weekend. Pay when you scale." — "Upgrade to Starter" — "Free: one business, the full weekend launch, 50 starter credits. Starter $29/mo: 500 credits, ads, publishing, own domain. Draft."
- C · Dashboard — "5 of 8 ready. 4 need your OK." — "Open launch plan" — "Launch weekend starts tomorrow."
- D · Chat — "Tonight's one job" — "Looks good" — "Your brand kit, 4 emails, 7 posts and an ad creative are waiting on your OK."
- E · Brand kit — "HydroTrail, dressed for the trail." — "Approve" — "Drink before you're thirsty."
- F · Landing — "Plan your water. Not your worry." — "Join the waitlist" — "Added by Weekend MVP: early-access app preview and waitlist form."
- G · Email — "Your inbox, and the four emails that sell the waitlist." — "Approve all 4" — "From John at HydroTrail, team@hydrotrail.weekendmvp.app."
- H · Launch plan — "Fri 6 → Sun 8 Nov. Ship all of it." — "Approve all remaining" — "Ask Wren to fill gaps."
- Build pack — "Build the real app, one phase at a time." — "Copy prompt" — "Every prompt ends with Do not build and Done when."
- I · Social — "Seven launch posts, ready when you are." — "Connect" — "No account yet? Personal mode gives you copy-ready posts."
- J · Ads — "One campaign. $7 a day. Nothing spends yet." — "Ask Wren to fix blockers" — "14-day learning window, $98 cap."
- K · Studio — "Images and video, on brand by default." — "Upload logo" — "Make unlocks once a logo is uploaded."
- L · Outbound — "Reach hiking clubs one person at a time." — "Create a campaign" — "Three touches: Intro, Value, Last note."
- M · Files — "What Wren knows, in plain text you can edit." — "Copy" — "PRODUCT_PROMPTS.md holds the founder pack and the engineering prompts."
- M · Tasks — "5 things need you. Wren has the rest." — "Review" — "Approve weekend launch pack · Daily Briefing 9:00 AM."
- M · Settings — "How Wren works for HydroTrail." — "Check hydrotrail.app" — "Autopilot off: Wren drafts everything and asks first. Domain [PRICE]/yr."

The deck says brackets mark values that still need a real one ("no invented stats or testimonials").

### Nav and shell strings
"Search workspace", "Search", "⌘K", "Switch business. Current: HydroTrail", "APP · FREE FOR NOW", "Start a second idea", "Growth", ", needs Growth. See plans", "This weekend", "Workspace", "Subscribe", "Credits", "John / Founder", "4 need you", "5/8", "New".

### Dashboard strings
In §3. Team HQ strings in §4.

---

## 6. Visual tokens as drawn

**Colours (System token cards, 12):**

| Name | Hex | Role |
|---|---|---|
| Paper | `#f7f3ec` | page |
| Card | `#fffdf9` | surface |
| Sand | `#efe8dc` | fill, divider |
| Hairline | `#ddd4c4` | border |
| Ink | `#1a1814` | text, primary |
| Muted | `#6b6457` | secondary text |
| Ember | `#a84a00` | accent, focus |
| Ember soft | `#fbf3e8` | WMVP fill |
| Sage | `#3a5530` | success |
| Sage soft | `#dce6d5` | success fill |
| Brick | `#83382a` | danger |
| Brick soft | `#f1d9d2` | danger fill |

**Extra values used in the boards but not in the token cards:**
- `#4a453c` secondary ink (the "ink-2").
- `#cfc6b6` dashed borders and muted fills.
- `#e8cfae` ember border.
- `#e9c39a` needs-you border.
- `#f2e1b8` and `#6e5010` amber pill and low-credit text.
- `#c9962e` low-credit bar.
- `#d8e3ee` and `#2c4a68` info / working blue.
- `#b9cde0` info border.
- `#e3e0f0` and `#3d3570` lilac "Yours".
- `#24211c` dark surface (dashboard banner, build pack, Kai).
- `#f08a3e` ember on dark.
- `#3a362f` dark progress segment.
- `#e6e0d4` disabled fill.
- `#c9bfae` and `#cfc6b6` muted text on dark.
- Brand-kit art colours (HydroTrail only, Archivo font): Glacier `#1F4E5F`, Stream `#8CC2D3`, Ember `#E07B2E`, Granite `#F2EEE6`, Basalt `#13242A`. These are sample-business colours, not product tokens.

**Type:**
- Display: Newsreader 400 (italic for the emphasis tail), 26 to 56px. Seen: H1 48, section H2 32, workspace H1 26 to 46 (clamp).
- Body and UI: Geist 400/500/600, 13 to 16px. Eyebrows 11px, +0.14em, uppercase. Base 14 to 15px, line height 1.5.
- Data and prompts: Geist Mono 400/500 (times, addresses, counts, prompt bodies, 11 to 14px).
- Archivo 600/800 appears only inside the HydroTrail brand mock.

**Shape and spacing:**
- Radius: 6 chips and nav rows, 8 inputs and small cards, 12 cards, 999 pills. Also 10 on dashboard panels and 4 on tags.
- Hairline 1px `#ddd4c4`.
- Targets 38 to 44px (nav rows 36, buttons 36 to 44, inputs 40 to 44).
- Focus: 2px ember `#a84a00` outline, offset 2px.
- Shell: nav 240, canvas flex, chat 360 to 380.
- Spacing scale is not stated as a scale. Values seen: 4, 6, 8, 10, 12, 14, 16, 18, 24, 28, 44.
- Max content width 1040 (Dashboard), 1080 (Team HQ), 1280 (System).

**Light and dark:** All workspace boards are light (paper). The only dark surfaces are the "plan" banner (`#24211c`), BuildPackCard, and the PaywallModal backdrop. No dark theme is drawn.

**Conflicts with the repo `home-*` tokens:**
- The first repo tokens in `app/globals.css` match the canvas exactly: `home-paper #f7f3ec`, `home-card #fffdf9`, `home-sunk #efe8dc`, `home-ink #1a1814`, `home-ink-2 #4a453c`, `home-ink-3 #6b6457`, `home-rule #ddd4c4`, `home-orange-ink #a84a00`, `home-orange-light #f08a3e`, `home-d2 #cfc6b6`. The canvas names: Paper, Card, Sand, Ink, ink-2, Muted, Hairline, Ember, "ember on dark", dark muted.
- Not checked in depth: whether the repo has sage, brick, `#24211c`, the info blue, lilac and amber. Those need new tokens or a mapping.
- The repo's `home-orange #cc5500` is "24px+ type and graphics only"; the canvas uses `#a84a00` for small text, matching `home-orange-ink`.

---

## 7. Interaction notes

- **Landmarks and labels:**
  - Nav `aria-label="Workspace"`; chat `<aside aria-label="Co-founder chat with Wren">`; message list `role="log" aria-label="Messages"`.
  - Credits `role="meter"` with `aria-valuetext`.
  - Logo `role="img" aria-label="Weekend MVP"`.
- **Current page:** `aria-current="page"` on the active nav row. Step lists use `aria-current="step"`.
- **Employee avatars:** `role="img" aria-label="Name, Role (AI employee)"`. The "AI" micro-badge is aria-hidden.
- **Colour never alone:** status pills always carry a text label, with detail text. Meter colour is paired with text.
- **Toggles:** Autopilot, filters, tool and phase selectors, and approve/ask buttons use `aria-pressed`. The "Ask for changes" disclosure uses `aria-expanded`.
- **Live regions:**
  - `role="status"` on approval notes, filter counts, hire notes, output messages, and copy results.
  - `aria-live="polite"` on the Ask thread. Roster assembly rows use an `aria-live` list.
- **Focus management:** Wren gate H3 gets focus on open (`tabindex=-1`). PaywallModal: `role="dialog" aria-modal`, Escape closes, focus returns to the trigger, never stacked. GatedOverlay is `role="dialog"`.
- **Screen-reader text:**
  - Approve and ask buttons append " · <title>".
  - "Open workstream" appends " · Name, Role".
  - Autopilot appends " for Name, Role (on Starter)".
  - Assignee and owner chips have an sr "Owner:" prefix.
  - The nav "Start a second idea" row has an sr suffix.
- **Hidden labels:** the search and chat inputs use a visually hidden `<label>`. Icons are aria-hidden.
- **Motion:** only the spinner (1s linear) and a 0.15s background transition on buttons. Both are disabled under `prefers-reduced-motion`. Roster assembly shows all rows at once under reduced motion.
- **Keyboard:** the chat form submits on Enter or the send button (textarea, 1 row; no stated Shift+Enter rule). The ⌘K search hint is shown but no shortcut handler is drawn. Targets are 38 to 44px.
- **Sizing/responsive:** the shell wraps (flex-wrap): nav 240, main min 560, chat min 360. No explicit mobile nav is drawn (mobile treatment unknown).
- **Credit semantics:** on Free, metered or gated actions pause, never the team ("never imply the team stops on Free").
- **Approvals:** "Wren stays the only voice": specialists never message the founder directly, their work arrives as cards "From <Role> · <Name> · routed by Wren". Spend and external sends still wait for the founder's OK, even with Autopilot.

---

## 8. Open questions

1. **Cost badge on the approval card.** The task expects "the cost badge and its states". None of the six boards read draws one. Cost shows only in credit copy ("Studio Make needs 2", "Hiring Outbound costs 20 credits once", ad budget "$7/day", "$98 cap"). Needs a decision from the owner, or another board (Studio, Ads, Billing, Paywall).
2. **Kind enum mismatch.** The System card names three kinds (brand, marketing, engineering). The Workstream file defines eight (brand, landing, seo, marketing, email, social, engineering, ads). I used eight.
3. **Employee status set.** The data shape lists four statuses (queued, working, needs_you, done). Team HQ's pill map adds a fifth, `yours`. The System StatusPill list is a separate set (Live, Approved, Ready, Drafting, Yours, Blocked). "Yours" is lilac in System and brick-red in Team HQ. Output statuses are a third set (draft, ready, approved, changes_requested).
4. **Nav badges.** The badges ("4 need you", "5/8", "New") are hard-coded fixture strings. Their data source and whether "New" expires are not stated.
5. **Dead nav items.** Chat, Analytics, Products, Orders, Customers, Legal and Activity have no board and no link. Whether they ship in WP72 (as stubs or hidden) is not stated.
6. **Chat entry.** The nav has "Chat", yet the Dashboard and Team HQ show chat as a permanent right column. "Expand chat" is a button with no behaviour drawn.
7. **Business switcher.** The dropdown, the list of businesses, and "Start a second idea" gating (Growth) are not drawn beyond the button and the gate copy.
8. **Meter semantics.** Free max 50 and Starter max 500, with "50 starter credits, one-time" vs "500 refresh on the 5th". The "low" threshold is 20% (stated in the flow). Pricing is marked "Draft".
9. **Fixture-specific copy.** Employee names (Iris, Leo, Sana, Marco, Elle, Theo, Kai, Ada), the 9-person roster, "Thu 9:02 PM" times, and idea facts are HydroTrail fixtures. The roster varies by `ideaKind`: the System card lists 13 roles, 9 hired for an app.
10. **Wren thread is partly static.** Wren's reply is a stub ("Got it. I'll draft that…"). No streaming, typing, error or retry state is drawn.
11. **Dashboard numbers.** Sales, Net revenue and Payouts tiles show "$0.00" and "Payments off · free for now". Whether they are gated by idea kind or plan is not stated.
12. **Nav "THIS WEEKEND" group.** It is an ember-eyebrow group of four weekend pages. It is not stated when it disappears after launch weekend.
13. **Credit pill link target.** Dashboard header and nav both link to Billing; the board titled "Billing" was not read.

---

## 9. Orchestrator decisions for WP72 (2026-11-05)

These settle the open questions in §8 for WP72 only. These are implementation choices, not owner rulings; any one of them can change later.

1. **Cost badge.** `04` WP72 requires it, so the approval card gets a `cost` prop with three states: free (`Free`), paid (`{n} credits`), and paid but over the balance (`{n} credits · not enough`). It renders a text label every time, never colour alone. WP77/WP81 wire the value from C-JOBS `creditCostFor`.
2. **Workstream kinds.** Use the eight from the Workstream board: brand, landing, seo, marketing, email, social, engineering, ads.
3. **Status sets.** Keep three typed sets, each with its own map:
   - employee: `queued`, `working`, `needs_you`, `done`;
   - output: `draft`, `ready`, `approved`, `changes_requested`;
   - site: `live`.

   One `StatusPill` component renders any of them, always with the text label. "Yours" uses the System board colour (lilac), because System is the acceptance reference.
4. **Nav badges.** Plain props from the page's data (fixtures for now). No expiry logic.
5. **Nav entries and routes.** WP72 ships nav entries and routes only for pages that have a board:
   - Dashboard (index), Team HQ (`team`, `team/[employee]`), Launch plan (`launch`), Build pack (`build-pack`) and Brand kit (`brand`);
   - Tasks, Email, Ads, Studio, Outbound, Social, Files, Settings;
   - Billing (`billing`).

   Chat, Analytics, Products, Orders, Customers, Legal and Activity are left out of the nav until a WP designs them. Chat stays the right-hand column (WP77 adds `chat` when "Expand chat" is built).
6. **Business switcher.** A disclosure button that opens a list of the owner's businesses (fixtures for now). "Start a second idea" shows the Growth gate copy and creates nothing.
7. **Credit meter.** Props `{ balance, max, plan }`. Low at ≤ 20% of max. Zero shows "Studio extras paused · see plans". It is a typed mock until WP73's `creditsSummary`.
8. **Wren thread.** Static fixture cards in WP72. Loading, error and retry states are added to the kit even though the canvas doesn't draw them.
9. **"This weekend" group.** Shown whenever the page passes `weekendActive`; for now that is always true in fixtures.
10. **Page placeholders.** Each scaffolded page renders its heading and an empty state from the copy deck. Real content arrives in the WP that owns that page.
