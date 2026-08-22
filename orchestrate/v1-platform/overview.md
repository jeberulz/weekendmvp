# v1-platform overnight

Owner: coordinator chat. Repo: jeberulz/weekendmvp.

Predicate: a stranger can complete the repository-idea journey on production www.weekendmvp.app at 80d6f27 (idea page, anonymous preview, signup/claim, test-mode credits, publish as far as WP28). Count: U-e2e-verify ledger row `live-ui-verified`. WP31 wildcard DNS and live Stripe stay out. User squash-merged PR 56, so the target is production, not a preview.

Budget: 2026-08-14 03:00 to 08:00 BST. At 06:30 stop spawning and land verified units.

Tracks: land, product, verify.

Landed: origin/main @ b9db0d0 (PR 58 cockpit, on top of PR 56 squash 80d6f27). U-wp29-verify ledger: unit-test-verified at b9db0d0. Primary checkout is `fix/local-magic-link-resend-401` (local Resend 401; not WP29). wp28 ancestry is not on main's DAG. Vercel Production env listing has NEXT_PUBLIC_CONVEX_URL and no PLATFORM_PREVIEW_BRIDGE_SECRET.

## Follow-ups (parked)
- Squash remedy: `git merge -s ours origin/codex/wp28-tenant-hosts` into main to record ancestry. Owner/history call. Do not do it in this run. Blocks future merges from wp23/24/25/26/38, PRs #41/#45, and `codex/wp26-v1.1-engine`.
- WP26 worktree may hold uncommitted S5-looking files not on origin/codex/wp26-v1.1-engine. Snapshot later. Not on the v1.0 critical path.
- Recraft OG tests inherit RECRAFT_* env; hermeticize later. Not a merge blocker.
- Cloud agent environment.json ports must be objects; blocked one spawn. Prefer local workers until fixed.
- Convex production is live and seeded. Do not `npx convex deploy` on E2E evidence. The gap is env, not schema.
- Production env gates (owner): `preview-bridge-prod` then `convex-auth-prod`. Local `.env.local` has `PLATFORM_PREVIEW_BRIDGE_SECRET` (64 chars) and `AUTH_RESEND_KEY`. `SITE_URL` and `AUTH_RESEND_FROM` are absent locally. Do not `vercel env add` / `npx convex env set` until those gates resolve.
- After env is set, run U-e2e-reverify (same brief). Steps 5–8 have zero production evidence today.
- Add a `/api/health` config report later so a green Vercel deploy cannot hide missing platform secrets. Encode, do not spawn tonight.
