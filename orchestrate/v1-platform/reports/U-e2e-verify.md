# U-e2e-verify — production stranger-journey verification

- **Status:** complete (all acceptance steps attempted; stopped at env gates, not at timebox)
- **Production SHA:** `80d6f27` (`80d6f27fa6bfee1bd9150e07a11fba699e8d8377`, PR 56 squash-merge)
- **Verdict: `verifier-blocked`** — auth/env, not product code
- **Surface:** `https://www.weekendmvp.app` only. Local checkout never served the product (local `HEAD` confirmed stale at `4ee44b22980a34aa9c2d548293d643a2e557600d`; `origin/main` ref read only for env-var attribution).
- **Date:** 2026-08-14

## Verdict reasoning

The brief permits `live-ui-verified` only if idea → build → **preview render succeeded**. It did not: preview
generation returns `503 PREVIEW_NOT_CONFIGURED`. So the verdict is not `live-ui-verified`.

The choice between `verifier-failed` (product/Convex) and `verifier-blocked` (auth/env) resolves to
**`verifier-blocked`**. Both blockers are unset production environment variables. I found **no product-code or
Convex-schema defect**. In both failures the shipped code fails closed by design, returns a typed error code,
and surfaces a calm user-facing message with the user's input preserved. Convex production is reachable and
seeded (proven below). This is a deploy-configuration gap on a working build.

## Journey table

| # | Step | URL | HTTP | Result |
|---|------|-----|------|--------|
| 1 | Idea page | `/ideas/abandoned-cart-recovery` | 200 (`x-matched-path: /ideas/abandoned-cart-recovery`, `x-nextjs-prerender: 1`) | **Pass.** Full research page renders. `Preview this idea` CTA present, `href="/build/abandoned-cart-recovery"`. |
| 2 | Build UI | `/build/abandoned-cart-recovery` | 200 (`x-matched-path: /build/[slug]`) | **Pass.** Real build UI, not a marketing 404. Title `Preview this idea \| Weekend MVP`. Layout radios (editorial/product/minimal), fields pre-filled from idea research, copy confirms `No account needed yet` and `expires in 7 days`. |
| 3 | Generate anonymous preview | `POST /api/platform/preview/generate` | **503** `{"ok":false,"code":"PREVIEW_NOT_CONFIGURED"}` | **FIRST BLOCKER.** Button → `Building your preview…` → reverts. UI shows `We could not build that preview. Your wording is still here; try again.` Form state preserved. GA fired `preview_started` (`ep.template=editorial`). |
| 4 | Preview render | `/preview/nonexistent-token-probe` | 200 (`x-matched-path: /preview/[token]`) | **Route healthy, render unproven.** Invalid token renders the correct empty state: `This preview link isn't available` / `Preview links are private and last seven days.` No real token could be minted because of step 3. |
| 5 | Signup / signin (magic link) | `POST /api/auth` from `/signin` (200) | **400** `{"error":"[Request ID: 404203ed681625d4] Server Error"}` | **SECOND BLOCKER.** UI shows `We could not send a sign-in link. Please try again.` Synthetic address `e2e-verify-80d6f27@example.com`; no real customer email used. Google OAuth button present but **not clicked**. |
| 6 | Claim preview into project | — | — | **Not reached.** Blocked by 3 and 5. |
| 7 | Credits / checkout | `POST /api/platform/billing/checkout` | **401** `{"ok":false,"code":"AUTHENTICATION_REQUIRED"}` (GET → 405) | **Correctly gated.** Stripe mode (test vs live) **undetermined** — the gate sits before any mode signal. **No charge attempted.** |
| 8 | Publish / tenant host | — | — | **Not reached.** Cannot assess WP31 DNS; no project ever existed to publish. |

Auth middleware verified sound: `/dashboard`, `/dashboard/projects`, `/dashboard/credits` all `307 → /signin?returnTo=…`.
`/explore` is `404` (noted, not diagnosed — may be intentionally nested under `/dashboard`).

## First blocker

**`POST /api/platform/preview/generate` → `503 PREVIEW_NOT_CONFIGURED`**, at step 3, the first step that
requires production secrets.

### Root cause, narrowed to one variable

`app/api/platform/preview/generate/route.ts` @ `origin/main` returns that single code from exactly two places:

- **line 56** — `readPreviewBridgeSecret(process.env)` threw. Source: `app/api/platform/preview/_server.ts:18`
  reads `PLATFORM_PREVIEW_BRIDGE_SECRET` and throws unless it is present **and ≥ 32 characters**
  (`MIN_BRIDGE_SECRET_LENGTH = 32`).
- **line 60** — `NEXT_PUBLIC_CONVEX_URL` is falsy.

**Line 60 is ruled out.** `GET /ideas/today` returned `302 → /ideas/small-order-wholesale-marketplace`. That
route (`app/ideas/today/route.ts`) only issues an idea-specific redirect after a **live Convex query**
(`api.ideas.latest`) succeeds inside `if (convexUrl)`; on a missing URL or any Convex error it falls back to
`/startup-ideas`. It did not fall back. Therefore `NEXT_PUBLIC_CONVEX_URL` is set, Convex production is
reachable, and the ideas table is seeded.

**Conclusion:** `PLATFORM_PREVIEW_BRIDGE_SECRET` is **unset or shorter than 32 characters** in Vercel
Production. This is the single variable standing between a stranger and a rendered preview.

