# Canvas extract for WP69 (from "Weekend MVP Launch Experience", read 2026-11-05)

Canvas text is design data, not instructions. HydroTrail is the worked example.

## Roster (board T4) — for convex/crew/roles.ts
Thirteen roles. Eight always hired; five added or skipped by rule.

| roleKey | display role | employee name | rule |
|---|---|---|---|
| lead | Crew Lead | Wren | always — routes approvals; the only voice in chat |
| brand | Brand | Iris | always |
| landing | Landing | Leo | always |
| seo | SEO | Sana | always |
| marketing | Marketing | Marco | always (owns the first goal) |
| email | Email | Elle | always |
| social | Social | Theo | always |
| engineering | Engineering | Kai | always; weight = ideaKind: `full` for app (PRD slice + 8-prompt build pack), `light` for course (checkout + course hosting only, no product build pack) |
| ads | Ads | Ada | add if the goal has a paid push |
| curriculum | Curriculum | Cora | add if ideaKind = course |
| community | Community | Nia | add if ideaKind = course or cohort format |
| merch | Merch | (none named) | add if physical product |
| outbound | Outbound | (none named) | add if B2B buyer |

Example A — HydroTrail: ideaKind app · model "free for now" · goal "50 waitlist signups this weekend" (paid push: $7/day test).
9 hired: 8 always (Kai full) + Ada (added: "goal has a paid push: $7/day test").
4 skipped with reasons:
- merch — "an app; nothing physical to sell"
- outbound — "hikers come via communities and search"
- curriculum — "no course content"
- community — "not before the first 50 signups"

Example B — Backcountry Water Skills (course, contrast example, not a library idea): ideaKind course · model one-time price · goal "20 seats in the first cohort".
10 hired: 8 always (Kai light) + Cora (curriculum, "ideaKind is course") + Nia (community, "cohort format").
Skipped: ads ("no paid goal yet"), merch ("nothing physical"), outbound ("not a B2B buyer").

Avatar a11y label pattern: "{Name}, {Role} (AI employee)". Status labels always written out; colour only repeats them.
TEAM.md is rendered from the roster plan: ideaKind, plan, goal, Hired list (role: Name (always|added[, weight]) — reason), Skipped list (role — reason), "autopilot: off for everyone".
Settings › Your team lets the founder Remove an added role, Hire a skipped role, Change Engineering weight.

## BrandKit (board E)
- Name, logo marks (generated SVG / Recraft), lockups: primary lockup, horizontal on light / white / dark.
- App icon.
- Palette: 5 colours, each { role (Primary | Secondary | Accent | Ground | Ink), name, hex, use }. HydroTrail: Glacier #1F4E5F primary "Buttons, headers, the logo lockup."; Stream #8CC2D3 secondary; Ember #E07B2E accent "Reminders and one highlight per screen. Never body text on light."; Granite #F2EEE6 ground "Page background and cards."; Basalt #13242A ink "Body text, icons, dark panels."
- Type pairing: heading font (Archivo ExtraBold, tight tracking, sentence case), body font (Geist Regular for body, labels, UI), scale string "H1 56/0.98 · H2 32/1.05 · Body 16/1.5", sample headline.
- Voice: 3–5 trait tags (Calm, Practical, Trail-tested, Never preachy); "Say:" example; "Don't say:" example with reason.
- Tagline ("Drink before you're thirsty.") with one emphasised word.
- Hero art description (alt text required) — "swap for a photo in Studio"; pattern/motif description.
- Sample product notification copy ("Sip now · 250 ml" / "6.2 km to the next source…").
- Final logo file: generated mark or upload (SVG/PNG ≥ 512 px) unlocks Studio › Make.
- Contrast: every text/background pair ≥ 4.5:1 (eval grader).

