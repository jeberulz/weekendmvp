# WP63 Progress — Navigation consistency

Append-only progress log.

## 2026-10-09 — Setup and audit

- Branch: `codex/wp63-navigation-consistency`, root checkout from main `32d370f1`. No worktree needed for this sequential UI package.
- User authorized auditing and fixing old navigation designs across pages, with an anonymous music-royalty idea-page screenshot.
- Lane: Work Package; scope and route inventory frozen in `wp63-stories.md` before implementation.
- Untracked `convex-backup-before-wp46.zip` and `docs/plans/publish-idea-suggest-step.md` are unrelated user data; leave untouched.
- Required checks: typecheck, lint, full tests, production build, diff check, desktop/mobile and keyboard navigation smoke.
- Read handoff, workflow/config, rulings, registry, platform plan/manifest/UX brief, CLAUDE and installed Next layouts/Link/client-boundary guides. README is absent.
- Audit: old anonymous IdeaNav is the sole remaining public site-menu design; all other public shell families use cream MegaNav. Mobile discovery lists omit desktop destinations. Member, editorial and artifact/tenant navigation are intentional separate contexts.
- Reader anchors currently subtract header height only; the floating menu also has a 24px top gap, so offset must use the header's viewport bottom.
- CLAUDE references an `a11y-check` skill, but no such skill exists in the available/local skill inventories. Use direct browser keyboard/focus/overflow/landmark checks and record evidence instead.

## 2026-10-09 — WP63-S1/S2 implementation

- Replaced anonymous IdeaPageNav's legacy two-row header with the exact cream MegaNav used by public/marketing/auth shells; removed unused IdeaNav and its `withSidebar` plumbing. Every individual idea route inherits the repair.
- Preserved `idea-site-header` on the floating shell and changed reader offsets to its viewport bottom plus 8px, so its 24px top gap is included. Member PRIMARY_NAV and account menu stay separate and unchanged.
- Extracted one discovery definition to `components/layout/site-navigation.ts`. Desktop and mobile now share category, revenue, build-time, tool, audience and group-footer destinations. Mobile gains Developer Tools, $5K/month, all three time routes, Replit, v0, All Tools and Weekend Builders.
- Added labelled primary/mobile landmarks, disclosure-to-panel `aria-controls`, a named home-logo link, visible keyboard focus and current-page state for dropdown footer links.
- Final accessibility pass found cream dropdown headings at about 2.5:1 contrast. Cream navigation text now uses neutral-600; measured final heading/link contrast is 6.98:1 against the panel composited over black, and nav text is 4.99:1 over a dark section through its translucent background.
- Corrected audit inventory after the browser pass: `/links` is a standalone social campaign archive with a home-logo link and local filters, not PublicShell. Email confirmation/callback likewise have focused chrome without global menus. These are intentional contexts, alongside workspace/editorial/preview/tenant navigation; there is no legacy site menu on them.

## 2026-10-09 — WP63-S3 gate and closeout

- `npm run typecheck`: pass after regenerating Next route types. Initial failures came from stale `.next/dev/types` referencing removed API routes and a removed newsletter layout. Preserved the old generated cache at `/tmp/wp63-next-dev-before-nav-checks`; no source route changes were needed.
- `npm run lint`: pass, 0 errors / 34 existing warnings.
- `npm test`: final full-suite pass, **2,757 tests**. Includes 2 new rendered navigation regressions and the updated WP44 member-chrome contracts. The new regressions compare real server-rendered idea/public destinations and verify disclosure wiring/current-page state.
- `npm run build`: pass, 434 static-generation entries. Final build used the isolated read-only navigation fixture; a clean build also passed before switching to the fixture. Existing middleware deprecation notice remains.
- `git diff --check`: pass.
- Browser evidence: `tmp/wp63/browser-report.json` covers 22 representative routes (21 shared-menu pages and the standalone campaign archive), including two individual ideas, collection/audience/tool/problem hubs, articles/newsletter index+detail, marketing pages, library, login/signup and global 404. Every shared-menu route had identical destinations, one primary landmark, and the same floating geometry.
- Desktop: keyboard Enter/open, visible focus, Tab into links, Escape/refocus, hover between dropdowns and click-outside dismissal pass.
- Mobile: 320px, 375px and 767px drawer destination parity, one expanded group, no horizontal overflow, Escape/refocus and link-navigation closure pass. Inspected desktop, mobile page and expanded-menu screenshots.
- `tmp/wp63/browser-final-check.json`: all 30 distinct global navigation destinations return 200 locally; final contrast checks pass. A synthetic readable session hint shows the four existing member destinations while the account gate remains present, proving the presentation swap grants no research access.
- Local verification environment: Next 3193 + read-only HTTP fixture 3393. The fixture responds only to public reads, serves no private research, grants no membership and refuses all writes. The historical handoff backend endpoint returned 404, preventing a real-backend idea page from rendering locally; the in-app browser also refused the local URL, so the Playwright skill supplied the browser checks. No real account/email/OAuth flow or production deployment is claimed.
- The fixture browser emitted existing missing local OG-image warnings on homepage cards; they do not affect navigation and were not expanded into this package.
- Documentation updated: CLAUDE navigation convention, registry, stories and this evidence log. No architecture/schema/auth/publishing contract changes or new owner rulings were needed.
- Status: implementation and configured checks complete locally. No commit, push, merge, deploy, production data change, external send or publishing activation performed. Unrelated user files preserved.

