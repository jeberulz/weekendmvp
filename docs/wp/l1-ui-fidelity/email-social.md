# Fidelity audit: Email (G) and Social (I)

Worktree: `.worktrees/l1-ui-fidelity` (branch `claude/l1-ui-fidelity`). Boards: `Email.dc.html`, `Social.dc.html`, checked against `System.dc.html` (SequenceStep, PlatformConnectCard, ApprovalCard and the copy deck). Read-only audit; nothing in the repo was changed.

Product truth used throughout:
- The L1 Monday ruling (RULINGS 2026-11-07) says "nothing sends or posts". Billing is coming soon.
- WP76-S2 "Ship now, rows later": no `social_posts` rows.
- D6 tenant email is not wired yet. D7 is copy-and-post for every platform.
- D17 gives two free change rounds, already shown through `previewChangeRound`.

## What data actually exists

| Screen | Query | Fields the UI can use |
|---|---|---|
| Email | `api.growth.drafts.emailSequence.emailSequenceDraft` | `state` (none, unavailable, ready). When ready: `status` (draft, approved, active, paused), `name`, `senderName`, `emails[4]` {`kind`, `delayHours`, `subject`, `preview`, `body`, `cta?` {label, target}, `goal`}, `card` {approvalId, status, changeRound, expiresAt} or null. `trigger` is the constant `"waitlist_join"` in the contract, so it is safe as fixed copy. |
| Email | `api.workspace.changeRounds.previewChangeRound` | free (with `freeRoundsLeft`), spend_required or not_available. |
| Social | `api.growth.drafts.socialPack.socialPackDraft` | `state`. When ready: `posts[7]` {`day` fri–thu, `kind`, `format`, `hook`, `caption`, `shortCaption`, `imageText`, `imageAlt?`, `pollOptions?`, `hashtags[]`}, and `card` as above. `PLATFORM_CAPTION_LIMITS` holds the 8 platforms' limits. |

