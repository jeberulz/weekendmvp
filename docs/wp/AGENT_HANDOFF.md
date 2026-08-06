# Agent Handoff — Build Platform Program (WP27 → WP28)

Last updated: 2026-08-06 (Europe/London). Agent-agnostic: written for whoever
picks this up next, in any tool. Supersedes `docs/wp/CLAUDE_HANDOFF.md`, which
now points here.

---

## 1. Read these first, in this order

1. `CLAUDE.md` (root) — project conventions. Applies regardless of which agent
   you are; nothing in it is Claude-specific except the filename.
2. `AGENTS.workflow.md` + `.agentic-workflow.yml` — the delivery workflow you
   must operate inside.
3. `docs/wp/program-manifest.md` — **frozen** program source of truth.
4. `docs/wp/RULINGS.md` — append-only owner decisions. **Never edit a row.**
   Do not re-ask a question already answered here.
5. `convex/_generated/ai/guidelines.md` — Convex rules that override training
   data. Read before touching anything under `convex/`.
6. `docs/wp/wp27-stories.md` + `docs/wp/wp27-progress.md` — the active package.

**Treat `wp27-progress.md` as claims, not evidence.** It is an append-only log
written by the implementer. One entry in it was already proven false by
independent review (see §5). Verify before relying on any specific number.

---

## 2. Where the work is

| | |
|---|---|
| Active branch | `codex/wp27-site-preview` |
| HEAD | `798e203` |
| Branched from | `codex/wp26-research-workflow` (carries passed Wave 2 gates + WP26-S1) |
| Parallel branch | `codex/wp26-research-workflow` — WP26-S2..S6 unstarted, unblocked |
| Not merged to | `main`. **The whole platform program is unmerged.** |

```
0f969bc docs(wp27): story freeze
eccd757 S1  capability contract + additive preview_capabilities table
965bac4 S2  /build/{slug} anonymous generation (HMAC bridge, rate limit)
6340634 S3  three templates + per-template security matrix
72b9350 S4  /preview/{token} isolated route
bff2a1f S5  claim on signup
798e203 S6  gate findings + fixes  ← HEAD
```

### WP27 story status

| Story | State |
|---|---|
| S1 capability contract + table | done |
| S2 `/build/{slug}` generation | done |
| S3 three templates | done |
| S4 `/preview/{token}` | done |
| S5 claim on signup | done (claim-only read exclusivity ruled 2026-08-06) |
| S6 package gate | **Pass** — closed 2026-08-06 |

---

## 3. What this package actually built

An anonymous stranger can generate and view a landing-page preview with no
signup, then keep it by signing up.

```
/ideas/{slug}  ──"Preview this idea"──▶  /build/{slug}
                                            │  customisation form
                                            ▼
                        POST /api/platform/preview/generate
                        (Next: rate-limit key from IP, HMAC-signs payload)
                                            │
                                            ▼
                     convex platform.preview.generate
                     consumeGenerationQuota  ← separate mutation, commits first
                     generateFromBridge      ← inserts preview_capabilities
                                            │  returns plaintext token ONCE
                                            ▼
                                  /preview/{token}
                                            │  "Keep this site"
                                            ▼
                        /signin  →  magic link  →  /dashboard
                                            │
                                            ▼
                            platform.preview.claim.claim
                     → project + site_config + site_version + document
```

Key files:

- `convex/platform/preview/capabilities.ts` — token gen/hash/normalize/expiry,
  `resolveCapability`
- `convex/platform/preview/renderSpec.ts` — `SiteRenderSpec` wrapper, closed
  template enum
- `convex/platform/preview/customisation.ts` — field bounds, `prefillFromIdea`
- `convex/platform/preview/generate.ts` — bridge verify + rate limit + insert
- `convex/platform/preview/read.ts` — public `action` + `internalQuery`
- `convex/platform/preview/claim.ts` — the claim mutation
- `components/preview/templates/index.tsx` — three templates + closed dispatch
- `app/preview/[token]/` , `app/build/[slug]/` , `app/api/platform/preview/`
- `lib/analytics-redaction.ts` — keeps tokens out of GA/Meta

---

## 4. Gate blockers — RESOLVED

Both items that blocked S6 are closed. Details kept below for history.

### 4.1 S5 read-exclusivity — RESOLVED (owner ruling 2026-08-06)

`docs/wp/wp27-stories.md` S5 said a capability claimed by A "cannot be claimed
**or read** by user B."

- *Claim* exclusivity: implemented and tested.
- *Read* exclusivity: **accepted as claim-only.** Owner ruled URL possession
  remains the read authorization until the 7-day expiry. See `RULINGS.md`.
  No code change. Stories AC updated.

### 4.2 Authenticated signup journey — RESOLVED (2026-08-06)

Live evidence against local Convex + `:3000` (matches `SITE_URL`):

