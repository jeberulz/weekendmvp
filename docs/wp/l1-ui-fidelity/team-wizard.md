# UI fidelity audit: Team HQ and the onboarding wizard (incl. Meet + Team assembly)

Read-only audit, 2026-11-07. Worktree `.worktrees/l1-ui-fidelity` (branch `claude/l1-ui-fidelity`).
Boards: `TeamHQ.dc.html` (T2), `Roster.dc.html` (T4), `TeamAssembly.dc.html` (T1), `Wizard.dc.html` (B), with `System.dc.html` as the acceptance reference where boards disagree.
Built: `app/(launch-workspace)/dashboard/b/[projectId]/team/page.tsx`, `components/workspace/team/*`, `components/workspace/review/*`, `components/workspace/wizard/*`, `app/start/*`.

All paths below are relative to the worktree unless absolute.

---

## Data reality check (read this first)

What the backend gives these screens today, and what it does not. Every board element in section B is checked against this list.

| Source | Gives | Used by built code? |
|---|---|---|
| `api.workspace.reviews.pendingReviews` (`convex/workspace/reviews.ts:35`) | `{approvalId, kind (ArtifactKind), title, changeRound, expiresAt, href}[]`, pending `artifact_review` cards only | Yes, `WaitingOnYou` |
| `api.crew.roster.launchStatus` (`convex/crew/roster.ts:200`) → `LaunchView` (`lib/workspace/crew/launch.ts:94`) | `not_started` / `assembling` / `failed{paused,retryable}` / `ready{hired[{roleKey, employeeName, roleLabel, reason}], skipped[{roleKey, roleLabel, reason}]}`. The lead's `employeeName` **is the partner name** (`planRoster(..., { leadName: partnerNameFromWizard(answers) })`, `convex/crew/launchRoster.ts:159`) | Yes, `YourTeam`, `LiveTeam` |
| `api.crew.launch.launchProgress` (`convex/crew/launch.ts:688`) | `{started, retryable, steps[{key, title, state: waiting/queued/running/paused/succeeded/failed/skipped, reason?, retryable?}]}`. **No owner (employee) on a step**, and no flag telling "skipped by roster" from "not built yet" (only the reason text differs) | Yes, `LaunchProgress` |
| `api.growth.drafts.blueprint.blueprintDraft` | blueprint (pitch, oneUser, oneLoop, features, scopeCuts, validated, market?) + its review card | Yes, `BlueprintView` |
| `ROLE_CATALOGUE` (`convex/crew/roles.ts:44`, already imported client-side by `lib/workspace/routes.ts:11`) | per role: `label`, default `employeeName`, `does` (a one-line specialty), `always` | **No** |
| `ALWAYS_HIRED_ROLE_KEYS` (`lib/workspace/contracts/roster.ts:21`) | which roles are "Always" vs "Added" | **No** |
| `LAUNCH_STEPS[].employee` (`convex/crew/steps.ts:80`) | owner role of each launch step (blueprint/roster → lead, brand_kit → brand, email_sequence → email, social_pack → social, landing_spec → landing, build_pack → engineering, launch_plan → marketing, seo_pack → seo, ads_drafts → ads) | **No** (server-only) |
| `wizard getSession` → `answers.signals` (`lib/workspace/contracts/wizard.ts:262`) | per step `{signal: "kept" \| "edited", note}` with canvas wording ("Approved suggested platform: …", "Changed goal: A → B"). Crew generators read them (`lib/workspace/crew/inputs.ts:104`) | **No** (aside not built) |
| wizard answers (platform, commercialModel, goal{kind,timeframe,paidPush}, name, partnerPersonality, partnerName) | everything T1 "What I read" needs | Partly (Meet shows personality only) |
| `crew_members.status/autopilot`, `workstreams.blocker` (`convex/schema/workspace.ts:94`) | live per-employee status. **No public query exposes it.** It also leaves not-built roles (landing, seo, marketing, engineering, ads) at `queued` forever, so it would mislead if shown raw | No |

**No data at all for:** match score ("87% MATCH"), library idea number ("N°204"), subdomain availability ("…weekendmvp.app is free"), weekend dates ("Fri 6 → Sun 8 Nov"), launch plan items (`launch_plan` step is `pending_wp76`), credits/plan (billing is Coming soon), autopilot toggling (no mutation), hiring a skipped role (no mutation), "Marketing drafted it" contributors, live "Working · Drafting 12 page titles" details beyond step reasons, workstream pages (`team/[employee]` is Coming soon), chat column on Team HQ (chat lives only on the Dashboard: `app/(launch-workspace)/dashboard/b/[projectId]/page.tsx:25`).

**L1 launch steps that actually run:** blueprint, roster, brand_kit, email_sequence, social_pack. Everything else evaluates to `skipped` with "…is coming in a later update…" / "…is not built yet…" (`convex/crew/steps.ts:213`).

---

## A. Fidelity scores

| Screen | Score | Verdict |
|---|---|---|
| **T2 Team HQ** | **3 / 10** | The data plumbing is honest and accessible (live regions, focus handling, words not colour, retry/resume, blueprint review), but almost none of the board's structure or visual language is there. The board is a header with a counted serif H1, a Crew Lead card that holds the approvals, a filterable grid of employee cards, a plan-by-owner list and skipped-role cards. The built page is four stacked sans-serif sections ("Waiting on you", "Launch progress", "Your team", "Your blueprint") made of plain text rows. The kit already has `EmployeeCard`, `SkippedRoleCard`, `EmployeeAvatar` and `StatusPill`, and Team HQ uses none of them. The team list is the wizard's `CofounderTeam` text list. |
| **B Wizard steps (8)** | **3 / 10** | Tokens, fonts and the D10/D15 rules are right, and the a11y is solid. The interaction model differs: the board shows the options as large radio cards straight away, with one "Use suggested · Continue" button. The built panel shows a "Suggested" summary card with an accept button, and hides every alternative behind a "Rewrite" disclosure with a separate "Save my answer" plus a Back/Skip footer, so changing an answer takes 4 clicks instead of 2. Also missing: the top bar (logo, Save & exit), the segmented step bar with per-step labels, the back chevron, the question-as-H1 with an italic tail and a sub line, the Founder signals aside (its data exists), the persona voice preview and the rename-risk callout. The page is 720 px wide, one column; the board is 1120 px with an aside. |
| **Meet your co-founder + T1 Team assembly** | **2 / 10** | Built: a "Meet {name}, your co-founder" H2, a card with three sentences, the `CofounderTeam` text card and a "Go to your workspace" button. Board: the "Hi, I'm *Wren*." hero, a Building-now checklist, what the co-founder does, then the full T1 page: hiring status strip, "What I read" tiles, "Who I hired" rows with avatars and Always/Added reason chips, a skeleton while assembling, a "Roles I checked" chip cloud, "Not hiring, on purpose", "Meanwhile, building", and a dark "Team ready" banner with the Team HQ CTA. Almost all of T1's real content (answers, hires, skips, reasons, launch steps) has a data source and is simply not drawn. |
| **T4 Roster (idea → roster)** | **1 / 10** | Not built. It is mostly a rationale board (course contrast column, rules column, TEAM.md, Settings peek). Only the single-idea "role by role with reason" part is worth shipping in L1 (see C.1 "Why this team"). |

---

## B. Gap list (ranked)

Legend: **[no data]** = no backend source: omit, or show an honest empty / coming-soon state. **[shared]** = touches a file other screens use.

### P0: wrong product behaviour or a missing core region

**P0-1 · Team HQ has no employee grid ("The team, *by status.*")**
- Board: `TeamHQ.dc.html` section `aria-labelledby="team-h"`: eyebrow "8 specialists · hired for HydroTrail", H2 "The team, *by status.*", filter group, `ul aria-label="Specialists"` grid of article cards (avatar + AI badge, name, role, status pill with dot, specialty, status detail, blocker line, footer "Open workstream" + Autopilot).
- Built: `components/workspace/team/YourTeam.tsx:63-71` renders `CofounderTeam` (`components/workspace/wizard/MeetCofounder.tsx:162-256`): one card with "Hired" and "Skipped for now" text lists (name, role, reason). No status, no avatar, no specialty.
- Fix: new `components/workspace/team/TeamGrid.tsx` using kit `EmployeeCard` (see C.1). Per-employee status comes from a new pure `lib/workspace/teamHq.ts#employeeStatuses(launch, progress, reviews)` (rules in C.1). Specialty = `ROLE_CATALOGUE[role].does`. **Backend (additive):** add `employee: RoleKey` and `notBuilt: boolean` to each `launchProgress` step (validator `convex/crew/launch.ts:659`), so the client never has to guess owners or parse reason text. Without that change, a client copy of the step→role map is the fallback (the keys are stable).
- Honesty: hired roles whose every step is not built (landing, seo, marketing, engineering, ads in L1) must read **"Coming soon"**, never "Queued". The detail line comes from the step reason ("Landing page is coming in a later update, so nothing was written for it yet.").

