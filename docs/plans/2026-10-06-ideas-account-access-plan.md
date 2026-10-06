# Ideas account access — proposed plan

Status: **approved for implementation on 2026-10-06**. The owner chose the verified-account gate and automatic Beehiiv sync for each newly created account.

Lane for implementation: **Work Package** (auth, public content, and UX flow).
Implementation branch: `codex/wp57-ideas-account-gate`, based on `origin/main` at `0db3fd07`.

## Understanding

The two screenshots show the current `/startup-ideas` gate and an `/ideas/{slug}` gate. Entering a first name and email subscribes through Beehiiv and unlocks the browser, but does not create a Weekend MVP account. A visitor who later opens the dashboard must sign in separately. The requested journey is one embedded create-account/sign-in experience at those gates, followed by a return to the exact library or idea page the visitor was trying to open. Existing signed-in members should read immediately.

“Cannot access” requires a **verified account**, not merely a submitted email. Sending a magic link is not the successful unlock; completing the link or Google sign-in is. A Beehiiv-only subscriber needs to verify the same address to create a site account. Every newly verified account is synced to Beehiiv. Beehiiv double opt-in keeps marketing automation pending until its separate confirmation; existing unsubscribed contacts are not reactivated.

## What the repository does today

- `StartupIdeasGate` and `EmailGate` use the shared `gate-access.ts` state machine. It unlocks from `ideas_email` in local storage, a signed-in hint cookie, a verified `?e=`, a Beehiiv UTM click, or localhost. The gate form posts to `/api/ideas-subscribe`.
- The public library and full idea research are already in the server-rendered HTML. The client hides or blurs them after hydration. This is a visual/lead-capture gate, **not a content access boundary**; the current design deliberately favors indexing.
- Convex Auth already provides passwordless email via Resend and Google. `AuthCard` serves `/signup` and `/login`, with a confirmation step for email. The auth provider is scoped to auth/private routes to keep public pages from becoming dynamic.
- The safe return path is limited to `/dashboard/**` and `/admin/editorial/**` in Next, Convex Auth, and Resend link creation. Supplying `/startup-ideas` or `/ideas/{slug}` today falls back to `/dashboard`.
- Existing rulings make `/ideas/{slug}` the sole canonical research URL and `/startup-ideas` a crawlable discovery page; public research is free, and Builder's Hub activation is separate. A genuine account gate for full research needs a new owner ruling that amends the crawlability contract.

## Recommended experience

1. Keep the current public URLs. Anonymous visitors see an indexable title/description and a purposeful account panel; members see the library or full research on those same URLs. Do not create a duplicate research route in the dashboard.
2. Put one reusable account UI into the two gate placements. Offer **Create free account** and **Log in** states, one email field for the existing magic-link flow, and Google. The email path says “Check your inbox,” then uses the existing confirmation step. First name can be collected later as optional profile data; it is not needed to authenticate.
3. Preserve intent end to end: `/startup-ideas` returns to `/startup-ideas`; `/ideas/example` returns to `/ideas/example`; a direct dashboard sign-in still returns to the dashboard. Switching between create account and log in keeps the same destination. A signed-in visitor never sees the gate.
4. Treat login as complete only after Convex verifies the session. Do not use `ideas_email`, Beehiiv campaign parameters, or the readable `wmvp_signed_in` hint cookie as authorization. The hint may still avoid unnecessary UI work, but the server decides whether protected content is sent.
5. Explain in the account UI that account creation also adds the email to Weekend MVP's Beehiiv audience. After a verified account is first created, enqueue a server-side, once-per-account sync. Force Beehiiv double opt-in for new subscribers; preserve prior unsubscribes; route confirmed subscribers into the platform onboarding automation. The site account works whether Beehiiv is available or confirmed. Existing subscribers can use the same email to get a site account; do not import or silently create accounts from Beehiiv records.

### Content and SEO choice

