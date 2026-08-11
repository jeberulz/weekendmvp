# WP19 Progress - Playbooks lead-magnet microsites

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-11 - Setup

- Branch/worktree: `claude/lead-magnet-ideas-mvp-hhsajy`, primary worktree (no worktree needed; single agent, no parallel WPs)
- Assignment: Build a config-driven `/playbooks/{slug}` framework-microsite engine and ship The Decision Stack as its first instance
- File boundaries: `components/playbooks/`, `app/playbooks/`, plus four surgical edits to `app/api/subscribe/route.ts`, `app/sitemap.ts`, `next.config.ts`, and `docs/PROJECT_STRATEGY.md`
- Required checks: `npm run typecheck`, `npm test`, `npm run build`. `npm run lint` is listed in `.agentic-workflow.yml` but no such script exists in `package.json` — recorded N/A.
- Initial risks:
  - A root-level dynamic segment would swallow the `LEGACY_ORIGIN` fallback rewrite and the 404 route. Mitigated by namespacing the route under `/playbooks`.
  - `ALLOWED_UTM_CAMPAIGNS` silently downgrades unknown campaigns to `starter-kit`, so a missed allowlist entry produces a working form with invisible analytics rather than a visible failure.
  - Tailwind v4 has no config theme; any class string assembled at runtime is dropped by the source scan unless spelled out as a literal.
  - The email round-trip cannot be exercised without `BEEHIIV_API_KEY` and `BEEHIIV_DEFAULT_*`; that leg will be reported honestly rather than assumed.

## 2026-08-11 - WP19-S1

- Actions taken: Created the work-package records ahead of any code, per `AGENTS.workflow.md`.
- Decisions made: Scope confirmed with the owner before planning — The Decision Stack first, free page with a gated pack, the 1:1 MVP Sprint as the closing CTA, and a reusable engine rather than a one-off page.
- Checks run: None yet.
- Result: In progress.
- Gotchas: Found a pre-existing defect while mapping the email path — `app/(marketing)/dare/DareSeatForm.tsx` posts `utm_campaign: "dare-workshop"`, which is absent from `ALLOWED_UTM_CAMPAIGNS`, so every DARE signup is currently recorded as `starter-kit`. Fixed alongside the new `playbook` entry since it is the same one-line constant.
- Next: Build the `components/playbooks/` library.

## 2026-08-11 - WP19-S1 / S2 / S3 / S4

- Actions taken: Built `components/playbooks/` (types, access helper, server sections, client forms), the `/playbooks/{slug}` route with a bare layout and config registry, The Decision Stack config, and the four plumbing edits.
- Decisions made:
  - Rendered every diagram as flex/grid text rather than an image, so the bands stay crawlable, translatable, and readable in source order — and remain screenshot-able for social without an export step.
  - Wrote a dedicated `PlaybookStats` rather than reusing `components/marketing/sections/Stats.tsx`. That band is a centered, light-surface row with accent-coloured numerals and uppercase labels; these are inverted tiles with Newsreader numerals. Reuse would have meant fighting its props, so it stayed a separate component.
  - Split the accent by contrast rather than using one orange: `#A03D00` for body-size accent text and solid accent buttons on cream (6.4:1), `#cc5500` for rules, icons and tints only (4.1:1, above the 3:1 non-text floor but below the 4.5:1 text floor), `#e9a06a` with ink text on the dark CTA card (8.1:1). Both values already exist in the codebase.
  - Breadcrumb is two crumbs, not three: there is no `/playbooks` index page yet and a crumb pointing at a 404 is worse than a shorter trail.
  - Left the layer numbering on `<ol reversed>` so the implicit list numbering counts down to match the rendered 6→1 order.