**P0-2 · Team HQ has no Crew Lead card; approvals are not attributed or routed through the lead**
- Board: section `aria-labelledby="lead-h"` with a 1px ink border, the Wren avatar, eyebrow "Crew Lead · runs the team", H2 "Wren *routes every approval.*", a body line, the pill "Working · Routing 4 approvals", the "Chat stays with Wren." note, and on the right "Approvals Wren is routing" with a mono counter and rows (28 px avatar, mono "From Brand · Iris", title link, pill, actions).
- Built: `WaitingOnYou.tsx:75-94` / `:117-125`: a sans `h2` "Waiting on you" and bare card rows (title, "Change round N. Closes in 2 days.", "Review X" link). No owner, no lead.
- Fix: `components/workspace/team/LeadCard.tsx` wrapping a restyled `WaitingOnYou` list (C.1). Owner per row via `ArtifactKind → RoleKey` (blueprint/roster_plan → lead, brand_kit → brand, email_sequence → email, social_pack → social, landing_spec → landing, seo_pack → seo, launch_plan → marketing, ads_drafts → ads, build_pack → engineering), name from `launch.hired`. Lead name = `launch.hired.find(r => r.roleKey === "lead")?.employeeName`, so drop the `TEAM_PARTNER_NAME = "Your co-founder"` fallback (`lib/workspace/reviewPages.ts:93`) once ready.
- Behaviour adaptation: the board's inline "Looks good" / "Ask for changes" toggles that undo when pressed again **cannot be honest**. Decisions are final in `decideApproval`, and Ask for changes needs a note and the D17 change-round preview. Keep **one "Review" action per row** that goes to the review surface (in-page `#blueprint` anchor, or `/brand`, `/email`, `/social`). Drop the toggle and undo states.
- Chat note: the board says "The chat on the right is Crew Lead only". Team HQ has no chat column. Adapt the copy (C.1) and link to the Dashboard chat.

**P0-3 · Meet your co-founder does not show Team assembly (T1); the hired list has no reasons-as-chips, no avatars, no "What I read"**
- Board: `TeamAssembly.dc.html`, the whole page. `Wizard.dc.html` `isMeet` block ends with a dashed callout "Next: Wren hires your team." and a primary "Assemble my team" linking to T1.
- Built: `MeetCofounder.tsx:33-76` plus `CofounderTeam` (`:162-256`).
- Fix: rebuild the business-exists screen as one "Meet + assemble" screen (C.3). The team is already started automatically on mount (`LiveTeam` `useEffect`, `MeetCofounder.tsx:295-300`; ruling Q13 "the team just appears"), so the board's separate **"Assemble my team" button is dropped**: the T1 content renders inline under the hero and fills in live. Primary CTA becomes "Meet your team in Team HQ".

**P0-4 · Wizard alternatives are hidden behind "Rewrite"; the options are not the step**
- Board: `Wizard.dc.html` `isOptions`: each option is a full-width button card (min-h 64, radio dot, label + description, "Suggested" chip), then one primary "Use suggested · Continue" / "Continue".
- Built: `WizardStepPanel.tsx:625-634` ("Suggested" card + accept button), `:649-688` ("Rewrite" disclosure revealing `Editor` radio groups + "Save my answer" `:574-576`), `:700-714` (Back / "Skip for now").
- Fix: render the options inline as a radio group, preselect `answers ?? defaults`, and use one primary button (C.2). Remove the "Suggested" card, the "Rewrite" disclosure, "Keep my answer" and "Skip for now" from option steps.

**P0-5 · SMS step must stay out (D10): built correctly**
- Board: `isSms` ("Want a *text* when something needs you?", phone input, "Text me updates"). Built: absent (`WIZARD_STEPS` has 8). **Matches the ruling. Keep it out.** Every board "of 9" becomes "of 8"; the bar label "Updates" is dropped.

### P1: clear visual or structural mismatch

**P1-1 · Team HQ header**
- Board: eyebrow `Team HQ · HydroTrail` (11/500/.14em, **ember `#a84a00`**), H1 serif `clamp(34px,3.6vw,46px)` "9 on the team. *4 need you.*", summary line `#4a453c` max 620 px, right pill link "Why this team?" (min-h 44, card fill, hairline).
- Built: `team/page.tsx:23-28`: eyebrow = project name in `text-home-ink-3`, H1 "Team HQ" 34/42 px, no summary, no link.
- Fix: C.1 header. The counts come from data. "Why this team?" anchors to the in-page `#why-this-team` disclosure (there is no T4 route).

**P1-2 · Section headings are sans `text-lg font-medium`; the board uses an eyebrow + serif 26 px with an italic tail**
- Built: `WaitingOnYou.tsx:120`, `LaunchProgress.tsx:153`, `BlueprintView.tsx:116`, `YourTeam.tsx:38/46/82`.
- Fix: a local `SectionHeading` (eyebrow `EYEBROW` + `h2 className="font-editorial text-[26px] font-normal leading-tight text-home-ink"` with `<i>` tail). Copy in C.1.

**P1-3 · Launch progress is a list of "Title: State" cards; the board's "This weekend's plan, *by owner.*" rows carry an owner chip, meta and a status pill**
- Board: section `plan-h`, a `grid auto-fit minmax(330px,1fr)` of rows: title 14/500, owner chip (20 px avatar + role, sr "Owner: Name, "), meta 12 px muted, right pill with dot.
- Built: `LaunchProgress.tsx:40-54`.
- Fix: restyle as plan rows (C.1). Owner from the step's `employee` (backend additive, P0-1). Eyebrow date range **[no data]** → use the progress summary instead. "Open the full launch plan" → **drop** (`launch` is Coming soon). Keep Try again / Resume and their live regions as they are.

**P1-4 · Skipped roles: board cards vs a dashed text list**
- Board: section `skip-h`, eyebrow "Not on the team", H2 "Skipped for HydroTrail, *on purpose.*", body, a `grid auto-fit minmax(180px,1fr)` of dashed cards with a brick "**Skipped** · reason" block and a Hire button.
- Built: inside `CofounderTeam` (`MeetCofounder.tsx:229-247`).
- Fix: kit `SkippedRoleCard` **without** the Hire button **[no data: no hire mutation; credits Coming soon]**. Footnote: "Hiring a skipped role is coming soon." **[shared]** `SkippedRoleCard.onHire` must become optional (`components/workspace/kit/EmployeeCard.tsx:147-179`).

**P1-5 · Wizard page frame: no top bar, wrong width, no aside**
- Board: top bar `padding 12px 24px`: logo (`role="img" aria-label="Weekend MVP"`, 24 px ink square with italic serif "W" + serif 18 "Weekend *MVP*") and "Save & exit" (13 px muted). Container max 1120, the column 672 + aside 280–340 with a 48 px gap.
- Built: `app/start/WizardPage.tsx:10-16`: `max-w-[720px]`, no bar.
- Fix: C.2 frame. **Show "Save & exit" only when the session can be resumed.** Library sessions: link to `/ideas/{ideaSlug}` (`startOrResume` resumes by slug). Own ideas: show it only once the `?session=` URL is pinned (it is, after `startOwn`, `WizardFlow.tsx:256`), link to `/ideas`, and add a helper line under the H1 on first view: "Your answers save as you go. Bookmark this page to come back."

**P1-6 · Wizard step progress**
- Board: `ol aria-label="Onboarding steps"` grid of 9 equal segments (3 px bar, radius 2; done ink, current ember, todo hairline) with a 10 px label under each ("1 Idea", "2 Blueprint" …; current ink 600, others muted), a centred caption (System: **mono 12 px** "STEP 4 OF 10 · MODEL"), and the back chevron (44×44 icon button, `aria-label="Back to previous step"`) at the left of the caption row.
- Built: `WizardProgress.tsx:18-53`: `nav aria-label="Wizard progress"`, a mono caption "Step 3 of 8: Platform", one continuous 6 px bar, an inline flex list with checkmarks. Back is a footer button (`WizardStepPanel.tsx:701-705`).
- Fix: C.2 progress (8 segments).

**P1-7 · Wizard H1 / heading model**
- Board: H1 = the question, serif 34/1.15, −0.01em, italic key word ("What are we *building*?"), then a 16 px `#4a453c` sub line. There is no persistent page title.
- Built: `WizardFlow.tsx:345` H1 "Build {title}" on every step; `WizardStepPanel.tsx:614-622` eyebrow `STEP_TITLES` + H2 `STEP_QUESTIONS` 28/32 px, with no sub line.
- Fix: H1 per step (copy in C.2). Move the focus target (`headingRef`, `tabIndex=-1`) to the H1. Drop the eyebrow (the caption carries the step). Keep "Build {title}" in the document `<title>` only. Tests touched: `tests/platform/wp74-wizard-ui.test.tsx`, `wp74-keyboard.test.tsx`, `wp74-light-blueprint-ui.test.tsx`.

