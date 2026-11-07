# Employee pages — design brief (WP67 lane, Crew & Experience, 2026-11-07)

**Goal.** A founder can open any AI employee they hired, from anywhere their name or avatar shows. The page
explains what the employee does, what they are doing now, what they have done, and what comes next. Every line
comes from stored data or from the code's own contracts (the role catalogue, the launch DAG and the artifact
schemas). Nothing is invented.

**Ships:** in L1 (Monday 2026-11-09), behind the same workspace gate. Owner decision 2026-11-07: "Ship in L1".

## Route

`/dashboard/b/[projectId]/team/[employee]`, where `[employee]` is the role key (`brand`, `email`, `social`,
`landing`, …). The route already exists as a placeholder (`WORKSPACE_DETAIL_ROUTES`), so the URL does not change.
The key is the role, not the name: names are fixed per role, and the avatar belongs to the role (WP67-S7).

- An unknown key returns a 404, as today.
- `lead` stays a 404. Wren has no workstream; Wren's page is Team HQ's lead card plus the chat. Wren is never
  linked to an employee page.
- The gate is unchanged: `requireWorkspaceAccess` (the workspace flag, the cohort and owner only), so this
  ships dark exactly like every other workspace route.

## Sections and their data

The page component is a server component and renders the static profile from code. A client island, the same
pattern Team HQ uses, renders the live sections. The live sections read the same three queries Team HQ reads:
`launchStatus`, `launchProgress` and `pendingReviews`. Status and "needs you" counts therefore match Team HQ
exactly (`employeeStatus` in `lib/workspace/teamHq.ts`, `openReviews` in `lib/workspace/needsYou.ts`). There is
also one new owner-scoped query, `api.workspace.employees.employeeActivity`.

| Section | What it shows | Source |
|---|---|---|
| Header (server) | Avatar, name · role, what they do, "Reports to {lead}, Crew Lead", back link to Team HQ | `ROLE_CATALOGUE`, `CREW_AVATAR_SRC`, project `partnerName` |
| Status (client) | Status pill and detail; why hired; hired on {date}; counts of drafts, open reviews and approved | `employeeStatus(…)`, roster `reason`, `crew_members.createdAt`, documents and approvals |
| Waiting on you | This employee's open review cards, each with the same Review link Team HQ uses (the decision is made on the card's page) | `pendingReviews` filtered by `REVIEW_OWNER`, then `openReviews(now)` |
| Now and next | Their launch steps with step pills and plain reasons; "Waits on" (parent steps and their owners); "Then {names} start" (child steps that are built and whose owner this business hired); steps coming later | `launchProgress` + `LAUNCH_STEPS` parents/children, filtered by the roster |
| Deliverables | Each draft of their artifact, newest first: latest or earlier, written on, review outcome; "Open Brand kit / Email / Social" | `documents` by kind, `approvals` by subject |
| Activity | One entry per crew job, newest first: drafted or revised (change round), finished, paused, didn't finish or stopped, the tries it took, your decision (approved, changes asked with your note, closed or cancelled), and credits charged and refunded when a job had a cost | `tasks` (by `employeeKey`), `workflow_runs`, `documents`, `approvals`, `credit_ledger` |
| Responsibilities (server) | What they own, in full; what they work from; what they will not do. Who starts after them depends on the roster, so "Now and next" says it | Role copy grounded in the artifact contracts (`lib/workspace/contracts/artifacts.ts`) and `LAUNCH_STEPS.inputs` |
| Working style | The brand voice they write in: traits, "say" and "don't say" (Iris, Elle and Theo only) | `brandKitDraft` (newest brand kit) |
| Ask Wren | Button: "Ask {lead} about {name}". It prefills the chat composer with a question about this employee, opens the drawer on small screens and moves focus to the composer. It never sends on its own. | Client event; `WrenComposer` listens |

## States