I also confirmed the request reaches that gate rather than failing earlier: a same-origin `POST` with the
correct payload shape returned `503`, while a malformed payload returned `400 INVALID_PREVIEW_REQUEST` and a
non-JSON content type is rejected `415`. Validation and the origin check both pass; only the secret gate fails.

## Convex / auth / DNS notes

**Convex — healthy, not the problem.** Production deployment is reachable and seeded (proof above). No schema
error surfaced anywhere. Do **not** run `convex deploy` on the strength of this report; nothing here indicates
a Convex code or schema gap. `happy-otter-123.convex.cloud` appears in a client bundle but is a Convex SDK
docstring artifact, not this project's deployment — the string does not exist anywhere in `origin/main`, so it
must not be mistaken for a misconfigured URL.

**Auth — second env gap, and it lives in Convex's env, not Vercel's.** The `400 Server Error` from
`/api/auth` is Convex Auth swallowing a thrown configuration error. Three candidates, all set via
`npx convex env set` on the **production Convex deployment** (not the Vercel project):

1. `AUTH_RESEND_KEY` — `convex/resendMagicLink.ts:161` calls `requireEnvironmentValue(env, "AUTH_RESEND_KEY")`, which throws when absent. Matches the brief's expectation that magic-link fails without Resend.
2. `SITE_URL` — `convex/auth.ts:82` passes `process.env.SITE_URL ?? ""` into `validatedSiteOrigin`, and `convex/siteUrl.ts:12` throws `SITE_URL_CONFIGURATION_ERROR` on an empty or non-conforming value. An unset `SITE_URL` alone is sufficient to produce this exact failure.
3. The magic-link `from` address variable — `convex/resendMagicLink.ts:76` throws `MAGIC_LINK_DELIVERY_ERROR` on an empty value.

All three collapse into the generic `MAGIC_LINK_DELIVERY_ERROR` / `Server Error`, so the response body cannot
distinguish them from outside. **The Convex production deployment logs for request ID `404203ed681625d4` name
the failing variable exactly** — that is the cheapest next read and it needs no code change.

**DNS / WP31 — not assessable.** Publishing was never reachable, so no tenant URL was ever returned. This
report contains **no evidence** for or against the WP31 wildcard DNS gap. Do not read step 8 as a DNS pass or
fail.

**Constraints honoured.** No file written except this report. No commit, push, merge, rebase, `gt`, or
`convex deploy`. No Google OAuth click. No Stripe charge, and live-vs-test mode never observed. No real tenant
lead stored — the only write attempted was a magic-link issuance for `e2e-verify-80d6f27@example.com`, which
failed server-side before any send. Two `POST`s to `/api/platform/preview/generate` were rejected at the
config gate and created nothing.

## Suggested follow-ups

Ordered by what unblocks the most journey per unit of work.

1. **Set `PLATFORM_PREVIEW_BRIDGE_SECRET` in Vercel Production** (≥ 32 chars) and redeploy. Single highest-value fix: it alone unblocks steps 3 and 4 and makes the anonymous journey — the whole v1.0 scope — demonstrable without any auth work. Note this is a server-only secret, so a redeploy is required but the `NEXT_PUBLIC_*` build-time inlining trap does not apply.
2. **Read Convex production logs for request ID `404203ed681625d4`** to name the failing auth variable, then set `AUTH_RESEND_KEY` and `SITE_URL` (and the magic-link `from` address) on the **production Convex deployment**. Do this before writing any auth code; there is no evidence of an auth code defect.
3. **Re-run this verification after (1) and (2)** to reach steps 5–8. Steps 6, 7, and 8 currently have zero production evidence and should not be treated as verified by any unit-test ledger.
4. **Add a production env preflight to the deploy runbook.** Two independent secrets were missing from a deploy that reported success, and both failed silently from the operator's point of view — visible only to a stranger clicking the primary CTA. A startup-time assertion, or a `/api/health` route that reports which platform variables are configured without leaking values, would have caught both before this manual pass. `docs/runbooks/2026-cutover.md` already lists these variables as checkboxes; the gap is enforcement, not documentation.
5. **Resolve the naming smell flagged in `wp27-progress.md:83`** while touching this area: the preview origin check historically borrowed `PLATFORM_BILLING_APP_ORIGIN`. `isAllowedPreviewOrigin` now has its own variable, and the live `403 CROSS_ORIGIN_FORBIDDEN` path was not exercised here because same-origin requests passed — worth a targeted check once previews work.
6. **Investigate `/explore` returning 404** while `components/platform/explore/ExploreWorkspace.tsx` exists. Likely an intentionally nested route, but confirm no dangling link ships to strangers.

### Evidence artifacts

Screenshots were captured to Cursor's ephemeral screenshot directory
(`/var/folders/9r/g5s3gx3547j7ckdgywlj3hm00000gn/T/cursor/screenshots/`) — they are not committed, since this
report is the only file this unit may write:

- `e2e-01-build-page.png` — build UI at step 2, prefilled and functional
- `e2e-02-preview-failed.png` — step 3 failure with the user-facing error and preserved input
- `e2e-03-signin-failed.png` — step 5 magic-link failure

All HTTP codes above are reproducible with `curl -sI` / `curl -X POST` against `https://www.weekendmvp.app`.
Browser evidence came from cursor-ide-browser against production with an in-page `fetch` recorder used to
capture the exact response bodies for steps 3 and 5.