**P1-8 · Founder signals aside missing (it has data)**
- Board: `aside aria-label="Founder signals"`, card fill, radius 10, p 18: H2 serif 20 "Founder signals", mono 12 "{n} logged", sub 13 px, an empty dashed box "Signals appear as you answer.", and an `ol` of rows: a mono 11 px tag (KEPT sage / EDIT) plus the note.
- Built: none.
- Fix: C.2 aside, reading `parsed.answers.signals` in `WIZARD_STEPS` order. Tag colours per **System** (`FounderSignal`): KEPT `bg-home-sage text-home-sage-ink`, EDIT ember-soft `bg-home-ember-soft text-home-orange-ink` (the Wizard board's ochre EDIT is overridden by System).

**P1-9 · Blueprint step layout and buttons**
- Board: a dashed card (`#cfc6b6`, radius 10, padding 24/24/20), H2 serif 24 name — tagline, a description paragraph, eyebrow "What I'd build", a feature list with plus icons (`#2c4a68`), a footnote about the build pack, then a 2-column button grid: primary "Looks good" (h 48) / secondary "I'd change some things" (`aria-expanded`). Expanding reveals the "What should change?" textarea and the primary label becomes "Rework it".
- Built: `WizardStepPanel.tsx:172-204` (pitch, one user, one loop, Core features, Left out of the weekend) inside the generic Suggested card. Rework is a single-line `<input>` (`:419-431`) behind "Rework it".
- Fix: C.2 blueprint. Keep the built extra fields (they are real) and the D15 note. **Drop the MatchStamp [no data]** and the build-pack footnote (build pack is Coming soon).

**P1-10 · Meet hero copy and order**
- Board: H1 "Hi, I'm *Wren*." sub "I'm building HydroTrail right now. Here's what I do for you." → "Building now" checklist → "What Wren does for you" → "Your weekend" → callout → CTA.
- Built: eyebrow "Meet your co-founder", H2 "Meet {name}, your co-founder", a card with three sentences.
- Fix: C.3.

**P1-11 · T1 hired rows: no avatar, no Always/Added chip, no specialty, no "Stays in your chat"**
- Board: `ol aria-label="Hired specialists"`: row card radius 12, p 10/14; 40 px avatar + AI badge; "**Iris** · Brand"; lead pill "Stays in your chat" (ink fill); specialty 14 px; right chip (max-w 280, radius 999): Always (sunk fill, hairline, ink-2) / Added (ember-soft, `#e9c39a` border, ember ink), sr "Why hired: ", "**Always** · every launch needs one look".
- Built: `MeetCofounder.tsx:216-228`.
- Fix: C.3. `always` from `ALWAYS_HIRED_ROLE_KEYS`; specialty from `ROLE_CATALOGUE.does`; reason from `launch.hired[].reason`.

### P2: details

| # | Board (file · nearby copy) | Built (file:line) | Board shows | Fix |
|---|---|---|---|---|
| P2-1 | TeamHQ · filter group "Filter specialists by status" | none | Toggle pills (min-h 38, `aria-pressed`) "All 9 / Needs you / Working / Queued / Done" with mono counts; status line "Showing N of 8 specialists · Filter."; dashed empty "Nobody needs you right now. Wren will bring the next decision here." | Build it in `TeamGrid` (C.1). Counts are from derived statuses. Add a "Coming soon" filter only if ≥1 card is coming soon. |
| P2-2 | TeamHQ · employee card footer "Open workstream" | kit `EmployeeCard.tsx:86-94` | Link to the workstream | `team/[employee]` is Coming soon. Link to the built page that holds the employee's output (Brand → `brand`, Email → `email`, Social → `social`, Crew Lead → `#blueprint`) with the label "Open {Brand kit/Email/Social}"; otherwise the plain muted text "Workstream coming soon". **[shared]** EmployeeCard needs `workstream: { href: string; label: string } \| null`. |
| P2-3 | TeamHQ · Autopilot switch, footer bar "Autopilot is on Starter.", Wren gate card | kit `EmployeeCard.tsx:95-141` | Switch + lock + gate with "Use 20 credits", "See plans" | **Drop [no data]** (no autopilot mutation, billing Coming soon, no credits). **[shared]** EmployeeCard needs `autopilot` to be optional (`null` hides the switch and the hint). Keep the trust line as a plain note: "Nothing sends, posts or spends without your OK." |
| P2-4 | TeamHQ · card border when Needs you `#e9c39a` | `EmployeeCard.tsx:58` `border-home-orange-ink/30` | Ember border | Acceptable token mapping (no `#e9c39a` token). Keep. |
| P2-5 | TeamHQ · blocker line (clock) "**Waiting on Brand** · the creative needs the approved logo" | kit has it (`EmployeeCard.tsx:74-84`) | Ochre `#6e5010` line | Feed it from the step state `waiting` + reason ("Waiting on the brand kit."). `blocker.detail` = the reason. `waitingOn` needs the parent's role; if unknown, render the reason alone. **[shared]** allow `blocker: { label: string; detail?: string }`. |
| P2-6 | TeamHQ · approval row pill "Waiting on you" (ember) + meta | `WaitingOnYou.tsx:82-85` | Pill + meta | Pill: `StatusPill set="output" status="ready" label="Waiting on you"`; when `changeRound > 0`: label "Change round {n}". Meta: "Closes {expiresInWords}". Counter: mono "{n} waiting" (**not** "of 4" [no data for a fixed total]). |
| P2-7 | Wizard · option card "Suggested" chip | none (only a "Suggested" eyebrow) | Wizard board: sage "Suggested"; **System: "✓ Suggested" ember-soft/ember-ink/`#e8cfae` border** | Use System: `inline-flex items-center gap-1 rounded-full border border-home-orange-ink/30 bg-home-ember-soft px-2.5 py-0.5 text-xs text-home-orange-ink` + `Check` icon `size-3 aria-hidden`. |
| P2-8 | Wizard · option descriptions | `lib/workspace/wizard/labels.ts:51-84` | Richer copy | Adopt the board copy where it does not overclaim (C.2 table). Drop "works offline" and anything HydroTrail-specific. |
| P2-9 | Wizard · goal "By when? (optional)" pill row | `WizardStepPanel.tsx:478-484` (radio group in editor) | Pill buttons `aria-pressed`: "This weekend · Suggested", "2 weeks", "30 days", "No rush" | Inline pill radio group (C.2). Keep the built paid-test checkbox (D8, real), styled as an option card. |
| P2-10 | Wizard · name step "Or type your own", rename-risk callout, kept note | `WizardStepPanel.tsx:221-223`, `:500-524` | Input (min-h 48) + callout + "Your site will live at hydrotrail.weekendmvp.app" | Input inline. Callout: the System copy, shown whenever the selection differs from the suggested name. Kept note → **drop the "is free" claims [no data]**; use "Your web address is confirmed when you publish." (matches the Meet copy). |
| P2-11 | Wizard · persona "How I'll sound" quote card | none | Serif italic 19 sample line | Add, with generic samples (C.2), labelled "How I'll sound · example". The board's lines contain invented facts ("Three hiking subreddits…", "4 of 8 launch items…") → rewritten. |
| P2-12 | Wizard · partner name option descriptions | `WizardStepPanel.tsx:539-559` | "Small bird, big range." / "Steady and direct." / "Fits an outdoors brand." | Add descriptions. Ridge → "Grounded and calm." (the board's is idea-specific). Custom: "Another name" → input "Or type your own". |
| P2-13 | Wizard · idea step "FROM THE LIBRARY" card | `WizardStepPanel.tsx:216-219` | Dashed `#cc5500` ember-soft strip: mono "FROM THE LIBRARY", "**N°204 · title** · Health · 10 hrs. Wren starts from its research and its 4 prompts.", "Read the research" | N° **[no data]** → drop. Category and buildTime exist in `ideas/manifest.json` but `requireWizardAccess` returns only `ideaTitle` (`lib/workspace/wizard-access.ts:12`); show the title only, or extend that return (small, non-shared). Link "Read the research" → `/ideas/{slug}`. |
| P2-14 | Wizard · idea step buttons "Pick a different idea from the library", "I already run a business" | none | Two secondary pills | "Pick a different idea" → link `/ideas`. **Drop "I already run a business" [no flow]**. |
| P2-15 | T1 · "Roles I checked" chip cloud | none | 13 chips "Role · hire" (sage) / "Role · skip" (dashed) | Derivable (hired ∪ skipped = 13 roles). Build it in the T1 aside (C.3). |
| P2-16 | T1 · skeleton slots while hiring | `MeetCofounder.tsx:178-183` (spinner line) | Dashed rows with sunk circle + bars, `aria-hidden` | 3 skeleton rows while `assembling` (C.3). Keep the spinner text and the live region. |
| P2-17 | T1 · "Meanwhile, building" / Meet "Building now" | none | Animated fake checklist | Real: `launchProgress` steps that are not `notBuilt` (C.3). The fake timer is dropped. |
| P2-18 | Team HQ · blueprint section | `BlueprintView.tsx:110-122` | (not on T2) | Keep (the blueprint is reviewed here) but restyle the heading (eyebrow "From {lead} · Crew Lead", H2 "Your blueprint, *for your OK.*") and put the card in the board's dashed blueprint style. |

### P3: polish

- P3-1 · TeamHQ H1 size: built `text-[34px] sm:text-[42px]` (`team/page.tsx:25`) vs board clamp 34→46. Use `text-[clamp(34px,3.6vw,46px)] leading-[1.08]`.
- P3-2 · AI badge: board 8 px mono; kit `text-[10px]` (`EmployeeAvatar.tsx:55`). Keep 10 px (it is decorative and aria-hidden; 8 px is too small to read).
- P3-3 · Avatar initial size: board 19 px serif; kit `lg` = `size-10 text-lg` (18 px). Fine.
- P3-4 · Social avatar uses the arbitrary `bg-[#3d3570]` (`EmployeeAvatar.tsx:12`): lilac has no token (see Tokens).
- P3-5 · Wizard primary buttons: board min-h 52 (continue) / 48 (pairs), 15 px. Kit `BTN_PRIMARY` is min-h 40, 13 px. Use local overrides `min-h-[52px] text-[15px]` / `min-h-12`; do not change the kit.
- P3-6 · Goal timeframe labels: board "2 weeks / 30 days / No rush" vs built "In two weeks / In 30 days / No deadline". Either is fine; the board's are shorter for pills.
- P3-7 · T4 "Rule" column (e.g. "add if goal has a paid push"): no client source; omit.
- P3-8 · TEAM.md "Open in Files": a `roster_plan` document titled "Team" exists (`ROSTER_DOCUMENT_TITLE`, `lib/workspace/crew/launch.ts:17`). A link to `/files` from the "Why this team" disclosure is optional.

### Tokens: board hex → `home-*`

| Board hex | Token | Note |
|---|---|---|
| `#f7f3ec` | `home-paper` | |
| `#fffdf9` | `home-card` | |
| `#efe8dc` | `home-sunk` | |
| `#ddd4c4` | `home-rule` | |
| `#cfc6b6` | `home-d2` | dashed borders |
| `#1a1814` | `home-ink` | |
| `#4a453c` | `home-ink-2` | |
| `#6b6457` | `home-ink-3` | |
| `#a84a00` | `home-orange-ink` | small text, focus |
| `#cc5500` | `home-orange` | only the wizard's dashed 1 px strip border (graphic, ok) |
| `#f08a3e` | `home-orange-light` | eyebrow on the dark banner |
| `#24211c` | `home-panel` | T1 ready banner, Kai avatar |
| `#dce6d5` / `#3a5530` | `home-sage` / `home-sage-ink` | |
| `#f2e1b8` / `#6e5010` | `home-ochre` / `home-ochre-ink` | blocker line, "Not yet validated" |
| `#d8e3ee` / `#2c4a68` | `home-sky` / `home-sky-ink` | Working |
| `#f1d9d2` / `#83382a` | `home-clay` / `home-clay-ink` | Skipped block |
| `#e9c39a`, `#e8cfae` | ≈ `home-orange-ink/30` | no token; opacity mapping already used by the kit |
| `#b9cde0` | ≈ `home-sky-ink/30` | |
| `#bcd0b0` | ≈ `home-sage-ink/30` | |
| `#e4bfb4` | ≈ `home-clay-ink/30` | |
| `#f3eee4` | ≈ `home-sunk/60` | skeleton second bar |
| **`#fbf3e8`** | **none** | The canvas "Ember soft" token. The kit already hard-codes `bg-[#fbf3e8]` (`StatusPill.tsx:9,15`). **Add `--color-home-ember-soft: #fbf3e8`** to `app/globals.css` **[shared]**. It is a canvas token, so D18 allows it ("matching the canvas"). |
| **`#3d3570`, `#e3e0f0`** | **none** | Lilac (Social avatar, System "Yours"). Either add `home-lilac(-ink)` **[shared]** or map the Social avatar to an existing ink. Not needed by any Team HQ/wizard element except the Social avatar. |
| `#fcfaf6` | none | T4 table zebra only; use `home-card` / `home-paper`. |

---

## C. Implementation spec

Shared helpers available: `CARD`, `EYEBROW`, `FOCUS`, `BTN_PRIMARY`, `BTN_SECONDARY` (`components/workspace/kit/styles.ts`), `EmptyState`/`LoadingState`/`ErrorState` (`kit/states.tsx`), `EmployeeAvatar`, `StatusPill`, `EmployeeCard`, `SkippedRoleCard`, `QuietErrorBoundary`, `WhenConvexReady`. Fonts: `font-editorial` (Newsreader via `newsreaderEditorial`, already on both layouts), `font-mono` (Geist Mono).

### C.0 Shared-file changes (flag separately; other screens use these)

1. **`app/globals.css`**: add `--color-home-ember-soft: #fbf3e8;` and replace `bg-[#fbf3e8]` in `StatusPill.tsx` with `bg-home-ember-soft`. Optional: `--color-home-lilac: #e3e0f0; --color-home-lilac-ink: #3d3570;`.
2. **`components/workspace/kit/EmployeeCard.tsx`**:
   - `autopilot` becomes optional: `autopilot?: { on: boolean; available: boolean; onToggle: (id: string, next: boolean) => void } | null`. When `null`/absent, render no switch and no hint. Remove `autopilotAvailable`/`onAutopilotToggle` from the required props, or keep them optional for back-compat with the WP72 fixtures.
   - `workstream: { href: string; label: string } | null` replaces the required `workstreamHref`. `null` → `<span className="text-[13px] text-home-ink-3">Workstream coming soon</span>`.
   - `blocker?: { label: string; detail?: string }`, so a reason with no known role still renders.
   - `status` accepts the display states `coming_soon` and `failed` (see 3).
   - `SkippedRoleCard`: `onHire` optional; no button when absent.
   - Check `tests/platform/*` that render `EmployeeCard` (WP72 kit tests) and the Workstream/Dashboard fixtures.
3. **`components/workspace/kit/StatusPill.tsx`**: add `set: "step"` with the map below, and add `coming_soon` to the employee set (display only; `EMPLOYEE_STATUSES` in `types.ts` stays the 4 data statuses, plus a `TeamCardStatus = EmployeeStatus | "coming_soon" | "failed"` type):
   - waiting → "Waiting" `bg-home-sunk text-home-ink-2 border-home-rule`
   - queued → "Queued" (same)
   - running → "Working" `bg-home-sky text-home-sky-ink border-home-sky-ink/30`
   - paused → "Paused" `bg-home-ochre text-home-ochre-ink border-home-ochre-ink/30`
   - succeeded → "Done" sage
   - failed → "Failed" clay
   - skipped (notBuilt) → "Coming soon" `bg-home-sunk text-home-ink-3 border-dashed border-home-d2`
   - skipped (roster) → "Skipped" clay
4. **`MeetCofounder.tsx` `CofounderTeam`** is used by both the wizard and Team HQ (`YourTeam.tsx:63`). After this work Team HQ no longer uses it, and the wizard uses a new `TeamAssembly`. Either delete `CofounderTeam` or keep it as the failure/retry sub-view. Keep `teamAnnouncement` and `launchErrorMessage` (also imported by `LaunchProgress.tsx:11`; consider moving them to `lib/workspace/crew/launchCopy.ts`).
5. **Backend (additive, read-only)**: `launchProgress` step gains `employee: RoleKey` (from `launchStep(key).employee`) and `notBuilt: boolean` (`step.status !== "built"`). Update the validator at `convex/crew/launch.ts:659` and `LaunchProgressStep`. No new tables, no new mutations.
6. **`ArtifactReviewCard` / `LiveArtifactReview`**: **no change needed.** Team HQ keeps using them for the blueprint (`BlueprintView.tsx:91`).

### C.1 Team HQ (`/dashboard/b/[projectId]/team`)

Data hooks (all already in use, plus the additive field): `pendingReviews`, `launchStatus`, `launchProgress`, `blueprintDraft`. Keep the `WhenConvexReady` gate and the per-section `QuietErrorBoundary`s.

New pure module `lib/workspace/teamHq.ts` (unit-tested):
- `REVIEW_OWNER: Record<ArtifactKind, RoleKey>` (the map in P0-2).
- `leadName(launch)`: the lead's `employeeName`, or "Your co-founder".
- `employeeStatuses(hired, steps, reviews)` → per hired role `{ status: TeamCardStatus, detail: string, blocker?: {label, detail} }`. Rules, first match wins:
  1. a pending review whose owner is this role → `needs_you`, detail "{review.title} ready for your OK" (round > 0: "{title} · change round {n} ready for your OK");
  2. any owned step `failed` → `failed`, detail = the step reason;
  3. any owned step `paused` → `needs_you`, detail = the reason (Resume exists);
  4. any owned step `running` → `working`, detail "Writing the {step title lower-case}";
  5. any owned step `queued` → `working`, detail "Waiting for a free slot";
  6. any owned step `waiting` → `queued`, detail = "Starts after the {parent}", blocker `{label: reason}` (e.g. "Waiting on the brand kit.");
  7. every owned step `succeeded` → `done`, detail "{titles} done";
  8. every owned step `notBuilt` (or the role owns no step) → `coming_soon`, detail = the first step reason, or "Nothing to do in this beta yet." for a role with no step.
- `headCounts(statuses)` for the header and filters.

Component tree (`TeamHqPanel` order changes; `page.tsx` keeps the gate and metadata):

```
<div className="flex flex-col gap-6">
  <TeamHeader/>                      // page.tsx (server) renders eyebrow + H1 shell; counts need client data → put header inside TeamHqPanel
  <LeadCard/>                        // lead + approvals (restyled WaitingOnYou)
  <TeamGrid/>                        // "The team, by status."
  <BlueprintView/>                   // restyled heading; anchor #blueprint
  <PlanByOwner/>                     // restyled LaunchProgress
  <SkippedRoles/>                    // "Skipped for {name}, on purpose."
  <WhyThisTeam/>                     // <details id="why-this-team"> (T4 single-idea table)
</div>
```

**TeamHeader** (`flex flex-wrap items-end justify-between gap-4`)
- Left `flex-[1_1_440px]`:
  - `p` `mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-ink`: "Team HQ · {project.name}"
  - `h1` `font-editorial text-[clamp(34px,3.6vw,46px)] font-normal leading-[1.08] text-home-ink`: "{hired.length} on the team. " + `<i>` "{n} need you." / "1 needs you." / "Nobody needs you right now."
  - `p` `mt-2 max-w-[620px] text-[15px] text-home-ink-2`: "{Lead} is routing {k} review(s) / no reviews. Of {s} specialists: {a} need you, {b} working, {c} queued, {d} done, {e} coming soon. Nothing sends, posts or spends without your OK." (omit zero-count clauses except "need you").
- Right: `<a href="#why-this-team" className="inline-flex min-h-11 items-center rounded-full border border-home-rule bg-home-card px-4 text-sm text-home-ink {FOCUS}">Why this team?</a>`
- States: launch `not_started` → H1 "Team HQ", the summary `TEAM_NOT_STARTED_COPY`, no link. `assembling` → H1 "Team HQ. *Your team is on its way.*", summary "{Lead} is putting your team together. This takes about a minute." `failed` → H1 "Team HQ", and the summary points to Try again in the lead card.

**LeadCard**: `<section aria-labelledby="lead-h" className="flex flex-wrap gap-x-7 gap-y-5 rounded-xl border border-home-ink bg-home-card px-5 py-[18px]">`
- Left `flex flex-[1_1_260px] flex-col gap-2.5`:
  - row `flex items-center gap-3`: `EmployeeAvatar name={lead} role="lead" size="lg" showAiBadge`; text: `p` EYEBROW "Crew Lead · runs the team"; `h2#lead-h` `font-editorial text-[22px] font-normal leading-tight` "{Lead} " + `<i>routes every approval.</i>`
  - `p text-sm text-home-ink-2`: "Sets the order, routes approvals, brings you one decision at a time. Specialists never message you directly: their work reaches you as review cards from {Lead}."
  - `StatusPill set="employee" status="working" label=` "Working · Routing {k} review(s)" (k > 0) or `status="done" label="All reviews routed"` (k = 0). Before ready: `label="Working · Putting your team together"`.
  - note `flex items-start gap-2 rounded-lg bg-home-sunk px-3 py-2.5 text-[13px] text-home-ink-2`: `MessageSquare` (lucide, `size-4 mt-0.5 aria-hidden`) + "**Chat stays with {Lead}.** Ask {Lead} anything in your Dashboard chat and it brings in the right specialist." + `<Link href={workspacePath(projectId)}>` on "Dashboard chat" (`underline underline-offset-2 text-home-ink {FOCUS}`).
  - Team retry (from today's `YourTeam`): when launch `failed`, render the failure copy + Try again button here (same `retryLaunch` logic, `aria-describedby`, focus-to-heading).
- Right `flex min-w-0 flex-[2_1_400px] flex-col gap-2`:
  - header `flex items-baseline justify-between gap-2`: `h3#appr-h text-[15px] font-semibold` "Reviews {Lead} is routing"; `span font-mono text-xs text-home-ink-3` "{k} waiting".
  - `ul aria-labelledby="appr-h" className="rounded-[10px] border border-home-rule"`; each `li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-home-sunk px-3 py-2.5 last:border-b-0"`:
    - `EmployeeAvatar size="md"` for the owner (decorative here: wrap the label in the mono line and set the avatar `aria-hidden` via a new `decorative` prop, or accept the duplicate announcement);
    - `span flex min-w-0 flex-[1_1_180px] flex-col`: `span font-mono text-[11px] tracking-[0.06em] text-home-ink-3` "From {RoleLabel} · {Name}"; `span` title `text-sm font-medium text-home-ink` + `StatusPill set="output" status="ready" label="Waiting on you" | "Change round {n}"`; `span text-[13px] text-home-ink-3` "Closes {expiresInWords}".
    - action: `Link className={BTN_PRIMARY}` "Review<span class=sr-only> {title}</span>" → `review.href`; blueprint → `#blueprint` (keep `BlueprintLinkChecked` behaviour, `WaitingOnYou.tsx:59-73`).
  - empty: `p className="rounded-[10px] border border-dashed border-home-d2 px-3 py-4 text-sm text-home-ink-2"` "Nothing is waiting on you right now." (`WAITING_EMPTY_COPY`).
  - loading / error: the existing `LoadingState` / `ErrorState` copies.
  - Keep `useNow()` expiry filtering.
  - Drop: per-row "Looks good" / "Ask for changes" toggles and their undo; the `apprNote` messages.

**TeamGrid**: `<section aria-labelledby="team-h" className="flex flex-col gap-3">`
- header `flex flex-wrap items-end justify-between gap-3`: `p` EYEBROW "{s} specialists · hired for {project.name}"; `h2#team-h` `font-editorial text-[26px] font-normal` "The team, <i>by status.</i>"; filter `div role="group" aria-label="Filter specialists by status" className="flex flex-wrap gap-1.5"` of `button aria-pressed` `min-h-[38px] rounded-full border px-3.5 text-[13px] font-medium {FOCUS}`: on `border-home-ink bg-home-ink text-home-card`, off `border-home-rule bg-home-card text-home-ink`, label + `<span className="font-mono font-normal">{count}</span>`. Filters: All, Needs you, Working, Queued, Done, + "Coming soon" when > 0.
- `p role="status" className="text-[13px] text-home-ink-3"`: "Showing {n} of {s} specialists." / "… · {Filter}."
- `ul aria-label="Specialists" className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3.5"` of `EmployeeCard` (hired minus lead): `specialty = ROLE_CATALOGUE.does`, `status/statusDetail/blocker` from `employeeStatuses`, `autopilot={null}`, `workstream` per P2-2, `linkComponent={Link}`.
- empty filter: `EmptyState` "Nobody needs you right now. {Lead} will bring the next decision here." (Needs you) or "No one is {filter lower} right now."
- footer note `rounded-[10px] bg-home-sunk px-3.5 py-2.5 text-[13px] text-home-ink-2`: "**Specialists draft; you decide.** Nothing sends, posts or spends without your OK."
- Not-ready states: `assembling` → 3 skeleton cards (`aria-hidden`, dashed `border-home-rule`, `bg-home-sunk` circle + bars) + the existing loading copy; `not_started` → `EmptyState` `TEAM_NOT_STARTED_COPY`.

**BlueprintView** (restyle only): heading block = EYEBROW "From {Lead} · Crew Lead" + `h2#your-blueprint font-editorial text-[26px] font-normal` "Your blueprint, <i>for your OK.</i>". Card: `rounded-[10px] border border-dashed border-home-d2 bg-home-card px-6 pb-5 pt-6`. Pitch in `font-editorial text-xl`. Features as a list with `Plus` (lucide, `size-4 text-home-sky-ink aria-hidden`). Keep the "Not yet validated" chip + meaning for an own idea (D15); market blocks render only when present (library).

**PlanByOwner** (restyled `LaunchProgress`): `<section aria-labelledby="launch-progress-title">`
- EYEBROW: `progressSummary(...)` (e.g. "3 of 5 steps done. 6 coming later.") (rename "skipped for now" → "coming later" for not-built steps once `notBuilt` exists).
- `h2#launch-progress-title tabIndex={-1} font-editorial text-[26px]` "Launch steps, <i>by owner.</i>"
- `ul aria-label="Launch steps and owners" className="grid grid-cols-[repeat(auto-fit,minmax(330px,1fr))] gap-2"`; row `li className="flex items-center gap-2.5 rounded-[10px] border border-home-rule bg-home-card px-3 py-2.5"`:
  - `span flex min-w-0 flex-auto flex-col gap-1`: title `text-sm font-medium`; meta row `flex flex-wrap items-center gap-1.5`: owner chip `inline-flex items-center gap-1.5 rounded-full border border-home-rule py-px pl-0.5 pr-2 text-xs text-home-ink` (`EmployeeAvatar size="sm"`, sr "Owner: {Name}, ", visible role label) + reason `text-xs text-home-ink-3`;
  - right `StatusPill set="step"`.
- Order: not-built rows last, or collapsed under `<details><summary>Coming later ({n})</summary>`.
- Keep Try again / Resume, `TRY_COST_COPY`, both live regions and the alert exactly as built (`LaunchProgress.tsx:99-141`).
- Drop: the date eyebrow [no data], "Open the full launch plan" (Coming soon), the "Marketing drafted it" contributor chip [no data], the "Yours" rows (first share) [no data].

**SkippedRoles**: `<section aria-labelledby="skip-h">` EYEBROW "Not on the team"; `h2#skip-h font-editorial text-[26px]` "Skipped for {project.name}, <i>on purpose.</i>"; `p mt-1 text-sm text-home-ink-2` "{Lead} left these out for now. Each one says why."; `ul aria-label="Skipped roles" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5"` of `SkippedRoleCard` (no `onHire`); footnote `text-[13px] text-home-ink-3` "Hiring a skipped role is coming soon." Hidden when `skipped.length === 0`.

**WhyThisTeam** (the T4 single-idea version): `<details id="why-this-team" className="rounded-xl border border-home-rule bg-home-card">` `<summary className="cursor-pointer px-5 py-4 font-editorial text-xl {FOCUS}">Why this team?</summary>` → `table` with caption (sr-only) "Each role, whether it was hired or skipped, and why"; columns Role (`th scope=row`), Decision (pill: "Hired · always" sage, "Added" ember-soft, "Skipped" sunk), Why (reason). All 13 roles from hired ∪ skipped. Header link target opens it (`onClick` sets `open`, or use `:target`). Drop: the course contrast column, the Rule column, the Settings peek, the TEAM.md preview.

A11y: one H1; section H2s; card H3s (kit). Status words are always text. Filter `aria-pressed`. Status lines `role="status"`. All targets ≥ 38 px (filters) / 40 px (buttons). Focus `FOCUS`. Run `a11y-check`.

### C.2 Onboarding wizard (`/start/[ideaSlug]`, `/start/own`)

**Frame** (`app/start/WizardPage.tsx`, not shared)
```
<div theme-desk min-h-dvh bg-home-paper>
  <header className="flex items-center justify-between gap-4 px-6 py-3">
    <div role="img" aria-label="Weekend MVP" className="flex items-center gap-2">
       <span aria-hidden className="flex size-6 items-center justify-center rounded-[5px] bg-home-ink font-editorial text-[15px] italic text-home-card">W</span>
       <span aria-hidden className="font-editorial text-lg">Weekend <i>MVP</i></span></div>
    <Link className="text-[13px] text-home-ink-3 underline-offset-2 hover:underline {FOCUS}">Save &amp; exit</Link>   // see P1-5
  </header>
  <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1120px] px-6 pb-16 pt-2 focus:outline-none">
    <WizardFlow/>
  </main>
</div>
```
Save & exit target: library → `/ideas/{ideaSlug}`; own idea with a session → `/ideas` (helper line under the H1 on the first own-idea step: "Your answers save as you go. Bookmark this page to come back."); after the business exists → `workspacePath(projectId)` with label "Go to your workspace".

**Progress** (`WizardProgress.tsx`), centred `mx-auto max-w-[672px]`
- `ol aria-label="Onboarding steps" className="grid grid-cols-8 gap-1.5"`; `li aria-current={current ? "step" : undefined} className="flex flex-col gap-[5px]"`:
  - bar `span aria-hidden className="h-[3px] rounded-sm"` + `bg-home-ink` (done) / `bg-home-orange-ink` (current) / `bg-home-rule` (todo);
  - label `span className="text-[10px] leading-tight"` + `font-semibold text-home-ink` (current) / `text-home-ink-3`: `<span aria-hidden>{n} </span>{short}` + sr " (done)" / " (current step)".
  - short labels: Idea, Blueprint, Platform, Model, Goal, Name, Personality, Lead name.
- caption row `relative flex min-h-11 items-center justify-center`: back `button aria-label="Back to previous step" className="absolute -left-3 flex size-11 items-center justify-center text-home-ink-2 {FOCUS}"` with `ChevronLeft size-[18px] aria-hidden` (hidden on step 1; calls `goBack`; `aria-disabled` while pending); caption `p aria-live="polite" className="font-mono text-xs uppercase text-home-ink-3"` "Step 3 of 8 · Platform" / "All 8 steps done" / "Meet your co-founder".
- Remove the `nav` wrapper (an `ol` with a label is enough; avoids an extra landmark) and the continuous bar.

**Body grid**: `div className="mt-14 flex flex-wrap items-start gap-12"`
- main `div className="flex min-w-0 flex-[999_1_560px] justify-center"` > `section aria-labelledby className="flex w-full max-w-[672px] flex-col gap-6"`
- aside `aside aria-label="Founder signals" className="flex-[1_1_280px] max-w-[340px] rounded-[10px] border border-home-rule bg-home-card p-[18px]"`

**Step head** (every step): `div` > `h1 ref={headingRef} tabIndex={-1} className="font-editorial text-[34px] font-normal leading-[1.15] tracking-[-0.01em] text-home-ink focus:outline-none"` + `p className="mt-2 text-base text-home-ink-2"`.

| Step | H1 (italic part in `<i>`) | Sub |
|---|---|---|
| idea | What are we *building*? | One sentence is plenty. I'll suggest everything else. |
| blueprint | Here's how I'd *build* it. | Skim it. If something's off, tell me and I'll rework it right here. |
| platform | Where should it *live* first? | Pick what you can ship this weekend. Native apps can come later. |
| commercial_model | How will it *make money*? | Free for now keeps checkout out of launch weekend. Switch anytime. |
| goal | What's the *first* win? | One number every launch task aims at. |
| name | What do we *call* it? | A name is pre-selected. Alternatives are there if you want them. |
| partner_personality | How should your co-founder *work*? | This sets the tone and how often I nudge you. |
| partner_name | Name your *co-founder*. | Pick one or type your own. |
| (all done) | Create *{name}*. | Your answers are saved. Create the business to meet {partner}, your co-founder. |

(Replace `STEP_QUESTIONS` in `lib/workspace/wizard/labels.ts:28` or add `STEP_HEADS`. The tests assert the current strings.)

**Option card** (platform, model, goal, name, personality, partner name), as a fieldset:
```
<fieldset className="flex flex-col gap-2.5"><legend className="sr-only">{STEP_TITLES[step]}</legend>
  <label className="flex min-h-16 w-full cursor-pointer items-center gap-3.5 rounded-[10px] border border-home-rule bg-home-card px-4 py-3.5 text-[15px] text-home-ink has-[:checked]:border-[1.5px] has-[:checked]:border-home-ink has-[:checked]:bg-home-sunk has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-home-orange-ink">
    <input type="radio" className="peer sr-only" …/>
    <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-home-ink"><span className="size-2.5 rounded-full peer-checked:bg-home-ink"/></span>   // use group-has-[:checked] if peer can't reach
    <span className="flex flex-auto flex-col"><span className="font-medium">{label}</span><span className="text-sm text-home-ink-2">{desc}</span></span>
    {suggested && <SuggestedChip/>}   // System style, P2-7
  </label>
</fieldset>
```
Primary: `button className="{BTN_PRIMARY} min-h-[52px] w-full text-[15px]"`: "Use suggested · Continue" when the selection equals the default (calls `onAccept`), else "Continue" (calls `onChoose(answer)` or `onRewrite(text)` for free text). `aria-disabled` while pending; status "Saving…" stays in the sr live region; errors stay `role="alert"` (`WizardStepPanel.tsx:690-698`).

Option copy (board, honest edits):

| Option | Label | Description |
|---|---|---|
| platform.web | Mobile web, installable | Works on any phone and adds to the home screen. Ships this weekend. |
| platform.native | iOS + Android | App-store apps. Review queues add days, not hours. |
| platform.custom | Something else | Desktop tool, browser extension, API. Tell me. (reveals the input "Describe the platform") |
| model.free | Free for now | Grow a waitlist and real users first. No payments to set up. |
| model.freemium | Freemium | A free core, with paid extras. |
| model.subscription | Subscription | A monthly plan from day one. Adds checkout to the launch. |
| model.one_time | One-time price | People pay once. |
| goal.waitlist | First 50 waitlist signups | Right for a free app. |
| goal.first_sale | First sale | One paying customer. |
| goal.mrr_500 | $500 a month | A real side income. |
| goal.replace_income | Replace my income | The long game. |
| goal.just_testing | Just testing | See if anyone cares. |
| persona.hustler | Hustler | Fast, pushes for the next share and the next signup. |
| persona.strategist | Strategist | Calm, explains the why, one priority at a time. |
| persona.creative | Creative | Leads with brand, story and content ideas. |
| persona.operator | Operator | Checklists, deadlines, nothing slips. |
| partner.Wren / Juno / Ridge | Wren / Juno / Ridge | Small bird, big range. / Steady and direct. / Grounded and calm. |

**Per-step extras**
- *idea (library)*: a card `rounded-[10px] border border-home-rule bg-home-card px-[18px] py-4`: row EYEBROW "Your idea" + SuggestedChip "Suggested · from the idea you picked"; `p font-editorial text-xl leading-[1.45]` = idea title. Strip `flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-home-orange bg-home-ember-soft px-4 py-3`: `span font-mono text-[11px] font-medium tracking-[0.08em] text-home-orange-ink` "FROM THE LIBRARY"; `span text-sm flex-[1_1_240px]` "**{title}**. {Partner|Your co-founder} starts from its research and its 4 build prompts."; `Link href=/ideas/{slug} className="text-sm text-home-orange-ink underline"` "Read the research". Secondary row: `Link className={BTN_SECONDARY + " min-h-11 text-sm font-normal"} href="/ideas"` "Pick a different idea from the library"; disclosure `button aria-expanded` "Write my own idea instead" → the existing own-idea field (hint "It gets a light blueprint, marked "Not yet validated".") + "Use my idea" (calls `onRewrite`). Primary: "Use this idea · Continue".
- *idea (own)*: the textarea is the step: `label` EYEBROW "Your idea", `textarea rows=3` `font-editorial text-xl` borderless inside the card, limit hint; primary "Continue". (The `OwnIdeaStart` screen in `WizardFlow.tsx:104-161` gets the same H1 "What are we *building*?" and card.)
- *blueprint*: dashed card (C.1 BlueprintView style) with: the "Not yet validated" chip + meaning (own, D15, keep `NotValidatedNote`); `h2 font-editorial text-2xl` idea title (library) or "Your idea" (own); `p text-home-ink-2` pitch; EYEBROW "What I'd build" + features with `Plus` icons; "Who it is for", "The one loop", "Left out on purpose" as built. Below: `div className="grid grid-cols-2 gap-2"`: primary "Looks good" (`min-h-12 text-[15px]`, `aria-describedby` the D15 note) / secondary "I'd change some things" (`aria-expanded`, `aria-controls`). Open → `label "What should change?"` + `textarea rows=3 placeholder="e.g. Drop one feature, add another"` (limit `WIZARD_LIMITS.reworkNotes`), and the primary label becomes "Rework it" (submits `onRewrite`). Escape closes and returns focus (keep the built behaviour).
- *goal*: the goal options, then `p text-sm font-medium` "By when? <span text-home-ink-3 font-normal>(optional)</span>" + `div role="radiogroup" aria-label="By when"` of pill radios `min-h-11 rounded-full border px-4 text-sm` (checked: `border-[1.5px] border-home-ink bg-home-sunk`) "This weekend · Suggested", "2 weeks", "30 days", "No rush"; then the paid test as an option-card checkbox: "Add a $7 a day paid test" / "Your own ad budget. Nothing runs without your approval."
- *name*: `suggestedNames` as option cards (description: none, or "Also suggested" for alternatives); then `label "Or type your own"` + `input min-h-12 rounded-lg border border-home-rule bg-home-card px-3.5 text-base {FOCUS}` placeholder "Name your business"; callout `div role="note" className="rounded-lg border border-home-orange-ink/30 bg-home-ember-soft px-4 py-3.5 text-[13px] text-home-ink-2"` "**Renaming later costs links.** Pick now; the site, email and brand kit use it." (shown when the selection differs from the default); otherwise `p text-sm text-home-sage-ink` "Your web address is confirmed when you publish."
- *partner_personality*: options + card `rounded-[10px] border border-home-rule bg-home-card px-[18px] py-4`: EYEBROW "How I'll sound · example" + `p font-editorial text-[19px] italic` with the sample for the current selection:
  - hustler "Your brand kit is ready. Approve it tonight and I'll get the emails moving."
  - strategist "Today's one priority: approve the brand kit, so your emails and posts can use it."
  - creative "I drafted a few hero lines. Want to pick the voice together?"
  - operator "Next up: brand kit approval. Then the emails, then the posts."
- *partner_name*: options + an "Or type your own" input (custom name; calls `onRewrite`).

**Founder signals aside**
- `div flex items-baseline justify-between gap-2`: `h2 font-editorial text-xl font-normal` "Founder signals"; `span font-mono text-xs text-home-ink-3` "{n} logged".
- `p mt-1.5 mb-3.5 text-[13px] text-home-ink-3` "What you kept and changed. Your team reads these when it drafts."
- empty: `p className="rounded-md border border-dashed border-home-rule p-3 text-sm text-home-ink-3"` "Signals appear as you answer."
- `ol className="flex flex-col gap-2.5"`; `li className="flex gap-2.5 text-sm"`: tag `span className="h-fit shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]"` + KEPT `bg-home-sage text-home-sage-ink` / EDIT `bg-home-ember-soft text-home-orange-ink`; text = `signal.note`.
- Below 900 px the aside wraps under the main column (flex-wrap). Fine.

**Create my business** (built screen, between step 8 and Meet; no board): keep the behaviour, apply the step-head style above, primary `min-h-[52px] w-full`.

### C.3 Meet your co-founder + Team assembly (business exists)

The container widens to `max-w-[1180px]` for this view. The wizard progress shows all 8 done with the caption "Meet your co-founder".

```
<section aria-labelledby="meet-h" className="flex flex-col gap-6">
  <div className="flex max-w-[760px] flex-col gap-2.5">
    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-ink">Meet your co-founder · your workspace is building</p>
    <h1 id="meet-h" ref tabIndex={-1} className="font-editorial text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">Hi, I'm <i>{partner}</i>.</h1>
    <p className="text-base text-home-ink-2">I'm your Crew Lead for {business.name}. I read your answers, pick the specialists it needs and skip the ones it doesn't. I stay in your chat; the team sends its work through me, one decision at a time.</p>
    <p className="text-[13px] text-home-ink-3">Suggested web address: <span className="font-mono text-home-ink">{slug}.weekendmvp.app</span>. It is confirmed when you publish.</p>
  </div>

  <StatusStrip/>   // card: rounded-xl border bg-home-card px-4 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-3.5
  <div className="flex flex-wrap items-start gap-6">
    <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">  <WhatIRead/> <WhoIHired/> <ReadyBanner/> </div>
    <aside aria-label="How {partner} chose" className="flex max-w-[380px] flex-[1_1_320px] flex-col gap-5"> <RolesChecked/> <NotHiring/> <MeanwhileBuilding/> </aside>
  </div>
</section>
```

**StatusStrip**: `ol aria-label="Hiring steps"` of two real stages ("Reading your answers", "Picking your team"), each with a state icon (done: `size-5 rounded-full bg-home-sage-ink` + `Check size-3 text-home-card`; active: `Loader2 size-4 animate-spin text-home-orange-ink motion-reduce:animate-none`) + sr "(done)/(in progress)". `p role="status" aria-live="polite" className="flex-[1_1_260px] text-sm text-home-ink-2"` = `teamAnnouncement(...)` (assembling: "{partner} is putting your team together. This takes about a minute."; ready: "Your team is ready: {h} hired, {s} skipped for now."). On failure, this strip holds the failure copy + Try again (the `CofounderTeam` failure logic, `MeetCofounder.tsx:155-209`, unchanged in behaviour). **Drop "Show all now" / "Replay"** (no fake timeline).

**WhatIRead** (from `parsed.answers`): `section aria-labelledby="read-h" className="{CARD} px-[18px] py-4"`: header `h2#read-h font-editorial text-xl font-normal` "What I read" + `span font-mono text-xs text-home-ink-3` "Your wizard answers" (+ " + library research" for a library idea); `dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5"` of tiles `div rounded-lg border border-home-sunk bg-home-card px-3 py-2.5` (`dt` EYEBROW; `dd mt-1 flex flex-col` `span font-semibold` value + `span text-[13px] text-home-ink-3` detail):
- Idea: "Library idea" + title | "Your own idea" + "Not yet validated"
- Money: `COMMERCIAL_MODEL_OPTIONS[m].label` + hint
- First goal: `GOAL_KIND_OPTIONS[g.kind].label` + `GOAL_TIMEFRAME_OPTIONS[g.timeframe].label` (+ ", $7/day paid test")
- Platform: `PLATFORM_OPTIONS[p.kind].label` | "Custom" + description

**WhoIHired**: `section aria-labelledby="hire-h" className="flex flex-col gap-2.5"`: `h2#hire-h font-editorial text-2xl font-normal` "Who I hired" + `span font-mono text-[13px] text-home-ink-2` "Hired · {h}".
- `ol aria-label="Hired specialists" className="flex flex-col gap-2"`; `li className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-xl border bg-home-card px-3.5 py-2.5"` (`border-home-ink` for the lead, else `border-home-rule`):
  - `EmployeeAvatar size="lg" showAiBadge`;
  - `span flex min-w-0 flex-[1_1_260px] flex-col`: `span` "**{name}** <span text-home-ink-2>· {roleLabel}</span>" + lead pill `ml-1.5 rounded-full bg-home-ink px-2 py-px text-xs text-home-card` "Stays in your chat"; `span text-sm text-home-ink-2` `ROLE_CATALOGUE.does`;
  - chip `span className="max-w-[280px] rounded-full border px-2.5 py-1 text-xs leading-snug"`: Always → `border-home-rule bg-home-sunk text-home-ink-2`; Added → `border-home-orange-ink/30 bg-home-ember-soft text-home-orange-ink`; content `<span class=sr-only>Why hired: </span><b className="font-semibold">Always|Added</b> · {reason}`.
- While assembling: `p text-sm text-home-ink-3` "Specialists appear here once I've checked every role." + 3 skeleton rows `aria-hidden` (`border border-dashed border-home-rule rounded-xl px-3.5 py-2.5 flex items-center gap-3.5`; circle `size-10 rounded-full bg-home-sunk`; bars `h-2.5 w-36 rounded bg-home-sunk` / `h-2 w-3/5 rounded bg-home-sunk/60`).
- Motion: none needed (rows arrive with data). If rows animate in, gate it with `motion-safe:` and keep them visible without it.

**ReadyBanner** (ready only): `section aria-labelledby="ready-h" className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-home-panel px-6 py-[22px] text-home-card"`:
- `p text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-light` "Team ready · {h} hired · {s} skipped"
- `h2#ready-h font-editorial text-[26px] font-normal leading-tight` "They start now. <i className="text-home-d2">I keep the chat.</i>"
- `p text-sm text-home-d2` "Specialists work in parallel and send their work to me. I bring it to you one card at a time. Nothing sends, posts or spends without your OK."
- actions: `Link href={workspacePath(id,"team")} className="inline-flex min-h-12 items-center rounded-full bg-home-card px-[22px] font-medium text-home-ink {FOCUS}"` "Meet your team in Team HQ"; `Link href={workspacePath(id)} className="inline-flex min-h-11 items-center text-sm text-home-card underline underline-offset-2 {FOCUS}"` "Go to your workspace".
- Not ready: `p className="rounded-xl border border-dashed border-home-d2 px-[18px] py-4 text-sm text-home-ink-2"` "Your workspace is ready now. Team HQ fills in as I hire." + the same two links (the workspace link must always be there; current guarantee at `MeetCofounder.tsx:65-73`).

**RolesChecked** (aside): `section {CARD} px-[18px] py-4`: `h2 font-editorial text-xl` "Roles I checked"; `p text-sm text-home-ink-2` "{h} fit {business}. {s} don't, and I say why." (assembling: "Checking 13 roles against your answers…" + spinner); `ul aria-label="Roles checked" className="flex flex-wrap gap-1.5"` chips `rounded-full px-2.5 py-[3px] text-xs`: hire `border border-home-sage-ink/30 bg-home-sage text-home-sage-ink` "{Role} · hire"; skip `border border-dashed border-home-ink-3 bg-home-sunk text-home-ink-2` "{Role} · skip".

**NotHiring** (aside): `h2 font-editorial text-xl` "Not hiring, on purpose"; empty (assembling) dashed `p` "After hiring, I'll list the roles I'm leaving out and why."; `ul aria-label="Skipped roles"` rows `flex items-start gap-3 rounded-xl border border-home-rule bg-home-card px-3.5 py-3`: `span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-home-ink-3 font-editorial text-[15px] text-home-ink-2"` initial; `b font-semibold` role; block `rounded-[10px] bg-home-clay px-2.5 py-1 text-xs leading-snug text-home-clay-ink` "**Skipped** · {reason}". Foot `text-[13px] text-home-ink-3` "Hiring a skipped role is coming soon."

**MeanwhileBuilding** (aside): `section aria-labelledby="bg-h" className="flex flex-col gap-2.5 border-t border-home-rule pt-3.5"`: `h2#bg-h` EYEBROW "Meanwhile, building"; `ul className="flex flex-col gap-2 text-sm"` from `launchProgress` steps with `notBuilt === false`: icon (done sage check / running spinner / other `size-4 rounded-full border border-home-d2`) + title + sr state; `text-home-ink` for done/active, `text-home-ink-3` otherwise. Under it `p text-[13px] text-home-ink-3` "{titles of notBuilt steps} are coming in a later update." and "This can take a few minutes. You can head into your workspace now; I'll keep going." Loading → `LoadingState`; error → quiet fallback "Progress shows in Team HQ."

Drop from the Meet board: "What Wren does for you" bullets about the site and the build pack, "Your weekend" (Tonight/Saturday/Sunday), the "Next: Wren hires your team" callout and the "Assemble my team" button (see D). Optional honest replacement for the bullets, placed under the hero: `ul` "Drafts your brand kit, launch emails and posts. Nothing sends without your OK." · "Brings you one decision at a time, as review cards in your chat." · "Reworks anything you ask, with two free change rounds per piece." (D17).

---

## D. Drop or defer for L1

| Board element | Board | Why |
|---|---|---|
| SMS step, phone input, "Text me updates", "Reply STOP anytime", bar "Updates", "9 steps" | Wizard `isSms` | D10: no SMS, no phone numbers. Already absent; keep it out and count 8. |
| "87% MATCH" stamp | Wizard blueprint; System `BlueprintCard + MatchStamp` | No match score anywhere in the data. An invented metric. |
| "N°204", "Health · 10 hrs" | Wizard idea strip; T1 "library N°204" | No idea number. Category and build time exist in the manifest but are not passed to the wizard; optional later. |
| "…weekendmvp.app is free" | Wizard name options, kept note | No availability check; the slug is confirmed at publish. |
| "I already run a business" | Wizard idea step | No flow behind it. |
| "Also in your build pack: phased prompts…" footnote; Meet bullet "Writes your product build pack" | Wizard blueprint / Meet | Build pack is Coming soon. |
| "Builds and edits your site whenever you ask"; "Your site is live"; "Deploying can take a few minutes"; "Your weekend" Tonight/Saturday/Sunday | Wizard Meet; T1 "Meanwhile, building" | No landing page or deploy in L1 (`landing_spec` is not built); weekend dates have no source. Use real launch steps instead. |
| Fake timed checklists, "Show all now" / "Replay" | Wizard Meet tick; T1 `tick` timeline | Simulated progress. Show real `launchStatus` / `launchProgress` states. |
| "Assemble my team" button + "Next: Wren hires your team" callout | Wizard Meet | The team starts automatically and "just appears" (Q13); T1 renders inline. |
| Autopilot switch, lock, "Autopilot is on Starter" bar, autopilot gate | TeamHQ cards, footer, gate | No autopilot mutation; plans and billing are Coming soon; "Starter" is only a descriptor (WP67 D1). |
| "Hire" on skipped roles, "Hiring X costs 20 credits once", "Use 20 credits · N left", "See plans", the `credits: 48` state | TeamHQ skipped + gate | No hire mutation; no credit balance while billing is Coming soon (no fake balance). |
| Inline "Looks good" / "Ask for changes" toggles with undo, `apprNote` messages | TeamHQ approvals | Decisions are final; changes need a note and the D17 round preview. Keep a Review link to the real review card. |
| "N of 4 waiting" fixed total | TeamHQ counter | No fixed total; show "{n} waiting". |
| "Open workstream" to a workstream page | TeamHQ cards | `team/[employee]` is Coming soon; link to the built output page or say "Workstream coming soon". |
| "This weekend's plan" rows "First share · waitlist live", "Product prompt pack downloaded", "3 offer images", "1 ad creative", "Marketing drafted it", "Fri 6 → Sun 8 Nov", "Open the full launch plan" | TeamHQ plan | No launch-plan items (`launch_plan` is pending WP76); the launch page is Coming soon. Replaced by launch steps by owner. |
| Live status details like "Drafting 12 page titles", "Site live Thu 9:14 PM", "finishing offer images (2 of 3)" | TeamHQ fixtures | Not in the data; use the step reasons and derived details. |
| Chat column on Team HQ and "The chat on the right" | TeamHQ `dc-import Chat` | Chat ships only on the Dashboard in L1 (shell scope); the lead card links there. |
| T4 course contrast column, Rule column, Settings › Your team peek (Remove / Hire / Change weight), TEAM.md preview | Roster board | A rationale board; Settings is Coming soon and there are no roster-edit mutations. Ship only the single-idea "Why this team?" table. |
| Persona voice lines with invented facts | Wizard `voices` | Replaced by generic example lines labelled as examples. |
| "Change it in Settings later" | Wizard persona sub | Settings is Coming soon. |

---

### Already matching (keep)

- D10 (no SMS step) and D15 ("Not yet validated" chip + meaning, no market blocks for own ideas) in both the wizard and Team HQ (`WizardStepPanel.tsx:134-157`, `BlueprintView.tsx:55-62`).
- `ArtifactReviewCard` flow for the blueprint on Team HQ (focus, live region, the D17 change-round preview via `previewChangeRound`).
- Retry/Resume semantics, plain-word refusals, `aria-disabled` pending buttons, focus-to-heading after a button unmounts (`LaunchProgress.tsx`, `CofounderTeam`).
- Kit `EmployeeCard` visuals already match the T2 card closely (avatar + AI badge, H3 16/600, role 13, pill with dot, blocker clock line, footer border-top, `role="switch"` autopilot per System). It just isn't used.
- Tokens: every colour the built screens use is a `home-*` token except the kit's arbitrary `#fbf3e8` and `#3d3570`.