None of these exist:
- a business email address or verification state;
- forward-replies settings (`business_email_settings` is in the schema, but nothing reads or writes it);
- send counts or the Free send meter;
- signup or subscriber counts;
- an inbox, sent mail or mailbox folders;
- approval per email (a `sequence_steps.approvalId` belongs to WP79);
- social connections (connectors are Codex's later work);
- per-post state (no rows);
- launch-week calendar dates (no launch date in the data);
- generated post images (Studio is coming soon; only `imageText` exists);
- a free copy allowance or Starter gates.

Approving the review card **does not change `sequences.status`**. Only `emailSequence.ts` patches sequences, and only on a draft write. In L1 the sequence status stays `draft` even after approval.

---

## A. Fidelity scores

Each score compares the build with the board after the board is adapted to L1 truth (the drops are in section D). Against the literal board, both would score about 2.

**Email: 4/10.** The build is honest and works. It reads the real four emails, shows merge tags as tokens, handles empty, unavailable, loading and error states, and wires the shared review card with change-round copy. Structurally it is a different page:
- a plain h1 ("Email") with no sentence;
- a sans-serif h2 rather than the serif section title;
- a "Sent from … Sequence status: Draft" line;
- a stacked list of four fully expanded description lists instead of the board's four-step rail and one detail panel;
- no "nothing sends yet" statement at page level.

Two copy problems break product truth. "Sent from" reads as if mail went out. "Sequence status: Draft" contradicts "Review status: Approved" after the founder approves, because the status never changes in L1. The type scale, the step eyebrow treatment and the delay chips are all missing.

**Social: 3/10.** The build is honest and works: per-platform captions, real character counts, short-caption fallback, copy with a live region, and the review card. Of what the board draws for L1, it keeps only the idea of the eight platforms, as a native `<select>`. The board's core region is missing: the seven-day launch-week calendar, its Calendar/List toggle and the image tiles from `imageText`. The heading copy and type scale differ, and the format and day labels are long-form. The board's honest regions all have data and can be built: the platform cards (as a picker), the dashed "you post it yourself" note, the calendar and the list.

---

## B. Gap list

Each entry gives:
- **Board:** file and a nearby string;
- **Built:** file and line;
- **Has:** what the board shows;
- **Got:** what was built;
- **Fix:** the change.

`[no data]` marks a board element that has no data source.

### Email

**P0-E1. "Sent from" says the mail went out.**
- **Board:** `Email.dc.html`, the aside line "From **John at HydroTrail**" (line 96).
- **Built:** `components/workspace/email/EmailSequencePanel.tsx:121-123`.
- **Has:** "From {sender}".
- **Got:** "Sent from {senderName}. Sequence status: {Draft}."
- **Fix:** Change the line to `From {senderName}` in the detail aside (see C). Remove "Sent from". Update `tests/platform/workspace-email-page.test.tsx:179`.

**P0-E2. "Sequence status: Draft" contradicts an approved review.**
- **Board:** `Email.dc.html`, "{{approvedCount}} of 4 approved" (line 64).
- **Built:** `EmailSequencePanel.tsx:122`.
- **Has:** an approval count in the sequence subtitle.
- **Got:** `SEQUENCE_STATUS_LABELS[view.status]`. In L1 it always says "Draft", even after Approve, because approval never patches `sequences.status`.
- **Fix:** Drop the sequence-status text in L1. Show a `StatusPill set="output"` derived from `view.card` beside the h2 (mapping in C). An approval count per email is `[no data]`. Keep `SEQUENCE_STATUS_LABELS` for WP79.

**P0-E3. No page-level statement that nothing sends.**
- **Board:** `Email.dc.html`, section `sends-h`, "Sends on Free: {{sendsUsed}} of 50 lifetime" with the button "Send email 1 to 64 new signups" (lines 45-50).
- **Built:** none. Only `EMAIL_APPROVED_NOTE` ("Nothing is sent yet.") appears, and only after approval (`ArtifactReviewCard.tsx:211`).
- **Has:** a send meter and a send button.
- **Got:** nothing.
- **Fix:** Put an honest strip in the same slot and shape as the board (copy in C, "Drafts only for now."). The meter, the 50-send count, the 64 signups and the send button are all `[no data]` and forbidden in L1. Drop them.

**P1-E4. The page header has no sentence, the wrong eyebrow and the wrong size.**
- **Board:** `Email.dc.html:24-27`.
- **Built:** `app/(launch-workspace)/dashboard/b/[projectId]/email/page.tsx:23-28`.
- **Has:** eyebrow "Email"; h1 Newsreader 400, 40px, line-height 1.1: "Your inbox, and the four emails *that sell the waitlist.*"
- **Got:** eyebrow `{project.name}`, h1 "Email" at 34/42px with tracking -0.025em.
- **Fix:** Eyebrow "Email". H1 `The four emails <em className="italic">that sell your waitlist.</em>` using `font-editorial text-[34px] sm:text-[40px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink`. Drop "Your inbox, and": there is no inbox in L1. The italic tail stays ink. Don't use `components/home/ui.tsx` `Em`, which is orange; the board's tail has no colour. Metadata title stays "Email". This changes a header pattern shared across screens (see C, "Shared-file changes").

**P1-E5. The sequence title is sans-serif and has no trigger line.**
- **Board:** `Email.dc.html:61-67`.
- **Built:** `EmailSequencePanel.tsx:119-124`.
- **Has:** h2 Newsreader 28px "Waitlist launch sequence"; sub-line at 14px ink-2 "Trigger: someone joins the waitlist on hydrotrail.weekendmvp.app · {n} of 4 approved"; right side "Approve all 4" (44px ink pill).
- **Got:** h2 `text-lg font-medium`, `{view.name}`.
- **Fix:** h2 `font-editorial text-[28px] font-normal leading-tight text-home-ink` showing `{view.name}`. Sub-line `mt-1 text-sm text-home-ink-2`: "Trigger: someone joins your waitlist". The site domain is not returned by this query (`[no data]` here), so omit it. The approval count is replaced by the status pill (P0-E2). "Approve all 4" is the review card's Approve, relabelled (P1-E8).

**P1-E6. Four expanded emails instead of a four-step rail plus a detail panel.**
- **Board:** `Email.dc.html:69-104` (the `<ol>` grid `repeat(auto-fit, minmax(200px,1fr))`, then the detail card).
- **Built:** `EmailSequencePanel.tsx:133-137`, `EmailItem` at `:72-102`.
- **Has:** four selectable step cards. Each shows a mono delay with a clock icon above it, an orange-ink eyebrow "{n} · {KIND}", a semibold subject and a 13px preview. The selected card has a 1.5px ink border; the others have a 1px rule border. Below sits one detail panel for the selected email: subject, preview, and the body in a paper box on the left; From and Goal in a 240px column on the right.
- **Got:** four stacked cards, each a 9rem/1fr description list.
- **Fix:** Build the rail and the detail panel as specified in C. Reuse `MergeText` and `emailBodyParagraphs`.

**P1-E7. Subject and preview are drawn as editable inputs (board).**
- **Board:** `Email.dc.html:85-92` (`<input id="subj">`, `<input id="prev">`) and the sender-name input at `:36-37`.
- **Built:** read-only text (correct).
- **Has:** editable fields.
- **Got:** plain text.
- **Fix:** Keep them read-only. There is no edit mutation; changes go through "Ask for changes" (D17). Don't style them as inputs, because that implies editing. Spec in C.

**P1-E8. Approve wording.**
- **Board:** "Approve all 4" (`:66`) and "Approve email {{sel.n}}" (`:99`).
- **Built:** `ArtifactReviewCard.tsx:262-264`, "Approve".
- **Has:** two approve controls, one for all and one per email.
- **Got:** one "Approve".
- **Fix:** The data has one `artifact_review` card per sequence, so only "Approve all 4" is honest. Approval per email is `[no data]`. Add an optional `approveLabel` prop to `ArtifactReviewCard` and pass `"Approve all 4"`. This is a shared file; see C.

**P2-E9. Delay copy.**
- **Board:** step chip "Immediately", "+2 days", "+3 days" in Geist Mono 12px ink-3 with a clock icon; detail eyebrow "Email 2 · Value · sends +2 days after the last email".
- **Built:** `lib/workspace/emailPage.ts:46-53`, `emailDelayCopy`: "As soon as someone confirms" or "2 days after the previous email", shown in the description list (`EmailSequencePanel.tsx:84`).
- **Fix:** Add `emailDelayShort(delayHours)` for the chip: 0 gives "Immediately", whole days give "+N day(s)", anything else gives "+N hour(s)". Keep `emailDelayCopy` for the detail panel, because it is the accurate double opt-in wording. Use the lucide `Clock` icon at `size-3.5`, `aria-hidden`.

**P2-E10. Step eyebrow.**
- **Board:** step label "1 · WELCOME" at 11px/500, +0.14em, `#a84a00`.
- **Built:** `EmailSequencePanel.tsx:80-81`: `EYEBROW` "Email 1 of 4" plus an h3 for the kind.
- **Fix:** On the step card use `text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-ink` with "{n} · {kind}". The detail panel's h3 carries the full "Email {n} · {kind} · {delay}".

**P2-E11. The goal label.**
- **Board:** "Goal link: **{goal}**" (`:97`).
- **Built:** `:98`, "Goal".
- **Fix:** Keep "Goal". The field is a metric label, such as "Reply rate", not a link, so the board's "Goal link" is misleading. Show it as `Goal: <b class="font-medium text-home-ink">{goal}</b>` in the aside.

**P2-E12. The CTA row is not on the board.**
- **Built:** `:95-97`.
- **Fix:** Keep it. `cta` is real data. Show it in the aside as "Button: “{label}”, goes to {destination}".

**P3-E13. Duplicate review wiring.**
- **Built:** `EmailSequencePanel.tsx:52-54, 104-112, 125-132`. These re-implement `components/workspace/review/LiveArtifactReview.tsx`.
- **Fix:** Optionally switch to `LiveArtifactReview`. The behaviour is identical, so this only removes code.

**P3-E14. Card radius.**
- **Board:** panels use radius 10px.
- **Built:** `CARD` is `rounded-xl` (12px). The System board says 12px for cards.
- **Fix:** Keep `CARD`. No change.

### Social

**P1-S1. The core region, the launch-week calendar, is missing.**
- **Board:** `Social.dc.html:78-112`, section `cal-h`.
- **Built:** `components/workspace/social/SocialPackPanel.tsx:203-207` and `PostItem` at `:93-153`.
- **Has:**
  - h2 Newsreader 28px "Launch week · Fri 6 → Thu 12 Nov";
  - a Calendar/List pill toggle with `aria-pressed`;
  - a status line at 14px ink-2;
  - a 7-column grid (`repeat(7, minmax(130px,1fr))`, `min-width: 910px`, 1px rule gaps, overflow-x scroll). Each cell holds a mono day "FRI 6", a square tile with `imageText`, the hook at 13px/1.35, and a pill "{format} · {state}" pinned to the bottom.
- **Got:** a stacked list of seven expanded description lists.
- **Fix:** Build the calendar with a selectable detail panel, plus the List view, as specified in C. The tile text (`imageText`), the hook and the format exist. Calendar dates are `[no data]`: use day names only. Post state ("Draft", "Copy-ready", "Scheduled") is `[no data]` per post: show the format only, and leave the pack state to the review card.

**P1-S2. The page header has no sentence, the wrong eyebrow and the wrong size.**
- **Board:** `Social.dc.html:24-27`.
- **Built:** `app/(launch-workspace)/dashboard/b/[projectId]/social/page.tsx:23-29`.
- **Has:** eyebrow "Social"; h1 "Seven launch posts, *ready when you are.*"
- **Got:** eyebrow `{project.name}`, h1 "Social".
- **Fix:** Eyebrow "Social". H1 `Seven launch posts, <em className="italic">ready when you are.</em>` with the same classes as P1-E4. The sentence is true for copy-to-post.

**P1-S3. The platform picker is a native select instead of the board's platform cards.**
- **Board:** `Social.dc.html:29-41`, "Connect where you'll post · {{connCount}} connected", 8 cards (`repeat(auto-fit, minmax(210px,1fr))`). Each card has a 36px sunk square mono mark (IG, FB, TT, X, YT, IN, TH, PI), a semibold name, a 12px ink-3 "need" line and a Connect pill.
- **Built:** `SocialPackPanel.tsx:184-199`, `<select>` labelled "Post on".
- **Fix:** Turn the cards into a radio group, "Where will you post?". Keep the mark square and the name. Replace the "need" line with the platform's caption limit from `PLATFORM_CAPTION_LIMITS`, for example "2,200 characters". Connect, Connected, the connected count and the account-type requirements are `[no data]`; drop them. Spec in C. Update `tests/platform/workspace-social-page.test.tsx:205-268`, which select by the label "Post on".

**P1-S4. The "you post it yourself" note is not drawn the board's way.**
- **Board:** `Social.dc.html:42-45`, a dashed box (`border 1px dashed #cfc6b6`, card fill, padding 16): "**Only a personal profile?** That's fine. Wren preps the image and caption for each post; you post from your phone and tap Mark posted." with a toggle "Use personal-profile mode".
- **Built:** `SocialPackPanel.tsx:172-174` folds `SOCIAL_NO_POSTING_COPY` into the h2 sub-line.
- **Fix:** Use the dashed box for the honest L1 message (copy in C). Drop the toggle: copy-and-post is the only mode. "Mark posted" is `[no data]` (no rows). "Preps the image" is `[no data]` (no images in L1).

**P1-S5. The section heading is wrong.**
- **Board:** h2 serif 28px "Launch week · Fri 6 → Thu 12 Nov".
- **Built:** `:171`, h2 `text-lg font-medium` "Your first week of posts".
- **Fix:** h2 `font-editorial text-[28px] font-normal leading-tight text-home-ink` "Launch week · Friday to Thursday". Dates are `[no data]`.

**P2-S6. Day and format labels are long-form.**
- **Board:** mono "FRI 6", pill "Image", "Carousel", "Reel script", "Poll".
- **Built:** `lib/workspace/socialPage.ts:18-26` "Friday (launch day)" and `:48-53` "Image post".
- **Fix:**
  - Add `SOCIAL_DAY_SHORT` (`fri: "Fri"`, …). Render it in `font-mono text-xs uppercase text-home-ink-3`, with an sr-only " (launch day)" on Friday.
  - Add `SOCIAL_FORMAT_SHORT` (`image: "Image"`, `carousel: "Carousel"`, `reel_script: "Reel script"`, `poll: "Poll"`) for the pills.
  - Keep the long labels for detail headings and accessible names.

**P2-S7. Post tile colours.**
- **Board:** tiles use the HydroTrail brand colours (`#1f4e5f`, `#8cc2d3`, `#e07b2e`, `#13242a`, `#f2eee6`), which are sample-business data.
- **Built:** none.
- **Fix:** For L1, use tokens and alternate by index: `bg-home-panel text-home-card` and `bg-home-sunk text-home-ink`. Optionally later, read `brandKitDraft.palette` and paint with an SVG `<rect fill>`, as `BrandKitPanel.tsx:70-74` does, which needs no inline style. That costs a second query, so defer it.

**P2-S8. The copy result line.**
- **Board:** `role="status"` line, 13px sage-ink: "Post 1 copied: image and caption are ready to paste."
- **Built:** `:200-202`, ink-2: "Copied the Friday post for Instagram."
- **Fix:** Keep the built copy, which is accurate (no image), and the ink-2 colour (8:1). Move the line directly under the detail panel's Copy button so it sits near the action. No colour change.

**P2-S9. Approve wording.**
- **Board:** no approval on Social at all.
- **Built:** the review card, "Approve".
- **Fix:** Keep the card; the product needs the `artifact_review` decision. Pass `approveLabel="Approve all 7"` (shared prop, P1-E8).

**P3-S10. Duplicate review wiring.**
- **Built:** `SocialPackPanel.tsx:212-240`.
- **Fix:** Same as P3-E13: optionally use `LiveArtifactReview`.

**P3-S11. The scrolling calendar must be keyboard-reachable.**
- **Board:** `overflow-x: auto` wrapper.
- **Fix:** Make the scroll wrapper `role="region" aria-label="Launch week calendar" tabIndex={0}` with the `FOCUS` ring, so keyboard users can scroll it (WCAG 2.1.1).

### Cross-cutting (not Email or Social code)

**X1. No chat column.** Both boards import `Chat` as a right-hand column (`flex: 1 1 360px`). The workspace layout (`app/(launch-workspace)/dashboard/b/[projectId]/layout.tsx`) renders only the nav and a 1080px main. This is the shell's job and is audited elsewhere. Don't add chat inside these pages.

**X2. Raw hex in the kit.** `StatusPill.tsx:9,17` uses the arbitrary class `bg-[#fbf3e8]` ("Ember soft" on the System board). There is no `home-*` token for it, which falls short of D18's "tokens only" spirit. See the token table.

---

## C. Implementation spec

Shared imports: `CARD`, `EYEBROW`, `FOCUS`, `BTN_PRIMARY`, `BTN_SECONDARY` from `components/workspace/kit/styles.ts`; `StatusPill` and `EmptyState`/`LoadingState`/`ErrorState` from the kit; `Clock` from `lucide-react`. Don't use inline styles. Selected and pressed states use `cn()` with token classes.

### Header (both pages)

Use a local `<header>` in each page, or better, a new `WorkspacePageHeader` (see "Shared-file changes"):

```
<header className="flex flex-col gap-2">
  <p className={EYEBROW}>{eyebrow}</p>                          // "Email" | "Social"
  <h1 className="font-editorial text-[34px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink sm:text-[40px]">
    {lead}<em className="italic">{tail}</em>
  </h1>
</header>
```

- Email: lead "The four emails ", tail "that sell your waitlist."
- Social: lead "Seven launch posts, ", tail "ready when you are."
- Page wrapper: `flex flex-col gap-7`. The board's gap is 28px; the build uses `gap-6`.

### Email page

```
EmailPage (server; page.tsx)
└─ div.flex.flex-col.gap-7
   ├─ Header (above)
   └─ EmailSequencePanel (client)
      ├─ loading  → <LoadingState label="Loading your emails…" />                     (keep)
      ├─ error    → <ErrorState message="Your emails couldn't load right now. Reload the page to try again." /> (keep)
      ├─ none     → <EmptyState>{EMAIL_NONE_COPY}</EmptyState>                         (keep)
      ├─ unavail. → <EmptyState>{EMAIL_UNAVAILABLE_COPY}</EmptyState>                  (keep)
      └─ ready
         ├─ DraftsOnlyStrip
         │   <div className={cn(CARD, "rounded-[10px] px-4 py-3.5")}>
         │     <p className="text-[15px] font-semibold text-home-ink">Drafts only for now.</p>
         │     <p className="mt-0.5 text-[13px] text-home-ink-2">
         │       Nothing sends from here yet. Read the four emails, then approve them or ask for changes. Sending switches on in a later release.
         │     </p>
         │   </div>
         └─ <section aria-labelledby="seq-h" className="flex flex-col gap-4">
            ├─ div.flex.flex-wrap.items-end.justify-between.gap-3
            │   ├─ div
            │   │   ├─ <h2 id="seq-h" className="font-editorial text-[28px] font-normal leading-tight text-home-ink">{view.name}</h2>
            │   │   └─ <p className="mt-1 text-sm text-home-ink-2">Trigger: someone joins your waitlist</p>
            │   └─ {pill && <StatusPill set="output" status={pill.status} label={pill.label} />}
            ├─ <ArtifactReviewCard … artifact={{ plural: "emails", approvedNote: "Nothing is sent yet." }} approveLabel="Approve all 4" />
            │   (or <LiveArtifactReview … approveLabel="Approve all 4" />; headingLevel 3)
            ├─ StepRail
            │   <ol aria-label="The four emails, in send order" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            │     {emails.map((e, i) =>
            │     <li className="flex flex-col gap-2">
            │       <p className="flex items-center gap-2 font-mono text-xs text-home-ink-3">
            │         <Clock aria-hidden="true" className="size-3.5" />{emailDelayShort(e.delayHours)}
            │       </p>
            │       <button type="button" aria-pressed={i === sel} aria-controls="email-detail" onClick={() => setSel(i)}
            │         className={cn("flex flex-1 flex-col items-start gap-1.5 rounded-[10px] border bg-home-card p-3.5 text-left text-sm text-home-ink transition-colors hover:bg-home-paper motion-reduce:transition-none", FOCUS,
            │           i === sel ? "border-home-ink ring-1 ring-home-ink" : "border-home-rule")}>
            │         <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-ink">{i + 1} · {EMAIL_KIND_LABELS[e.kind]}</span>
            │         <span className="font-semibold leading-[1.3]"><MergeText text={e.subject} /></span>
            │         <span className="text-[13px] text-home-ink-2"><MergeText text={e.preview} /></span>
            │       </button>
            │     </li>)}
            │   </ol>
            └─ EmailDetail (selected email; initial selection 0)
                <div id="email-detail" role="region" aria-labelledby="email-detail-h"
                     className={cn(CARD, "grid lg:grid-cols-[minmax(0,1fr)_260px]")}>
                  ├─ div.flex.min-w-0.flex-col.gap-3.border-b.border-home-sunk.p-5.lg:border-b-0.lg:border-r
                  │   ├─ <h3 id="email-detail-h" className={EYEBROW}>Email {n} · {kind} · {emailDelayCopy(delayHours)}</h3>
                  │   └─ <dl className="flex flex-col gap-3">
                  │       ├─ div.flex.flex-col.gap-1 → <dt className="text-[13px] font-medium text-home-ink">Subject</dt>
                  │       │                             <dd className="text-[15px] font-medium text-home-ink"><MergeText …/></dd>
                  │       ├─ div.flex.flex-col.gap-1 → dt "Preview text" / <dd className="text-sm text-home-ink"><MergeText …/></dd>
                  │       └─ div.flex.flex-col.gap-1 → dt "Message" /
                  │            <dd className="flex flex-col gap-3 rounded-lg border border-home-sunk bg-home-paper p-4 text-[15px] text-home-ink">
                  │              {emailBodyParagraphs(body).map(p => <p className="whitespace-pre-line"><MergeText text={p} /></p>)}
                  │            </dd>
                  └─ div.flex.flex-col.gap-2.5.p-5.text-sm.text-home-ink-2
                      ├─ <p>From <b className="font-medium text-home-ink">{senderName}</b></p>
                      ├─ <p>Goal: <b className="font-medium text-home-ink">{goal}</b></p>
                      └─ {cta && <p>Button: “{cta.label}”, goes to {destination}</p>}
                </div>
```

The status pill is a helper in `lib/workspace/emailPage.ts`, e.g. `reviewPill(card, now)`. It reads `now` from `useState(() => Date.now())` on the client, the same way the card does.

| card | StatusPill |
|---|---|
| `null` | no pill |
| `pending` and `now < expiresAt` | `status="ready"` (label "Ready for your OK") |
| `pending` past expiry | `status="draft"`, `label="Expired"` |
| `approved` | `status="approved"` |
| `changes_requested` | `status="changes_requested"` |
| `cancelled` | `status="draft"`, `label="Not going ahead"` |

New pure helper in `emailPage.ts`, `emailDelayShort(h)`:

| `h` | Output |
|---|---|
| ≤ 0 | "Immediately" |
| whole days (`h % 24 === 0`) | `+${d} day` or `+${d} days` |
| otherwise | `+${h} hour` or `+${h} hours` |

Add unit tests.

Remove: the "Sent from … Sequence status" line, and the four-expanded `EmailItem` list (its rows move into `EmailDetail`).

Accessibility:
- Heading order: h1, then h2 (sequence), then h3 (review card "Your review", and the detail heading).
- The step buttons use `aria-pressed` plus `aria-controls`, matching the board. Selecting doesn't move focus. The detail region is labelled by its h3, which names the email.
- Merge tags keep their sr "(merge tag)".
- Targets are 40px or more: the step cards are tall, and Approve/Ask use `BTN_*` at `min-h-10`.
- Colour is never the only signal: the pill always has a text label.

### Social page

```
SocialPage (server; page.tsx)
└─ div.flex.flex-col.gap-7
   ├─ Header (above)
   └─ SocialPackPanel (client)
      ├─ loading / error / none / unavailable → keep as built (copy unchanged)
      └─ ready
         ├─ PlatformPicker
         │   <fieldset className="flex flex-col gap-3">
         │     <legend className="mb-3 text-[17px] font-semibold text-home-ink">
         │       Where will you post? <span className="font-normal text-home-ink-3">· captions are fitted to the platform</span>
         │     </legend>
         │     <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
         │       {SOCIAL_PLATFORMS.map(p =>
         │       <label className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border bg-home-card p-3.5",
         │           "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-home-orange-ink",
         │           p === platform ? "border-home-ink ring-1 ring-home-ink" : "border-home-rule hover:bg-home-paper")}>
         │         <input type="radio" name="social-platform" value={p} checked={p === platform} onChange={…} className="sr-only" />
         │         <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-home-sunk font-mono text-[13px] font-medium text-home-ink">{SOCIAL_PLATFORM_MARKS[p]}</span>
         │         <span className="flex flex-col leading-tight">
         │           <span className="font-semibold text-home-ink">{SOCIAL_PLATFORM_LABELS[p]}</span>
         │           <span className="text-xs text-home-ink-3">{limit.toLocaleString("en-US")} characters</span>
         │         </span>
         │       </label>)}
         │     </div>
         │   </fieldset>
         ├─ YouPostItNote
         │   <div className="rounded-[10px] border border-dashed border-home-d2 bg-home-card p-4 text-[15px] text-home-ink">
         │     <b className="font-semibold">You post it yourself.</b> Nothing posts or schedules from here. Pick a post, copy its caption and hashtags, then paste them into the app.
         │   </div>
         ├─ <ArtifactReviewCard … artifact={{ plural: "posts", approvedNote: "Nothing is posted for you." }} approveLabel="Approve all 7" />
         └─ <section aria-labelledby="week-h" className="flex flex-col gap-3">
            ├─ div.flex.flex-wrap.items-center.justify-between.gap-2.5
            │   ├─ <h2 id="week-h" className="font-editorial text-[28px] font-normal leading-tight text-home-ink">Launch week · Friday to Thursday</h2>
            │   └─ <div role="group" aria-label="View" className="inline-flex rounded-full border border-home-rule bg-home-card p-1">
            │        {["Calendar","List"].map(v =>
            │        <button type="button" aria-pressed={view === v} className={cn("min-h-9 rounded-full px-3.5 text-[13px] font-medium", FOCUS,
            │          view === v ? "bg-home-ink text-home-card" : "text-home-ink hover:bg-home-sunk")}>{v}</button>)}
            │      </div>
            ├─ <p className="text-sm text-home-ink-2">Written by your team. Friday is launch day.</p>
            ├─ view === "Calendar":
            │   ├─ <div role="region" aria-label="Launch week calendar" tabIndex={0}
            │   │       className={cn("overflow-x-auto rounded-[10px] border border-home-rule bg-home-rule", FOCUS)}>
            │   │    <ol className="grid min-w-[910px] grid-cols-7 gap-px">
            │   │      {posts.map((post, i) =>
            │   │      <li className="bg-home-card">
            │   │        <button type="button" aria-pressed={i === sel} aria-controls="post-detail" onClick={() => setSel(i)}
            │   │          className={cn("flex h-full min-h-[230px] w-full flex-col gap-2 p-3 text-left hover:bg-home-paper", FOCUS,
            │   │            i === sel && "ring-2 ring-inset ring-home-ink")}>
            │   │          <span className="font-mono text-xs uppercase text-home-ink-3">{SOCIAL_DAY_SHORT[post.day]}{post.day === "fri" && <span className="sr-only"> (launch day)</span>}</span>
            │   │          <span aria-hidden="true" className={cn("flex aspect-square items-end rounded-md p-2 text-xs font-bold leading-[1.15]",
            │   │            i % 2 === 0 ? "bg-home-panel text-home-card" : "bg-home-sunk text-home-ink")}>{post.imageText}</span>
            │   │          <span className="text-[13px] leading-[1.35] text-home-ink">{post.hook}</span>
            │   │          <span className="mt-auto self-start rounded-full bg-home-sunk px-2 py-px text-[11px] text-home-ink-2">{SOCIAL_FORMAT_SHORT[post.format]}</span>
            │   │        </button>
            │   │      </li>)}
            │   │    </ol>
            │   │  </div>
            │   └─ PostDetail (selected post; initial 0)
            │       <div id="post-detail" role="region" aria-labelledby="post-detail-h" className={cn(CARD, "flex flex-col gap-3 p-5")}>
            │         <p className={EYEBROW}>{SOCIAL_KIND_LABELS[kind]} · {SOCIAL_FORMAT_SHORT[format]}</p>
            │         <h3 id="post-detail-h" className="text-base font-medium text-home-ink">{SOCIAL_DAY_LABELS[day]}</h3>
            │         <dl …>  ← reuse today's PostItem rows unchanged: Hook, Caption for {platform}, Card text,
            │                   Image description, Poll options, Hashtags, Length for {platform}
            │         <div className="flex flex-wrap items-center gap-3"><CopyButton … /></div>
            │         <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2"><span key={count}>{announcement}</span></p>
            │       </div>
            └─ view === "List":
                <ol aria-label="The posts, in order" className="flex flex-col gap-3">
                  {posts.map(post => <PostItem …/>)}   ← today's PostItem, header restyled to the board row:
                    li header: div.flex.flex-wrap.items-center.gap-3.5
                      <span className="w-[90px] shrink-0 font-mono text-xs uppercase text-home-ink-3">{SOCIAL_DAY_SHORT}</span>
                      <h3 className="flex-1 text-[15px] text-home-ink">{post.hook}</h3>   (sr prefix: "{SOCIAL_DAY_NAMES[day]}: ")
                      <span className="rounded-full bg-home-sunk px-2 py-px text-xs text-home-ink-2">{SOCIAL_FORMAT_SHORT}</span>
                    then the dl + Copy as today. Keep one shared live region (move today's into the section, above the list).
                </ol>
```

New pure constants in `lib/workspace/socialPage.ts`:
- `SOCIAL_DAY_SHORT: Record<SocialDay,string>`: Fri, Sat, Sun, Mon, Tue, Wed, Thu.
- `SOCIAL_FORMAT_SHORT: Record<SocialPostFormat,string>`: Image, Carousel, Reel script, Poll.
- `SOCIAL_PLATFORM_MARKS: Record<SocialPlatform,string>`: IG, FB, TT, X, YT, IN, TH, PI (the board's marks).

Remove: the "Post on" `<select>`, and the h2 "Your first week of posts" with its sub-line. `SOCIAL_NO_POSTING_COPY` moves into the dashed note.

Accessibility:
- The radio group is native inputs in a `fieldset` with a `legend`. Arrow keys work natively. The focus ring shows on the label through `has-[:focus-visible]`. The mark is `aria-hidden`; the platform name is the accessible name.
- The calendar cells use `aria-pressed` plus `aria-controls`. The tile is `aria-hidden`; its text is repeated as "Card text" in the detail.
- The scroll region is focusable.
- One polite live region announces copies. The Copy button keeps its full accessible name ("Copy the Friday post for Instagram").
- Headings: h1, then h2 (week), then h3 (detail or list items, plus the review card's h3).

### Shared-file changes (flag; other screens use these)

1. **`components/workspace/review/ArtifactReviewCard.tsx`:** add an optional `approveLabel?: string` prop. It defaults to `"Approve"`, so it is non-breaking, and is used at line 263. Pass it through `LiveArtifactReview.tsx`. Brand kit (`BrandKitPanel`) and Team HQ (`BlueprintView`) are unaffected while they omit it. Don't restyle the card; it already matches the System pill buttons.
2. **Page header pattern:** every workspace page renders eyebrow `{project.name}` and h1 `{route label}` (dashboard, brand, files, team, `_scaffold/placeholder.tsx:71`, email, social). The boards use eyebrow = route name and h1 = a serif sentence with an italic tail. Doing this only on Email and Social makes them differ from their siblings. The recommendation is a small `WorkspacePageHeader({ eyebrow, lead, tail })` in `components/workspace/kit/`, adopted page by page. This needs orchestrator sign-off because it touches every screen. The project name stays visible in the business switcher.
3. **`components/workspace/kit/StatusPill.tsx`:** the arbitrary `bg-[#fbf3e8]` should become a token (see the token table). Email uses the `ready` pill, so it inherits this.
4. **Tests to update:**
   - `tests/platform/workspace-email-page.test.tsx:179` ("Sent from");
   - `tests/platform/workspace-social-page.test.tsx:205-268` (the "Post on" select becomes radios named by platform; selected post vs List view).
   - Add unit tests for `emailDelayShort`, `reviewPill` and the new social label maps.

### Token map (board hex to repo token)

| Board hex | Token | Where on the boards |
|---|---|---|
| `#f7f3ec` | `home-paper` | page, email body box |
| `#fffdf9` | `home-card` | cards, button text on ink |
| `#1a1814` | `home-ink` | text, primary pill, selected border |
| `#4a453c` | `home-ink-2` | secondary text |
| `#6b6457` | `home-ink-3` | eyebrows, mono delays and days |
| `#ddd4c4` | `home-rule` | hairlines |
| `#efe8dc` | `home-sunk` | inner dividers, mark squares, meter track |
| `#cfc6b6` | `home-d2` | dashed borders, toggle off-track |
| `#a84a00` | `home-orange-ink` | step eyebrow, focus, links |
| `#3a5530` / `#dce6d5` | `home-sage-ink` / `home-sage` | approved pills, verified text |
| `#f2e1b8` / `#6e5010` | `home-ochre` / `home-ochre-ink` | the board's "Ready" and "Draft pricing" pills. The kit's `ready` pill follows the System board (ember soft and orange-ink) instead; keep the kit. |
| `#fbf3e8` | **no token** (the kit uses a raw `bg-[#fbf3e8]`) | Wren gate fill; dropped on these screens. System "Ember soft". Suggest `--color-home-ember-soft`: an alias for a colour the canvas already defines, not a new palette. Owner/orchestrator call under D18. |
| `#e8cfae` | **no token** | gate border; dropped on these screens |
| `#1f4e5f`, `#8cc2d3`, `#e07b2e`, `#13242a`, `#f2eee6` | **no token, by design** | HydroTrail brand sample (post tiles). Use `home-panel`/`home-sunk` in L1, or the brand-kit palette through an SVG fill later. |

Type: Newsreader is `font-editorial`, loaded by `newsreaderEditorial` in the layout. Geist is the body font; Geist Mono is `font-mono`. Use no Archivo.

---

## D. Board elements to drop or defer for L1

| Board element | Board | Why it goes | L1 replacement |
|---|---|---|---|
| Business address cell "team@hydrotrail.weekendmvp.app · Verified · sending ready" | Email `:30-34` | No address or verification data. D6 tenant email isn't wired. Nothing sends. | None. The aside shows "From {senderName}". |
| Sender name text input | Email `:35-38` | No mutation; sender comes from the document | Read-only "From {senderName}" |
| Forward replies toggle "To john@[your email]" | Email `:39-42` | `business_email_settings` is never read or written; no inbox | None (defer to WP79) |
| "Sends on Free: 12 of 50 lifetime" meter and "Send email 1 to 64 new signups" | Email `:45-50` | No sends in L1, no send count, no signup count, billing coming soon | "Drafts only for now." strip |
| Wren gate "This send needs Starter." | Email `:51-58` | Billing coming soon, no sends | None |
| Per-email "Ready"/"Approved" pills, "Approve email N", "{n} of 4 approved" | Email `:74, 99-101, 64` | One `artifact_review` card per sequence; step approvals are WP79's | Sequence-level StatusPill plus "Approve all 4" |
| "Ask Wren to edit" (aside) | Email `:102` | Same action as the review card's "Ask for changes" (D17 rounds); a second control would duplicate it | The review card's "Ask for changes" |
| Mailbox (All, Inbox, Unread, Sent, Drafts with counts; drafts list; "No emails in inbox yet. Replies from your waitlist will land here first.") | Email `:107-120` | No inbound or sent mail. The empty state would promise an inbox that L1 doesn't have (D6 Reply-To goes to the founder). | None (defer) |
| Site domain in "Trigger: … on hydrotrail.weekendmvp.app" | Email `:64` | Not returned by `emailSequenceDraft` | "Trigger: someone joins your waitlist" |
| "Connect" / "Connected" per platform, "· N connected" | Social `:30-41` | No connectors (Codex later); nothing posts | Platform cards become the caption picker |
| Personal-profile mode toggle, "tap Mark posted", "Wren preps the image" | Social `:42-45` | Copy-and-post is the only mode (D7); no `social_posts` rows; no images in L1 | Static dashed note "You post it yourself." |
| "On Free: 2 of 3 copy-and-post posts left", "Copy post 3 · free" | Social `:48-53` | Billing coming soon; no copy allowance exists; copy is unlimited and free | Per-post Copy in the detail and the List view |
| "Publish post 4 to Instagram" and the "Publishing from here is on Starter." gate | Social `:51, 54-61` | Nothing posts; billing coming soon | None |
| Compose box (locked or unlocked, "Schedule", "Save copy-ready", "Draft with Wren") | Social `:63-76` | No free-form post storage, no scheduling; chat-driven drafting isn't wired to the pack | None (defer; "Draft with Wren" can come with the chat column) |
| Calendar dates "Fri 6 → Thu 12 Nov", "FRI 6" | Social `:80, 140-146` | No launch date in the data | Day names only |
| Per-post state "Draft" / "Copy-ready" / "Scheduled" and "Posts are scheduled to your connected accounts." | Social `:95, 137, 157` | No rows; nothing schedules | Format-only pill; pack state in the review card |
| "Seeded by your launch plan." | Social `:86` | The Launch plan page is coming soon; the pack comes from the crew | "Written by your team. Friday is launch day." |
| Brand-coloured tiles | Social `:93, 140-146` | Sample-business colours with no token | Token tiles now; brand palette through SVG later (deferred) |
| Right-hand Chat column | both, `<dc-import name="Chat">` | Owned by the shell, not these pages | Out of scope here |

Summary: no board element on these two screens has a data source the build ignores. Everything the build leaves out is either forbidden in L1 or has no data. The gaps are layout, type scale, the rail and calendar overview patterns, and two truth-breaking copy lines on Email ("Sent from" and "Sequence status: Draft").