- Checks run:
  - `npm run typecheck` — clean. `npm test` — 108 passing across the four node suites plus 5 Convex tests, 0 failures. `npm run build` — compiled, `/playbooks/decision-stack` prerendered. `npm run lint` — N/A, no such script.
  - Route behaviour against `npm start`: page 200, `/decision-stack` 307 → `/playbooks/decision-stack`, unknown slug 404, canonical and sitemap entry both correct (283 URLs total).
  - Chrome-free confirmed: zero `<nav>` elements, and the only `<header>`/`<footer>` are the playbook layout's own. `MegaNav` appears in the flight payload solely as the not-found boundary's client module reference — nothing rendered.
  - Gate matrix in a real browser: fresh visitor locked (2 forms), and unlocked for a `weekendmvp_subscribed` holder, an `ideas_email` holder, and a `?utm_source=beehiiv` arrival (1 form). The framework body renders in all four states.
  - Copy button writes the full 810-character prompt to the clipboard. Tab order follows visual order: logo → hero email → hero submit → both copy buttons → pack email → pack submit → CTA → footer.
  - Contrast: 11 sampled foreground/background pairs computed against WCAG 2.1 AA; all pass. Rendered at 390px and 1280px with no horizontal overflow.
- Result: Complete. All four stories met their acceptance criteria.
- Gotchas:
  - **Two defects found and fixed by looking at the rendered page rather than trusting the build.** (1) The loop connectors were `<li>` siblings inside the `<ol>`, so each diagram announced eleven list items with five empty ones and misleading numbering; connectors now sit inside the `<li>` they precede. (2) `border-stone-400` on the email inputs was 2.5:1 against the white panel and failed WCAG 1.4.11; moved to `border-stone-500` at 4.8:1.
  - A stale `next start` from before a rebuild survived a `pkill` and kept serving replaced chunk hashes, which looked like a page failure. Killed by PID; the page was fine.
  - Playwright reaches `localhost` only with the agent proxy disabled (`--no-proxy-server` plus `NO_PROXY`), otherwise every navigation returns `ERR_PROXY_CONNECTION_FAILED`.
- Verification NOT done, and why: the live Beehiiv round trip. `BEEHIIV_API_KEY` is absent in this environment, so `/api/subscribe` returns its documented 500 before reaching Beehiiv, and `routed_to.utm_campaign` could not be observed on a success response. What was verified instead: every `utm_campaign` posted from client code resolves against `ALLOWED_UTM_CAMPAIGNS` (both the literal `dare-workshop`/`shipable-workshop` call sites and the `PLAYBOOK_UTM_CAMPAIGN` constant). **Confirm `routed_to.utm_campaign === "playbook"` on the first real signup after deploy.**
- Next: Deploy, then the follow-ons — a `playbook-8slide` carousel layout, a `playbook` OG surface, and a `/playbooks` index once three exist.

## 2026-08-11 - Post-PR verification attempt

- Actions taken: Opened as [PR #45](https://github.com/jeberulz/weekendmvp/pull/45) on `922999e`. Attempted the outstanding Beehiiv attribution check against the Vercel preview deployment. Corrected the auto-generated PR description and subscribed to PR activity.
- Decisions made: Did not attempt any workaround for the blocked network egress — no disabling TLS verification, no unsetting `HTTPS_PROXY`. The check moves to post-deploy.
- Checks run:
  - `GET` and `POST` against `https://weekendmvp-git-claude-lead-magne-65b4fe-john-iseghohis-projects.vercel.app` — **blocked**. Four attempts, plus `https://www.weekendmvp.app`. The agent proxy answers `403` to `CONNECT` for both hosts (`gateway answered 403 to CONNECT (policy denial or upstream failure)`). This session's network policy does not permit either origin.
  - CI on the PR: `Vercel Preview Comments` success; `check-links` **failure**.
- Result: **The Beehiiv attribution check remains unverified.** No subscriber was created — the request never left this environment. The owner approved testing with `iseghohi.john+wp19@gmail.com`; that address was never submitted anywhere.
- Gotchas:
  - **`check-links` CI is broken repo-wide and predates this branch.** `.github/workflows/ci.yml` runs `npm run check:links`, `check:stylesheets` and `check:all-nav`. `git log --all -S` confirms **none of those three scripts has ever existed in `package.json` in any commit**. The job therefore fails at its first check step on every PR and every push to `main`, and has never passed. The `npm run build` step inside the same job succeeds here and prerenders `/playbooks/decision-stack`. Out of scope for WP19; raised with the owner rather than silently repointing the repo's merge gates, which is a product decision (`AGENTS.workflow.md`: unknown scope means stop and ask).
- Next: Owner to confirm `routed_to.utm_campaign === "playbook"` on the first real signup after deploy. Awaiting a decision on whether to repair `ci.yml` as separate work.
