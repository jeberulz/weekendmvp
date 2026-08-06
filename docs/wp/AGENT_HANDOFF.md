# Agent Handoff — Build Platform Program (post-WP27)

Last updated: 2026-08-06 (Europe/London). Agent-agnostic. Supersedes
`docs/wp/CLAUDE_HANDOFF.md`.

**WP27 package gate: Pass.** Next work is owner-directed: WP28, WP26-S2..S6,
or the preview retention follow-up. Do not reopen closed WP27 ACs.

---

## 1. Read these first, in this order

1. `CLAUDE.md` (root)
2. `AGENTS.workflow.md` + `.agentic-workflow.yml`
3. `docs/wp/program-manifest.md` — **frozen** program source of truth
4. `docs/wp/RULINGS.md` — append-only. **Never edit a row.** Do not re-ask.
5. `convex/_generated/ai/guidelines.md` — before any `convex/` work
6. Then the package you open:
   - WP28 → freeze `docs/wp/wp28-stories.md` first (does not exist yet)
   - WP26 → `docs/wp/wp26-stories.md` + `docs/wp/wp26-progress.md` on its branch
   - Retention Small Fix / WP → see §6

**Treat `*-progress.md` as claims, not evidence.** Verify before relying on
numbers. One WP27 progress line was already proven false (soft-404 measured
against `next dev`).

---

## 2. Where the work is

| | |
|---|---|
| Just closed | WP27 on `codex/wp27-site-preview` |
| HEAD | `0a13b2b` (`docs(wp27): close S6 gate after claim-only ruling and live signup`) |
| Branched from | `codex/wp26-research-workflow` (Wave 2 gates + WP26-S1) |
| Parallel branch | `codex/wp26-research-workflow` — WP26-S2..S6 **unstarted, unblocked** |
| Not merged to | `main`. **Entire platform program is still unmerged.** |

```
0f969bc docs(wp27): story freeze
eccd757 S1  capability contract + additive preview_capabilities table
965bac4 S2  /build/{slug} anonymous generation (HMAC bridge, rate limit)
6340634 S3  three templates + per-template security matrix
72b9350 S4  /preview/{token} isolated route
bff2a1f S5  claim on signup
798e203 S6  gate findings + fixes
5d1002c docs  agent-agnostic handoff
0a13b2b docs  S6 closeout (ruling A + live claim journey)  ← HEAD
```

### WP27 status (closed)

| Story | State |
|---|---|
| S1–S5 | done |
| S6 package gate | **Pass** — `docs/wp/wave-gate-report.md` (WP27 Package Gate - 2026-08-06) |

Key rulings (already in `RULINGS.md` — do not re-litigate):

- Additive `preview_capabilities` table; do not relax WP22 `ownerId`
- 7-day reusable capability; expiry enforced server-side
- Three templates; per-template security/a11y matrices
- **Claim-only exclusivity** after claim: B cannot claim; URL possession =
  read auth until expiry
- Watermark contrast 1.09 accepted as WCAG pure decoration (tests pin the
  three conditions that keep the exemption valid)

---

## 3. What WP27 shipped (context for next packages)

Anonymous stranger → customise → generate → `/preview/{token}` → signup keeps
it as an owned project.

```
/ideas/{slug} ──▶ /build/{slug} ──▶ POST /api/platform/preview/generate
                                      │ HMAC bridge + IP rate limit
                                      ▼
                         convex generate (quota mutation commits first)
                                      │ plaintext token once
                                      ▼
                              /preview/{token}
                                      │ Keep this site
                                      ▼
                         /signin → magic link → /dashboard
                                      │
                                      ▼
                         platform.preview.claim → project graph
```

Key paths: `convex/platform/preview/*`, `components/preview/templates/`,
`app/preview/[token]/`, `app/build/[slug]/`, `app/api/platform/preview/`,
`lib/analytics-redaction.ts`.

