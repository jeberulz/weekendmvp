# Editorial Admin — product and design

## Product promise

One place to decide whether an idea deserves publication, read every section, inspect its evidence, improve the writing, and control exactly what is live. The workspace must make uncertainty and unfinished review obvious. An engine score is a recommendation, not approval.

Success: you can import an engine draft or open a live idea, trace a claim to a source, correct the copy, see what remains unreviewed, approve a fixed revision, publish it, and recover from a failed release without using the terminal or losing the previous version.

## Navigation and screens

Use a separate 216px editorial sidebar: **Review queue**, **Library**, **Releases**, **Trash**, **Activity**, **Settings**. Header reads “Weekend MVP / Editorial” with environment, connection state and your account. Keep member-dashboard navigation out of this shell.

| Screen | Purpose and primary actions |
|---|---|
| Review queue | New candidates, accepted ideas awaiting copy review, needs research, changes requested, rejected. Filters for issue severity, source age, engine run, buyer/category and decision. Accept, request research or reject with a reason. |
| Library | All ideas, including legacy live content, unpublished items and private drafts. Search title, slug, buyer and job; filter publication state, review coverage, stale evidence, category and last update. Open, create revision, preview live page. |
| Idea workspace | Article, evidence, quality checks, metadata, review sign-off and version comparison for one selected revision. |
| Releases | Preview-ready, running, failed, reconciling and completed releases; deployment/activation steps, exact revision, timestamps, errors and retry/rollback controls. |
| Trash | Soft-deleted ideas, previous status, reason and restore. Restore to private/unpublished, never directly live. |
| Activity | Read-only chronology of edits, decisions, reviews, releases, unpublishing and recovery. Actor, reason, revision, outcome; redacted details. |
| Settings | Current super-admin capability, source integration status, engine connection, quality policy version, publishing readiness. Show configured/verified/unavailable separately. No raw API keys or arbitrary execution console. |

Default landing page is the review queue, not an analytics page. Above the table, a compact summary shows “8 need review · 3 blocked by evidence · 1 release needs attention”, derived from actual data. No invented progress percentages or revenue charts.

Table columns: title + buyer, candidate decision, working revision, publication state, blockers, reviewed sections, evidence freshness, updated time. Keep publication and editorial status separate: “Live v3 · Draft v4” is normal. Cursor pagination and server filtering; selecting a row opens the workspace. Batch actions are limited to labels and queue organisation in v1—no mass approve/publish/delete.

## Visual specification

Apply restrained editorial principles from the `minimalist-ui` skill while retaining this repository's existing Geist fonts, accessible primitives and installed icon set. Do not introduce a design-system dependency or modify global tokens just to style this feature.

- Light warm canvas `#F7F6F3`, white document surface, charcoal text `#202522`, secondary text `#59635D`. Thin borders, 6–8px radii, minimal shadow on floating dialogs only. Scoped CSS variables under the editorial root.
- Geist Sans for controls; Geist Mono for version IDs, dates and measured counts. UI body 14–15px; reading pane 17px/1.7 with a 68–74 character measure; page title 28px, section title 21px. Reuse the public content typography in final preview where safe.
- Primary buttons dark charcoal. Use restrained green for confirmed success, amber for review needed, red for failure/destructive actions. Always pair colour with text/icon. Verify contrast; colour samples are not proof of accessibility.
- Tight operational table rows (minimum 48px), comfortable document spacing, generous whitespace around prose. No bento marketing cards, hero illustrations, animated counters, gradients or ambient animation.
- Focus ring visible on every control. Motion is limited to short disclosure/dialog transitions and respects reduced motion. Long prose stays visible while checks run.

Desktop workspace at 1440px: 216px navigation, flexible central article, 340px evidence/review inspector. At 1024px collapse navigation and allow the inspector to toggle. At 390px use one reading column and tabs for Article/Evidence/Review; expose “More actions” separately from Save. Keep confirmation dialogs and controls within the viewport; no mobile hover dependency.

```text
┌───────────────┬────────────────────────────────────────────────────────┐
│ Editorial     │ Invoice follow-up for freelancers                     │
│               │ Live v2 · Editing v3       Saved 12:42      Save       │
│ Review queue  ├────────────────────────────────┬───────────────────────┤
│ Library       │ Write | Preview | Compare      │ Evidence | Review     │
│ Releases      │                                │                       │
│ Trash         │ The Problem                    │ Claim: 6 hours/week   │
│ Activity      │ Readable article with claim    │ Source + excerpt      │
│ Settings      │ markers and editable sections  │ Retrieved / verified  │
│               │                                │ Open source           │
│               │ The Solution                   │ Flag / add note       │
│               │ …                              │                       │
├───────────────┴────────────────────────────────┴───────────────────────┤
│ 6/8 sections reviewed · 1 unresolved claim    Request changes | Review │
└───────────────────────────────────────────────────────────────────────┘
```

Use realistic fictional fixtures, clearly labelled demo data, to show the density of an actual article. The mock counts above are layout examples, never runtime fallback values.

## Idea workspace behaviour

The title bar always shows the selected revision, current live revision if any, engine/manual/legacy origin, save state and review state. “Saved” means the server acknowledged that revision. “Saving…”, “Offline—changes not saved”, and “Conflict—review newer revision” are distinct; never silently discard text or report success early.

Main tabs: **Write**, **Preview**, **Compare**, **History**. Inspector tabs: **Evidence**, **Quality**, **Review**, **Details**. Use a section outline for the existing eight headings; do not make eight separate page loads. Section-specific review status is visible in the outline.

### Writing and preview

