# Launch Workspace — how Codex and Claude build in parallel

**Status:** Ruled 2026-11-05. The owner (John) is the only person
who merges to `main`, runs production deploys, changes Stripe live objects, DNS or
provider accounts, and approves live AI spend. Agents prepare the change and hand
over the exact commands.

## 1. The split, and why

Two lanes, each owning whole directories end to end, so neither waits on the other
for anything except a frozen contract.

| | **Codex — Platform & Money** | **Claude — Crew & Experience** |
|---|---|---|
| In one line | Everything that stores, charges, limits, publishes, sends or connects | Everything that thinks, writes, talks to the founder or is seen by the founder |
| Owns | Schema, authorization helper, ops settings, metering storage and budgets, rate limits, ledger v2, plans and entitlements, Stripe and the membership webhook, site publishing and takedown, tenant email engine, social and ads connectors, outbound sending, crons, http routes, middleware, admin ops console, members and custom domains | AI gateway, providers, model router, prompt registry, evals, per-idea seeds, roster rules, crew pipelines, Wren chat and memory, approvals, wizard, every workspace page, tenant site renderer, Studio, paywall UX, Autopilot policy, copy |
| Why this lane | Exactly-once money paths, concurrency tests and webhook replay are precise, test-heavy work with little product judgement | Prompt quality, cost-aware model use, conversation design and canvas-faithful UI need product and writing judgement |
| Work packages | WP68, WP70, WP73, WP78, WP79, WP80, WP83, WP85 | WP67 (orchestrator), WP69, WP71, WP72, WP74, WP75, WP76, WP77, WP81, WP82, WP84, WP86 |
| Shared | WP87 program gate (Claude orchestrates, Codex reviews) | |

Claude carries more work packages, but several are UI-sized. If Claude's lane falls
behind, WP76 (growth drafts) and WP86 (team variants) can move to Codex, because
they depend only on frozen contracts (C-ART, C-JOBS, C-PROMPT).

## 2. Who writes which file

### 2.1 Directories

| Path | Owner |
|---|---|
| `convex/schema.ts`, `convex/schema/**` | Codex |
| `convex/convex.config.ts`, `convex/http.ts`, `convex/crons.ts` | Codex |
| `convex/platform/**` (authz, plans, entitlements, billing, membership, sites, limits) | Codex |
| `convex/ops/**`, `convex/ai/metering.ts`, `convex/ai/budgets.ts` | Codex |
| `convex/growth/email/**`, `convex/growth/connectors/**`, `convex/growth/outbound/**` | Codex |
| `convex/ai/**` (all other files), `convex/crew/**`, `convex/workspace/**`, `convex/studio/**`, `convex/growth/drafts/**` | Claude |
| `app/api/**`, `app/admin/ops/**`, `app/u/**`, `middleware.ts`, `vercel.json` | Codex |
| `app/start/**`, `app/dashboard/b/**`, `app/site/**` | Claude |
| `components/platform/billing/**`, `components/platform/plan/**` | Codex |
| `components/platform/shell/**`, `components/workspace/**`, `components/tenant-site/**` | Claude |
| Idea-page account card and homepage CTA components | Claude |
| `lib/workspace/contracts/**`, `evals/**` | Claude |
| `lib/tenant-*.ts` | Codex |
| `package.json`, lockfile, `.env.example` | Codex (Claude requests additions) |
| `tests/security/**` | Whoever adds the rule; both lanes may add new files, never edit the other lane's file |
| `docs/plans/launch-workspace/**`, `docs/wp/wp67-*` | Claude (orchestrator) |
| `docs/wp/wpNN-*` | The WP's lane |
| `docs/wp/RULINGS.md`, `docs/PROJECT_STRATEGY.md`, `AGENTS.md`, `CLAUDE.md` | Orchestrator only, after an owner decision |

### 2.2 Single-writer files

These files cause most merge conflicts. Only the owner edits them. The other lane
asks in its progress file ("Needs from Codex: cron entry `studio.poll` every minute")
and the owner lane makes the change within a day.

| File | Owner | Typical request from the other lane |
|---|---|---|
| `convex/schema.ts` and `convex/schema/*` | Codex | New index, new optional field |
| `convex/convex.config.ts` | Codex | Component mount, env entry (always optional) |
| `convex/crons.ts` | Codex | A cron entry calling a Claude internal function |
| `convex/http.ts` | Codex | A webhook route |
| `middleware.ts` | Codex | A new public path |
| `package.json` + lockfile | Codex | A dependency |
| `convex/platform/plans.ts` (`PLAN_LIMITS`) | Codex | A new limit key |
| `components/platform/shell/*` (`WorkspaceShell`, `workspace-current.ts`) | Claude | A nav entry for an admin or billing page |
| `lib/workspace/contracts/*` | Claude | A new field on an artifact |

### 2.3 How the lanes meet in code

The lanes meet only through the contracts in `04` §2. The pattern is always the same:

- The **owning lane merges the contract first** with a fixture or no-op
  implementation (types plus a function that returns a fixed result).
- The **consuming lane builds against that merged contract**, never against
  unmerged code in another branch.
- The owning lane replaces the fixture with the real implementation; the
  consumer's code does not change.