**Merge constraint:** four already-merged components link to `/build/{slug}`
(`PreviewIdeaCta`, `ExploreCard`, `DashboardHome`, `ProjectCard`). Merging
platform UI without this branch ships a dead primary CTA. `/build/{slug}`
exists on this branch now.

---

## 4. Choose next work (owner must pick)

Do **not** start coding until the owner names a lane. Options:

### A. WP28 — tenant publish, host routing, leads (natural sequel)

- Manifest: Critical, Wave 3. Sole owner of `proxy.ts`/`middleware.ts` host
  routing, tenant routes, lead APIs, activation runbook.
- Depends on WP21, WP22, WP27 (all code-gated; WP27 just passed).
- **No production wildcard/DNS/domain activation** in WP28 — that is WP31.
- Unknown product questions still open in the manifest (legacy fallback,
  reserved subdomains, staging host, lead retention) — escalate to
  `RULINGS.md` before freezing stories.
- Branch: create `codex/wp28-…` from an agreed base (likely this WP27 branch
  or the integration branch — **ask**, do not assume).

### B. WP26-S2..S6 — Validation Report engine (parallel, unblocked)

- Branch already exists: `codex/wp26-research-workflow`
- S1 contract subgate passed. Providers ruled: `gpt-5.6-sol` (pin dated
  snapshot at S2), Perplexity (citation-only), DataForSEO (keywords; no LLM
  fallback), **$4.00/report** hard cap.
- High-risk AI work: fixture-mode only until WP26's own gate; cost reserved
  pre-call; keyword step fails closed if provider missing.

### C. Preview retention cron (MEDIUM, blocks public free-preview)

- `preview_capabilities.by_expiresAt` exists; nothing reads it; no
  `convex/crons.ts` yet. Expired rows accumulate unboundedly.
- First cron in this deployment → new scope. Prefer a small Work Package or
  owner-scoped story, not a silent drive-by on the WP27 branch.
- **Required before exposing anonymous free preview publicly.**

### Also pending (not the immediate pick unless asked)

- Bridge HMAC: no nonce/expiry/single-use (LOW today; blast radius if logged)
- ConsentBanner contrast 4.17 (site-wide Small Fix, outside WP27)
- WP38 admin plan (`codex/wp38-admin-plan`) must merge before production
  activation; follows WP30, gates WP31

---

## 5. Traps that will cost you hours

Learned on WP27. Still apply.

1. **Soft-404 under Cache Components.** `/preview/{token}` and `/build/{slug}`
   return HTTP **200** for unknown/expired/malformed — PPR shell commits
   before `notFound()`. `export const dynamic` is incompatible with
   `cacheComponents`. Measure status against **`next build` + `next start`**,
   never `next dev`. No status oracle (valid and invalid both 200);
   non-indexability is `X-Robots-Tag`.
2. **`convex-test` ignores public/internal visibility.** Assert that boundary
   statically.
3. **`api` is a proxy** — `Object.keys(api…)` is `[]`; vacuous forever.
4. **`import.meta.glob` must be root-absolute:** `"/convex/**/*.ts"`. Every
   rejection assertion must name the expected error.
5. **Green targeted tests ≠ CI.** Confirm the suite count moves in full
   `npm test` (`.tsx` under `tests/security/` was once orphaned from
   `test:security`).
6. **Strip comments before static security asserts** (`readCode()` in
   `tests/security/wp27-preview-*.test.mjs`).
7. **Rate limit in a failing mutation rolls back.** Keep
   `consumeGenerationQuota` as its own committed mutation.
8. **Never pass client `now` for expiry.** Public `action` reads `Date.now()`,
   `internalQuery` trusts it.
9. **`grep` masks exit codes** — use `${pipestatus[1]}` in zsh.
10. **Mutation-test security suites** — break on purpose, confirm red.
11. **Auth claim journey must share origin with Convex `SITE_URL`.** Locally
    that is `http://localhost:3000`. Stash is `sessionStorage` on sign-in;
    magic link on a different port loses the claim. Use `:3100` only for
    production-build header/cache checks.