- **Hired, built (Iris, Elle, Theo):** every section.
- **Hired, coming soon (Leo/landing, Sana/SEO, Marco/launch plan, Kai/build pack, Ada/ads; also the logo marks
  under Iris):** the full profile and responsibilities, the status "Coming soon", and "{name} starts when {steps}
  ship in a later update". There is no activity, deliverables or "waiting on you" section, because that data
  cannot exist; the page shows the profile and says so in words. "Waits on" still shows, because the DAG is
  real.
- **Hired, no launch step at all (curriculum, community, merch, outbound):** the profile plus "{name}'s work is
  not part of this beta yet."
- **Not hired (skipped at team assembly):** the profile, the heading "Not on {business}'s team", the roster's
  skip reason verbatim, and what they would have done. Nothing else.
- **Team not written yet** (not started, assembling or failed): the profile plus the same line Team HQ uses,
  with a link back to Team HQ.
- **Load or error:** skeleton, then `QuietErrorBoundary` with the Team HQ unavailable copy.

## Entry points (one link per person, one accessible name)

The avatar inside a link becomes decorative (`aria-hidden`). The link's name is the person, e.g. "Iris, Brand".
Specialists get links; Wren never does.

- Team HQ grid cards (`EmployeeCard`): the avatar and name link to the page; the separate workstream link stays.
- Team HQ "Reviews {lead} is routing" rows: "From Brand · Iris".
- Team HQ launch steps by owner (`PlanByOwner` owner chip).
- Team HQ skipped roles and "Why this team?" rows: link to the page that explains the skip.
- Dashboard team strip chips and the dashboard "Pending approvals" "From …" line.
- Wren chat cards (`FromAttribution`): the "From {role} · {name}" text.
- Review cards on the Email, Social and Brand kit pages (`ApprovalCard` "From …"), when the page passes a link.
- The sidebar has no team list today, so there is nothing to link there. Adding one is a nav change for later.

## Deliberately left out

- **AI cost per employee.** `ai_usage` holds provider cost in micro-USD with token counts and models. That is
  operator data, not the founder's money. Credits are coming soon in L1, and every launch task is charged 0
  credits. The activity trail shows credits only when a job actually had a cost.
- **"Brief from the Blueprint" per employee** (canvas). The blueprint stores no per-role brief. The roster's
  "why hired" reason is the only per-role text, and it is shown.
- **Files {name} owns.** `workstreams.fileIds` is never written by the crew today, and business files are
  Wren's memory, not an employee's.
- **Autopilot switch.** It is a paid-plan feature and not in L1.
- **"Ask {name} a scoped question"** (canvas). Wren is the only chat. The page offers "Ask Wren about {name}"
  instead.
- **Raw error codes, model names, token counts and internal ids.** Failures read in plain words, as on Team HQ.
- **Wren's own page.** See Route.

## Data gaps for Codex (no schema changes made here)

1. `tasks` has no index on `employeeKey`. The activity query reads the business's 200 newest tasks
   (`by_projectId_and_createdAt`) and keeps this employee's newest 25. A busy business could push older
   entries out, and the page says "Showing the most recent work" when it does. Ask:
   `tasks.by_projectId_and_employeeKey_and_createdAt`.
2. Task failure reasons are not stored per task. Only the latest step reason (`launchProgress`) and
   `workstreams.blocker` exist, and `workflow_runs.errorCode` is a raw code. The trail therefore says "didn't
   finish" without a per-attempt why. Ask: a founder-safe `failureReason` on `tasks` (or on `workflow_runs`).
3. No per-role brief in the blueprint (see above). This needs a contract change if the canvas section is wanted.
4. `credit_ledger` has no `taskId` index. Refund lookups scan the owner's 200 newest ledger rows, and only when
   a task had a cost. Ask: `credit_ledger.by_taskId`.

## Tests

- convex-test (`convex/workspace/employees.test.ts`): owner scoping (another owner and another business read
  nothing); a coming-soon employee (landing) has empty activity; a skipped employee's member row reads
  `skipped`, with no tasks; a real fixture launch fills Iris's trail and deliverables; bounds hold.
- Platform (`tests/platform/workspace-employee-page.test.tsx`): pure helpers (states, trail wording, DAG
  next/after) plus axe on the rendered page states (hired, coming soon, skipped, not started).