- generate → `/preview/{token}` → Keep this site → magic link → `/dashboard`
- `platform/preview/read:view` → `claimed: true`
- exactly **1** `wp27:preview:` project; dashboard reload still exactly 1

### Gate status

**WP27-S6 closed — Pass.** See `docs/wp/wave-gate-report.md` (WP27 Package Gate - 2026-08-06).


---

## 5. Traps that will cost you hours

These were each learned the hard way. Read them.

1. **`/preview/{token}` and `/build/{slug}` return HTTP 200 for everything,
   including unknown/expired/malformed.** Under Cache Components, PPR flushes
   a shell with its 200 before `notFound()` runs. `export const dynamic`
   **errors** (`not compatible with nextConfig.cacheComponents`) and
   `connection()` does not suppress the shell. Not universal —
   `/ideas/{unknown}` and unrouted paths return real 404s. Security is intact
   (all four cases match, so no oracle) but it is a soft-404.
   **`wp27-progress.md` originally recorded `/build/does-not-exist` → 404.
   That was wrong** — almost certainly measured against `next dev`. The line
   is marked corrected in place. **Always measure against a production build.**

2. **`convex-test` ignores public/internal visibility.** It resolves functions
   by module path, so calling an `internalQuery` through `api` succeeds under
   test even though a real deployment refuses it. That boundary can only be
   asserted statically. A runtime assertion there passes either way.

3. **The generated `api` object is a proxy.** `Object.keys(api.foo.bar)`
   returns `[]`. Any assertion built on it is vacuous and will pass forever.

4. **`import.meta.glob` in Convex tests must be root-absolute** —
   `"/convex/**/*.ts"`, not `"../../**/*.ts"`. A relative glob registers
   nothing, every `t.mutation` fails with "Could not find module", and a bare
   `.rejects.toThrow()` swallows it as a pass. **Every rejection assertion
   must name its expected error.**

5. **A green targeted test run proves nothing about CI wiring.** 48 tests once
   sat in `tests/security/*.tsx` while `test:security` globbed only `*.mjs`.
   They passed standalone and never ran in `npm test`. After adding any suite,
   confirm its count moves in the **full** `npm test` output.

6. **Static tests must strip comments before asserting.** These files document
   their own guardrails, so a `doesNotMatch(/fetch\(/)` will match a comment
   saying "no fetch here" — and worse, *deleting a comment* would turn the
   test green. `readCode()` in `tests/security/wp27-preview-*.test.mjs` does
   this; reuse it.

7. **Convex mutations are transactional.** A rate limit consumed inside a
   mutation that later throws is **rolled back**, making every failing request
   free. That is why `consumeGenerationQuota` is a separate mutation that
   commits first. Do not fold it back in.

8. **Never read the wall clock in a Convex query** (guideline), but never
   accept `now` as a public argument either — expiry is the entire
   authorization for an anonymous capability, so a caller choosing `now` can
   revive an expired token. The pattern used: public `action` reads
   `Date.now()`, delegates to an `internalQuery` that trusts it.

9. **`grep` masks exit codes.** `npm run build | grep ...` reports success on
   a failed build. In zsh use `${pipestatus[1]}`.

10. **Mutation-test every security suite.** Break the thing on purpose and
    confirm the suite fails. Several suites here passed for the wrong reason
    until this was done.

---

## 6. Recorded but NOT fixed — pick these up

| Item | Severity | Why it was left |
|---|---|---|
| `preview_capabilities` has **no retention job**. `by_expiresAt` index exists, nothing reads it, there is no `convex/crons.ts`. Expired capabilities kept forever; an anonymous stranger grows the table without bound. | MEDIUM | New scope (first cron in this deployment). **Required before the free preview is public.** |
| Bridge signatures carry **no nonce or expiry** and are not single-use. One leaked `{payload, signature}` pair = unlimited permanent artifact creation against the public Convex URL. | LOW (unreachable today) | Blast radius of any future logging mistake is total. |
| `ConsentBanner` privacy link fails AA contrast (4.17, needs 4.5). **Pre-existing, site-wide** — also fails on `/starter-kit`, along with several worse marketing-page failures (2.31–3.65). | — | Outside WP27. Needs its own Small Fix lane. |

Accepted by owner ruling, do not "fix":

- **Preview watermark contrast 1.09.** Ruled exempt under WCAG 2.1 SC 1.4.3
  ("pure decoration") on 2026-08-06 — see `RULINGS.md`. It is **deliberately
  not excluded from the scan**; 9 per-template tests pin the three conditions
  that make the exemption valid (aria-hidden, non-focusable, carries no unique
  information). If those tests fail, the exemption is void.

---

## 7. Local environment

```bash
npm ci
npm run convex:dev     # terminal 1 — required for anything preview-related
npm run dev            # terminal 2, port 3000
# or, for anything status/header/cache related, a PRODUCTION build:
npm run build && npx next start -p 3100
```