12. **Never print secrets.** Convex MCP `envList` returns raw values — do not
    paste them into chat, docs, or commits.

---

## 6. Local environment

```bash
npm ci
npm run convex:dev     # terminal 1 — required for preview/platform
npm run dev            # terminal 2, port 3000  (matches SITE_URL / magic links)
# status/header/cache evidence:
npm run build && npx next start -p 3100
```

- Local Convex: `http://127.0.0.1:3210`
- `PLATFORM_PREVIEW_BRIDGE_SECRET` in **both** `.env.local` and Convex env
  (≥32 chars, same value). Unset ⇒ generate 503. **Never print it.**
- Network blip can kill local Convex silently → valid tokens look "not found".
  Restart `convex:dev`.
- After new Convex modules: `npx convex codegen --typecheck disable`

Generate a preview token (prefer `:3100` after a production build for header
checks; `:3000` for auth funnel):

```bash
curl -s -X POST http://localhost:3000/api/platform/preview/generate \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:3000' \
  -d '{
   "slug":"ai-collectible-verification-platform","templateId":"editorial",
   "customisation":{"headline":"Verify any collectible in under a minute",
    "subheadline":"Photo in, provenance out for collectors who hate waiting.",
    "problemStatement":"Collectors lose thousands to fakes because verification takes weeks and trusted labs are scarce.",
    "keyBenefits":["Instant photo-based authenticity scoring"],
    "callToAction":"Verify my collectible"}}'
```

Rate limit: 5/min burst, 40/hour sustained, per IP (/64 for IPv6).

---

## 7. Checks — report honestly

```bash
npm run typecheck
npm run lint          # 35 pre-existing warnings, 0 errors baseline
npm test              # WP27 closeout baseline: node 91/6/7/46/4, vitest 125/172/57/567
npm run build         # 312 pages at WP27 closeout
npm audit --omit=dev --audit-level=high
git diff --check
```

Never report success on red. `CI check:links` script-name mismatch is
pre-existing — ignore.

---

## 8. Hard safety boundaries

- No production deploy, data backfill, DNS/wildcard activation, live Stripe
  charge, external send, credential rotation, or Ideabrowser offboarding
  without manifest gates.
- Never print/log/commit secrets.
- Never accept caller-supplied owner IDs — derive identity server-side.
- `convex/schema.ts` is a one-writer seam. WP27 added one table (31+/0−).
  Do not relax frozen WP22 `ownerId`.
- `middleware.ts` / `proxy.ts`, lockfiles, webhooks, generated Convex files
  are serialized seams — coordinate.
- Host routing / tenant hostnames / live leads = **WP28+**. WP27 must not
  resolve hosts; `site_configs.hostname` stays undefined until WP28.
- Private platform + preview surfaces stay non-indexable.

---

## 9. Working norms the owner expects

- "Plan" = write the plan to a markdown file and **stop**. Do not implement
  unless told to build.
- Commit/push requests are hard stops — do them immediately, nothing else
  bundled.
- Read the real code path before changing prompts/routes/integrations.
- No `any`, no `console.log` in committed code, no inline styles.
- Accessibility is a requirement.
- Run typecheck + tests after changes before claiming done.
- Surface unmet ACs explicitly. Do not close a gate by reinterpretation
  without an owner ruling in `RULINGS.md`.

---

## 10. First message to the owner

Ask which lane to open:

1. **WP28** (tenant hosts / publish / leads) — freeze stories first  
2. **WP26-S2..S6** on `codex/wp26-research-workflow`  
3. **Retention cron** for `preview_capabilities` before public free-preview  

Then branch (if needed), read the matching stories/manifest slice, and proceed
in the Work Package lane.