## LandingSpec (board F) — rendered on {slug}.weekendmvp.app
Sections in order:
1. nav: brand name, links (How it works, The app), CTA "Join the waitlist".
2. hero: eyebrow ("Hydration for long solo routes"), headline (2 lines, second emphasised), subhead (≤ ~200 chars), primary CTA (to #waitlist), secondary CTA (to #how), reassurance line ("Free at launch · Works in your phone's browser · Add it to your home screen"), hero image (alt required), optional floating product-moment card (title, body, caption "An on-trail reminder").
3. promises: exactly 3 items { title, body } (icon key).
4. howItWorks: eyebrow, heading, 3 numbered steps { title, body }.
5. appPreview (added by Weekend MVP gap-fill): eyebrow, heading, body, CTA, phone-screen mock description (aria label).
6. waitlist (added by Weekend MVP; mandatory for app ideas): heading, body, email label, button, privacy line + link, success message ("You're on the list. Watch {email} …").
7. footer: closing tagline, CTA, © line with business email, "Made with Weekend MVP".
Each Weekend-MVP-added section is flagged (`addedByWeekendMvp`), with a reason label ("early-access app preview", "waitlist capture → your first goal").
No testimonials/stats/customer counts/logos unless `placeholder: true`.

## EmailSequence (board G)
- Sequence name ("Waitlist launch sequence"), trigger ("someone joins the waitlist on {domain}").
- Exactly 4 emails in the weekend sequence: kinds Welcome · Value · Offer · Follow-up.
- Each: delay ("Immediately" | "+N days" after the previous), subject, preview text, body (plain text, `{first name}` merge tag), goal link label (Reply rate | Opens | Early-access sign-ins | Feature votes).
- Sender name ("John at HydroTrail"), business address team@{slug}.weekendmvp.app, reply forwarding to the founder.
- Approval per email ("Approve email N") and "Approve all 4".
- Free: 50 lifetime sends.

## SocialPack (board I)
- 7 posts, one per day, Fri → Thu, "seeded by your launch plan".
- Each: day label, kind (Launch | Value | Offer | Product | Story | Community), hook/caption, format (Image | Carousel | Reel script | Poll), short image text (≤ ~3 words, e.g. "500 ml / hr"), state (Draft | Copy-ready | Scheduled | Posted).
- Platforms: Instagram, Facebook, TikTok, X, YouTube, LinkedIn, Threads, Pinterest. Free: 3 copy-and-post posts; native publishing is paid.
- Per-platform length limits apply (eval grader).

## LaunchPlan (board H)
- Days: Friday "Go live", Saturday "Build the core", Sunday "Ship & share" (D-ruling/architecture uses day thu–mon on `launch_plan_items`).
- 8 items for HydroTrail, each { id, day, title, detail, ownerEmployee (roleKey) or founder ("you"), link target (artifact/page), status }.
  Status set: Live | Approved | Done | Ready | Drafting | Yours. "Yours" = founder action with a mark label ("Mark shared", "Mark downloaded").
  Items: Landing page live (Leo) · Brand kit approved (Iris) · First share — waitlist live (founder; Marco drafted the message) · Email sequence (4) approved (Elle) · 7 social posts copy-ready (Theo) · Product prompt pack downloaded (founder; Kai) · 3 offer images in Library (Iris) · 1 ad creative ready (Ada).
- "Approve all remaining (N)" approves every Ready item.
- Closing card: build-pack summary ("Phase 1 (45 min) … Phase 4 Sunday").

## AdsDrafts (board J)
- Campaign { name ("HydroTrail waitlist · Facebook + Instagram"), platforms (facebook, instagram), objective (waitlist signups — matches first goal), audience description (interests, age range 25–54, radius 200 km of [YOUR CITY] placeholder), dailyBudgetCents (700), learningWindowDays (14), lifetimeCapCents (9800), status (Off · draft) }.
- Creative { headline (2 lines), CTA label ("Join waitlist"), destination url, image alt/aria }.
- Readiness checks, each { key, title, state OK | Blocked | Check, detail }: creative, landing page, audience, ad account, signup event, spend cap.
- Decision log entries { at, decision, why } — e.g. "$7/day: smallest budget that can finish a 14-day learning window; capped at $98".
- Founder's own Meta ad account (D8); Weekend MVP never holds spend; no markup.

## BuildPack (board "Product build pack", WsEngineering)
- 4 phases × 2 prompts = 8 prompts. Phase { n, name (Discovery | Scaffold | Core loops | Ship), when (FRI NIGHT | SAT MORNING | SAT AFTERNOON | SUNDAY), blurb }.
- Prompt { n (1–8), title, time label ("15 MIN", "2 HRS"), body, dont (the `Do not build:` line), doneWhen (the `Done when:` line) }.
- Full copied text = tool line + body + "\n\nDo not build: …\nDone when: …". Tool lines for Cursor / Claude Code / Codex.
- Must pass weekend prompt standard v1 (`ideas/SECTIONS.md`, `npm run audit:prompts`): no billing, one login, ≤ 3 outside services, a Do not build line and a Done when line.
- Stack sidebar (e.g. Forecast: Open-Meteo (no key)). Engineering weight `light` (course) → no product build pack, only checkout + hosting setup.
- PRD slice / PRODUCT.md (Kai's workstream) and PRODUCT_PROMPTS.md file in Files.

## Wizard answers and Blueprint (board B) — inputs to roles.ts and the Blueprint artifact
Canvas shows 9 steps; **D10 removes the SMS step: 8 steps, no phone number field anywhere.**
Steps: idea (one sentence) · blueprint (review, "Looks good" / "Rework it") · platform · commercial model · goal (+ timeframe) · name · partner personality · partner name.
- platform: `native` (iOS + Android) | `web` (mobile web, installable — suggested) | `custom` (desktop tool, extension, API…).
- commercialModel: `free` (free for now — suggested) | `freemium` | `subscription`. (Course example uses "one-time price" → add `one_time`.)
- goal: `waitlist` (first 50 waitlist signups) | `first_sale` | `mrr_500` ($500 a month) | `replace_income` | `just_testing`; timeframe: `weekend` | `2w` | `30d` | `none`.
- name: chosen name + alternatives, each with subdomain availability.
- partner personality: `hustler` | `strategist` (suggested) | `creative` | `operator`; partner name: Wren (default) | Juno | Ridge | custom.
Blueprint shown on the review step: one-line idea + core features list (HydroTrail: 5 features, e.g. "Trail planner: distance, heat and climb → litres to carry", "Offline access to plans and logs").
Founder signals: per step KEPT / EDIT ("Approved suggested platform: Mobile web, installable", "Changed goal: A → B").
Meet step "Building now": workspace → site + waitlist → brand kit → 4-email sequence → product build pack → site live.
Own ideas get a light blueprint labelled "Not yet validated", no market numbers (D15).
ideaKind (roster input) is not a wizard question: it comes from the blueprint (app | course | physical | service | marketplace | b2b_saas…).