- `CONVEX_DEPLOYMENT=local`, backend on `http://127.0.0.1:3210`.
- `PLATFORM_PREVIEW_BRIDGE_SECRET` must be set in **both** `.env.local` and the
  local Convex deployment (`npx convex env set …`), ≥32 chars, same value.
  Unset ⇒ generation fails closed with 503. **Never print or commit it.**
- If the host network changes, the local Convex backend can silently die.
  Symptom: valid preview tokens render the not-found page (fail-closed working
  as designed). Fix: restart `npm run convex:dev`.
- After adding any Convex module: `npx convex codegen --typecheck disable`
  (plain `codegen` fails on pre-existing errors in unrelated test files).

Generate a token for manual testing:

```bash
curl -s -X POST http://localhost:3100/api/platform/preview/generate \
  -H 'content-type: application/json' -d '{
   "slug":"ai-collectible-verification-platform","templateId":"editorial",
   "customisation":{"headline":"Verify any collectible in under a minute",
    "subheadline":"Photo in, provenance out.",
    "problemStatement":"Collectors lose thousands to fakes because verification takes weeks.",
    "keyBenefits":["Instant photo-based authenticity scoring"],
    "callToAction":"Verify my collectible"}}'
```

Rate limit is 5/min burst, 40/hour sustained, per IP. Expect 429 while testing.

---

## 8. Checks — run all of these, report honestly

```bash
npm run typecheck
npm run lint          # 35 pre-existing warnings, 0 errors is the baseline
npm test              # baseline: node 91/6/7/46/4, vitest 125/172/57/567
npm run build         # 312 pages
npm audit --omit=dev --audit-level=high    # 0 vulnerabilities
git diff --check
```

**Never report success on red.** If something fails, say so with the output.
`CI check:links` is a known pre-existing script-name mismatch — ignore it.

---

## 9. Hard safety boundaries

- **No production deployment, data mutation/backfill, DNS or wildcard
  activation, live Stripe object or charge, external send, credential
  rotation, or Ideabrowser offboarding** without the manifest's gates.
- **Never print, log, echo, or commit a secret** — not into files, chat, or
  client code.
- Every private Convex operation derives identity server-side.
  **Never accept a caller-supplied owner ID.**
- `convex/schema.ts` is a **serialized one-writer seam**. WP27's only change
  was one additive table (31 insertions, 0 deletions). Do not relax `ownerId`
  on any frozen WP22 table — that reopens a passed security gate.
- `middleware.ts` / `proxy.ts`, lockfiles, webhook routes, and generated Convex
  files are serialized seams. Coordinate before touching.
- **Host routing, wildcard DNS, tenant hostnames, and production lead capture
  are WP28's, not WP27's.** No WP27 file may read or resolve a host.
  `site_configs.hostname` stays undefined.
- Private platform and preview surfaces stay non-indexable.

---

## 10. What to do next

WP27 package gate is **Pass**. In order:

1. ~~Get the §4.1 owner ruling.~~ Done — claim-only exclusivity.
2. ~~Run the §4.2 authenticated journey.~~ Done — claimed + exactly one project.
3. ~~Close S6.~~ Done — `wave-gate-report.md` + stories `[x]`.
4. **Before merging WP27 to `main`:** `/build/{slug}` must exist, because four
   already-merged components link to it (`PreviewIdeaCta` on every public idea
   page, `ExploreCard`, `DashboardHome`, `ProjectCard`). It does now. Merging
   the components without this branch ships a dead primary CTA.
5. Then either **WP28** (host routing, publish, live leads) or **WP26-S2..S6**
   on `codex/wp26-research-workflow` — providers are ruled and it is unblocked.
   WP26 is high-risk AI/workflow work: fixture-mode only until its own gate
   passes, pin a **dated** model snapshot, keyword provider fails closed rather
   than falling back to a model estimate, and cost is reserved pre-call against
   the $4.00 cap.

Also pending: **WP38** (`codex/wp38-admin-plan`, docs-only, cherry-picked here)
must be merged before production activation. It follows WP30 and gates WP31.

Before exposing the free preview publicly: add the `preview_capabilities`
retention job (MEDIUM follow-up recorded at S6 — first cron in this deployment).


---

## 11. Working norms the owner expects

- "Plan" means **write the plan to a markdown file and stop.** Never implement
  a plan unless told to build it.
- Git commit/push requests are **hard stops** — do them immediately, nothing
  else bundled in.
- Read existing code paths before modifying prompts, routes, or integrations;
  confirm you are on the right variant.
- No `any`, no `console.log` in committed code, no inline styles.
- Accessibility is a requirement, not polish.
- Run typecheck and tests after changes, before reporting done.
- Surface uncertainty and unmet acceptance criteria explicitly. Do not close a
  gate by reinterpreting it.