- Start with a Markdown textarea/editor with keyboard support and section navigation. Preserve literal code fences and links; never execute raw MDX/HTML/JS in the preview. A rich-text editor is optional later, not a prerequisite.
- Autosave after a short idle period, with manual Save/Ctrl-or-Cmd-S and navigation protection for unacknowledged changes. Debounced saves use a server revision precondition. Recovery drafts stay in the private backend; do not put research bodies in shared browser storage by default.
- Show body word count, reading-time estimate, section counts and prompt/code count separately. Exclude frontmatter/markup from prose count. State which count is measured; length is not a quality score.
- A claim marker opens its source/excerpt and supporting/contradicting context. Editing sourced wording marks the relationship stale; it never changes the archived source quote. “Add source” goes through the same source validation and safe fetch pipeline.
- Show unsupported assertions, stale quotes, broken links, repetition and missing required sections as navigable issues. Avoid a single green “Quality 97” score that hides blockers.
- Optional “Suggest rewrite” is a later engine-backed operation. Present a diff with accept/reject, preserve citations and assumptions, record AI assistance and require fresh review. AI must never silently overwrite or approve content.
- Exact publication preview includes title, description, headings, tags, highlights, economics, prompts, sources and OG image. Show desktop/mobile modes. If the public-render adapter is unavailable, label it “Editorial preview—public rendering not yet verified”.

### Evidence review

Each source row shows publisher/domain, canonical URL, source type, publication/retrieval dates where known, freshness, associated claims, verification result/reason, and a short permitted excerpt. Expand to see the quote and its context. Open the original externally with a clearly labelled link, not an arbitrary embedded website iframe.

Use distinct labels: **Machine verified**, **Reviewed by you**, **Unavailable**, **Changed since review**, **Provisional search summary**, **Assumption**. A successful HTTP request is not fact verification. A human check of an excerpt must not manufacture a provider-verification result.

You can mark a supported claim reviewed, flag a discrepancy, add an editorial note, or request more research with a precise question. Keep negative evidence and limitations visible. A link-open event or scroll completion never counts as “read”; sign-off is an explicit attestation.

### Human review and approval

1. **Accept idea** means the buyer/problem/wedge merits editorial work. Record a rationale. You may disagree with an engine recommendation, but cannot override factual/security blockers to approve publication.
2. Read all eight article sections; explicitly mark each reviewed for the current content hash. Review every material claim and source, the competitor/pricing comparisons, assumptions/economics, metadata/highlights and final preview. Require notes for resolved discrepancies.
3. The checklist shows exactly what remains. Unreviewed sections and unresolved high-severity issues disable Approve with linked reasons. There is no “Mark everything read” action.
4. **Approve revision** records your statement that you reviewed the content and evidence of that fixed revision. All required automated checks must be current. Edits to content, sources, metadata/highlights, policy or render artifacts invalidate affected sign-offs and the overall approval; unaffected section reviews may remain only if dependency hashes prove they are unchanged.
5. **Publish** is separate. The confirmation shows the exact revision, new/republication status, public URL, summary of changed claims/sections, checks, approval time and previous live version. Require recent strong authentication. The release runs asynchronously, with readable stages and persistent history.

No software can establish that a person cognitively read a page; this product enforces explicit, revision-bound attestation, not fake scroll/time “proof”. No automated or service actor can provide that attestation.

### Existing live ideas and deletion

Import existing ideas as “Live—legacy evidence not reverified”, with the actual body origin and a snapshot of the current content and metadata. Preserve slug, first publication date and stable idea identity. Never downgrade a live page merely because it predates the new checks.

- **Edit** creates a private revision from the live snapshot. **Discard revision** leaves live content unchanged. **Republish** requires the same complete review as a new idea and shows the live-versus-proposed diff.
- **Unpublish** explains all affected surfaces: direct page, lists, homepage picks, sitemap, APIs and prompt exports. Require a reason and confirm; show Pending until removal is verified. Preserve reader saves/plans with an “Idea unavailable” state and preserve private editorial history.
- **Move to Trash** is allowed for an unpublished/non-live idea; a live item offers Unpublish first. Trash is recoverable, searchable and excluded from ordinary lists. Restore returns it unpublished and awaiting review. No automatic trash expiry or permanent-delete UI in v1.
- **Reject** is an editorial decision with reason categories (duplicate, weak pain, no wedge, infeasible, insufficient commercial case, other). It preserves research and can be reopened to Needs review. It never unpublishes an already-live revision.
- **Rollback** selects an earlier successful release, shows its diff and renewed safety/evidence checks, and asks for explicit confirmation. No blind “roll back deploy” affecting unrelated releases. Emergency unpublish stays available even if evidence checks currently fail.

## Useful additions and prioritisation

**V1:** source/claim ledger, version history and diff, autosave/conflict recovery, rejection reasons, evidence freshness queue, filters, exact-release checklist, private preview, release recovery, audit log, trash/restore, duplicate links, public/private state comparison and backup/export of your own editorial bundle.

**After the real publishing gate passes:** operator-triggered bounded re-research, accepted-diff AI rewrites, saved filters, notifications for failed releases/stale evidence, link-health batches, per-idea analytics when actual data is connected. Spend confirmation and budgets precede research actions.

**Defer:** teams and delegated roles, customer moderation, billing/CRM, scheduled publishing, autonomous approvals, bulk destructive operations, browser scraping credentials, rich-text collaboration, full website CMS and a second public content store.

## Design acceptance

Deliver queue/library/workspace/release/trash layouts at 1440, 1024 and 390px, including loading, empty, unavailable-source, save failure, conflict, approval revoked, denied access and partial-release failure states. Test keyboard-only review and dialog focus return, screen-reader labels/announcements, contrast, text zoom and reduced motion. Keep data tables semantic; if using windowing, verify screen-reader and keyboard access rather than assuming it.