Examples: Claude's gateway calls `reserve` and `settle` (C-METER) that Codex owns;
Codex's publisher and sender call `assertApproved` (C-APPROVAL) that Claude owns;
Claude's generators call `debitJob` (C-LEDGER) that Codex owns.

## 3. Branches, worktrees and merges

- **Branches:** `codex/wpNN-<slug>` and `claude/wpNN-<slug>`, always from fresh
  `origin/main`.
- **Worktrees:** every WP runs in its own worktree under `.worktrees/wpNN-<slug>`,
  never in the main checkout. Parallel sessions sharing one checkout have destroyed
  uncommitted files before, so **commit early, at least every story**.
- **At most two WPs per lane at once**, and only if their file sets in `04` don't
  overlap.
- **Rebase on `origin/main` every morning** and before asking for review.
- **Merge order inside a phase:** schema and contract PRs first, then
  implementations, then UI. A PR that depends on an unmerged contract waits.
- **Every merge deploys production Convex.** Before asking the owner to merge,
  confirm in the PR body: schema additive only, every new function guarded by
  `assertFeatureEnabled`, every new page 404s with the flag off, new env entries
  optional.
- **PR size:** one story or a small group, under about 800 changed lines excluding
  generated files and fixtures.
- **Who merges:** the owner. Agents never run `npx convex deploy` against production,
  never merge, never create live Stripe objects. They prepare the tree and write the
  exact commands in the PR body.
- **CI:** typecheck, lint, test, build, security tests and audit must pass. If the
  known `check-links` script-name mismatch is still failing on every PR, note it in
  the PR; it is not a regression.

## 4. Reviews

| Change touches | Reviewed by |
|---|---|
| Ledger, Stripe, webhooks, grants (Codex) | Claude, high model, independent read before merge |
| Authorization, approvals, side effects (either lane) | The other lane, high model |
| Gateway, metering use, budgets (Claude calls Codex) | Codex |
| Publishing, takedown, email sending, connectors (Codex) | Claude, for approval checks and founder-facing errors |
| Prompts and generators (Claude) | Eval results in the PR; no code review by Codex needed beyond authz |
| UI pages (Claude) | a11y-check output in the PR; owner spot check |

An independent review means the reviewer is given the diff and the contract, not
the author's summary.

## 5. Contract changes after G0

1. The owning lane opens a PR labelled `contract-change` that edits the contract and
   adds a line to `docs/plans/launch-workspace/contract-changes.md` (date, contract,
   change, consumers affected).
2. The consuming lane acknowledges in the PR, saying what it must update.
3. Changes are additive where possible (a new optional field, not a renamed one).
4. A breaking change needs the owner's OK and lands with the consumer's update in the
   same week.

## 6. Handoffs and status

- Each WP keeps `docs/wp/wpNN-stories.md` and `docs/wp/wpNN-progress.md`. The progress
  file has, per story: status, files changed, checks run with their results, contracts
  touched, and a **Needs from the other lane** list.
- The orchestrator keeps one status table in `docs/wp/wp67-progress.md`: every WP,
  its lane, status, blockers and the next gate. Agents never edit the other lane's
  progress files; they write requests in their own.
- **End-of-WP handoff note** (top of the progress file): what works, what is behind a
  flag, how to test it, what the other lane can now build on, open risks.
- The owner relays between lanes at least once a day, or points each agent at the
  other's progress file.

## 7. Model routing inside each lane

Per `AGENTS.workflow.md`: quality follows risk.

| Risk | Claude lane | Codex lane |
|---|---|---|
| High: orchestration, security, data, money, AI runtime, final review | Opus 5.5 (WP67, WP69, WP71, WP75, WP77, WP82, WP84, WP87, all reviews) | Highest reasoning setting (WP68, WP70, WP73, WP78, WP79, WP80, WP83, WP85) |
| Mid: standard UI and product WPs | Sonnet 5.5 or Opus 5.5 at medium effort (WP72, WP74, WP76, WP81, WP86) | Default setting for UI in `components/platform/{billing,plan}` |
| Low: scaffolding, docs, mechanical fixes | Haiku 5.5 sub-agents | Low setting |

## 8. When something doesn't fit

- If reality disagrees with the manifest or a contract, **stop and write it in the
  progress file**; the orchestrator escalates to the owner. Don't re-scope in place.
- If a WP needs a file the other lane owns, request it (§2.2); don't edit it.
- If a live call, a Stripe live object, a DNS change or a production deploy is
  needed, prepare it and ask the owner.
- If a decision in `06-decisions.md` is still open when a WP needs it, build to the
  recommendation behind a flag and mark the story "pending ruling Dn".

## 9. Definition of done for a PR

- [ ] Lane owns every file it changes (or the change was requested and recorded).
- [ ] Dormant on merge: flags, `assertFeatureEnabled`, additive schema, optional env.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass; results
      pasted in the progress file.
- [ ] Tests for the story; money and side-effect paths have exactly-once tests.
- [ ] No live provider call in tests or CI.
- [ ] a11y-check run on changed UI.
- [ ] No `any`, `console.log` or inline styles.
- [ ] Review per §4 done.
- [ ] Progress file and handoff note updated.