**Recommended if “cannot access” is literal:** serve only a public teaser and account form to anonymous visitors; send the full index/research only after server-side session verification. Keep canonical URLs and public metadata. Crawlers receive the same teaser as other anonymous visitors, so the full research will no longer be indexed. Public hubs/homepage may still show preview cards if approved, but every full research entry uses the same account boundary. Audit public data APIs and raw HTML so the body cannot be recovered by bypassing the client overlay.

**Alternative if full-content SEO has priority:** replace the Beehiiv form with account UI while keeping server-rendered research public. This gives visitors an account and a smooth return path but remains a soft gate that can be bypassed. It would not satisfy a strict reading of “cannot access.”

## Work Package sequence

1. Record the owner rulings for the account requirement, SEO consequence, and Beehiiv sync. Register WP57 and freeze stories/progress before code. Audit `/startup-ideas`, `/ideas/{slug}`, collection and hub pages, public Convex queries, APIs, feeds, sitemap, newsletter deep links, and nav CTAs. Keep the paused publishing and Builder's Hub work out of scope.
2. Define one narrow, same-origin return-target contract for the two public destinations plus existing private destinations. Apply it consistently in `lib/auth-return.ts`, the Convex Auth callback, Resend link generation, the email confirmation screen, and middleware. Reject external, protocol-relative, malformed, encoded bypass, auth-loop, and retired/unknown idea targets; preserve only safe filter/query state and never put email addresses or tokens into `returnTo`.
3. Extract/reuse the existing email/Google auth controls as a gate-sized auth island. Scope its provider so canonical public pages do not acquire a root-wide auth dependency. Verify how Next 16 Cache Components handles the per-session gate before choosing the final rendering boundary. Give both pages responsive, keyboard-accessible pending, sent, expired, retry, and error states.
4. Implement the chosen content boundary. For the strict option, render public teaser metadata separately from protected list/research content; verify auth on the request that returns member content, including RSC/navigation requests, and prevent shared cache leaks. Remove the old local-storage/Beehiiv unlock paths and localhost bypass for access decisions. Preserve the actual 404/retired-idea behavior and canonical metadata.
5. Add automatic, server-side Beehiiv sync only on first verified account creation, with a durable idempotency record and bounded retry. Keep the existing newsletter/Starter Kit flows. Retire or narrow the old idea-subscribe/verify endpoints and `?e=` handling after checking inbound campaign links. Update gate copy and analytics to distinguish account start, link sent, verified account, and Beehiiv confirmation.
6. Gate with redirect/security tests for both email and Google; anonymous/member/expired-session and existing-subscriber journeys; raw HTML and API leakage checks; canonical, robots, sitemap, 404 and collection regressions; mobile/keyboard/screen-reader review; and the configured typecheck, lint, tests, and production build. Use isolated auth/backend setup. No production auth or publishing change is part of plan approval.

## Acceptance examples

| Starting point | Expected result after verification |
|---|---|
| Anonymous opens `/startup-ideas` | Embedded account UI; account creation or login returns to the library. |
| Anonymous opens `/ideas/example` directly | Embedded account UI; verification returns to that exact published idea. |
| Existing Beehiiv subscriber without a site account | Can verify the same email and enter as a member; prior newsletter status does not itself unlock. |
| Signed-in member opens either URL | Full content opens without another form. |
| Email link opened later or Google callback completes | Same safe destination survives; failed/expired links offer retry with intent intact. |
| Crafted `returnTo` or forged session hint | Cannot redirect off-site or reveal member-only content. |

## Approved decisions and implementation defaults

1. **Hard content gate:** full library and research require verified membership. This supersedes the prior full-content crawlability ruling; the canonical URLs and public teaser metadata remain.
2. **Public preview:** title, summary, category, and selected cards in marketing/hubs remain public. The complete library and research require sign-in.
3. **Beehiiv:** every newly verified platform account enters a server-side Beehiiv sync. The sync forces double opt-in, never reactivates an unsubscribed contact, and never blocks account access. Beehiiv's separate confirmation activates marketing messages and automations.