## 2026-10-09 — WP63-S4 mobile account placement follow-up

- Owner reports the anonymous account form is buried below all public content on mobile; explicitly asks for the component on arrival, with a restrained presentation, and says desktop is already good.
- Continue this related idea-page polish on the existing WP63 branch, preserving the completed navigation work and unrelated user files. Work Package lane; S4 scoped before editing code.
- Cause: EmailGate's first grid child contains the title, description, entire summary, all teaser sections and all prompts. The account aside is the second child, so the single-column mobile grid puts it last.
- Plan: separate the short public introduction from the long public body; render the one existing account aside between them in DOM order. Desktop uses grid row/column placement to retain the existing left content column and sticky right rail. Make only mobile title/description spacing more compact so the card enters the initial screen; retain existing desktop sizing/spacing and copy.
- Access decisions, auth actions, public content and return targets remain in their existing paths. Repeat the configured checks and compare mobile visibility against desktop geometry using the isolated read-only fixture.

## 2026-10-09 — WP63-S4 implementation and gate

- Split the anonymous public introduction from the long summary/teaser/prompt body. EmailGate now renders introduction → the single existing account aside → public body. Mobile therefore reaches the card before the long read; desktop positions the aside across both content rows in the existing right rail.
- Mobile uses tighter introduction spacing and 28px title/16px description text on phones, preserving full copy. Hid the redundant sign-in paragraph on stacked layouts; the account card retains its existing heading, copy, Google/email controls and account-mode switch. Desktop sizes, spacing and explanatory paragraph remain.
- `tmp/wp63/mobile-account-check.json`: both the pictured music-royalty idea and AdSpark pass at 320×740, 375×812, 390×844 and 768×1024. Each arrives at scroll position zero with the complete account heading and Google action inside the first viewport, exactly one form/email field, no horizontal overflow, and all public summary/teasers/prompts following the card.
- The pictured page's card starts at y=401 on a 375px phone, and its Google action ends at y=671 within the 812px viewport. At 320×740 the action ends at y=720. Cookie consent was dismissed through the existing Reject control before viewport checks/screenshots; the consent component is unchanged.
- Keyboard order from the introduction link reaches Google then the email field before the long content controls; visible email focus passes. The HTTP response still includes the public summary, build prompts and account card. No content, research-access rules, auth actions or return targets changed; no real signup/email/OAuth send was performed.
- Desktop 1440×1000 retains the title at x=176/y=200 and the 440px account card at x=824/y=220; the first summary starts at y=537.5. The account rail remains sticky at 112px while scrolling. Pixel comparison against the pre-follow-up desktop screenshot confirms the content below y=144 is unchanged; the small remaining difference is confined to the Browse Ideas navigation text. Evidence: `tmp/wp63/desktop-pixel-comparison.json`.
- Final screenshots inspected: `tmp/wp63/wp63-account-mobile.png` and `tmp/wp63/wp63-account-desktop.png` (navigation entry animation finished before capture).
- Configured checks repeated: `npm run build` passes (434 static-generation entries), `npm run typecheck` passes, `npm run lint` passes with 0 errors / 34 existing warnings, `npm test` passes all 2,757 tests. Additional public-preview tests pass all 11 tests. Logs are `/tmp/wp63-mobile-{build,typecheck,lint,tests,preview-tests}.log`. `git diff --check` passes.
- Documentation updated: S4 story/checklist, registry, CLAUDE convention and this log. No new owner ruling, architecture/schema documentation or publishing activation needed. Local implementation complete; no commit, push or deploy. Unrelated user files preserved.

## 2026-10-09 — Owner-authorized pull request handoff

- Owner explicitly requests committing and pushing the completed navigation/mobile account-card fixes and creating a PR.
- Fetched origin; branch base matches current `origin/main` at `32d370f1`, with no integration changes needed. Reviewed the final change set and retained the passing implementation/browser evidence above.
- Commit scope is WP63 code, regression tests, CLAUDE convention, registry and package stories/progress only. Unrelated backup/plan files and ignored local verification artifacts remain excluded.
- PR targets `main` and records the local checks, browser evidence and read-only fixture limitation. Merge, deployment and publishing activation remain outside this handoff.
