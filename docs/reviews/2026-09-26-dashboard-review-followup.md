# PR #81 review follow-up

Source: [Claude review of `19dd5b7`](https://github.com/jeberulz/weekendmvp/pull/81#issuecomment-5849896214). Work package: WP44-R5–R8. This report records the follow-up separately from the initial audit gate.

## Scope

Review each nudge against current code, repair confirmed defects, and rerun the engineering gate. Keep the existing product design and paused paid/publishing surfaces. Add an operator-invoked legacy subscription normalization backfill, but do not execute production data changes.

## Release sequence

1. Deploy the additive Convex backend with legacy API adapters preserved. A Next build alone does not deploy it.
2. Verify authenticated `platform/dashboard:requireMember`, query/session ownership, versioned Save and old-client compatibility on the deployment target.
3. Deploy the matching frontend and perform target-environment authentication, Save, prompts and rollback smoke checks.
4. Run the legacy subscription normalization soon after the backend deployment, only after the separate production-data inventory, restore point and owner authorization. The repair remains safe before that operation: uncertain claim state suppresses only the kit, preserving eligible promos.

Full WCAG/screen-reader coverage, external email/OAuth and production rollout remain the original WP44-S13 release gates. Local production-mode tests do not certify a production deployment.

## Legacy subscription backfill runbook

`subscriptions:backfillNormalizedEmail` is an internal mutation, never scheduled on deployment. Each call scans at most 100 subscription events in creation order, changes only the derived `normalizedEmail` key, and returns `scanned`, `needsUpdate`, `updated`, `isDone` and `continueCursor`. Omitted `dryRun` means true. Existing event emails and claim classifications stay intact.

For a confirmed disposable local deployment, the first inventory call is:

```sh
npx convex run subscriptions:backfillNormalizedEmail '{"cursor":null,"dryRun":true}'
```

Continue with the returned cursor until `isDone`, accumulating the counts. For a separately authorized target-environment run, first record the deployment identity, backup/restore point and completed dry-run inventory. Restart from `cursor:null` with `dryRun:false`, continue bounded batches, then repeat a full dry-run and require `needsUpdate:0`. A retry can safely repeat a batch or restart; correct rows are skipped. Do not add `--prod` or copy production credentials into the local test setup.

The bounded legacy fallback remains compatible before and during this process. After all legacy rows are normalized its undefined-key index lookup reads no rows. No production backfill was executed for this PR repair.

## Finding reconciliation

| Review finding | Repair |
|---|---|
| Legacy claim overflow hides all offers | Restore canonical `by_email` lookup, use normalized lookup next, skip the bounded legacy scan when a claim is proven; uncertainty suppresses only the kit. |
| Queries read `Date.now()` | Clock-free reactive membership reads still check session existence and ownership. Mutations use an explicit expiry guard; HTTP Saved reads first call the expiry-aware membership probe. |
| Dashboard Save loses keyboard focus | Keep the loaded button focusable during requests, expose `aria-busy`, retain the existing synchronous submission guard. |
| Email normalization differs from auth | Auth, magic link, subscriptions and the subscribe HTTP route share NFKC, trim and lowercase normalization. |
| Collection delete error focuses a disabled button | Restore safe cancel focus in the effect after React reenables the control. |
| Draft completion unmounts focused controls / heading flashes | Persistent live status and completed check control; heading appears only when drafts exist. |
| Restore conflict offers an impossible retry | `PLAN_ALREADY_ACTIVE` explains how to continue or archive the current plan. |
| Public Save retry drops focus / small sign-in target | Move focus to the persistent Save button before retry; give sign-in a 44px minimum height. |
| Pending save replacement silently clears feedback | Announce replacement without sending the old request; preserve any newer pending intent. |
| Pending-save Dismiss is not durable | Remove only the matching stored request, surface storage errors and retain newer intents. |
| Shortlist semantics and small targets | Named fieldset, 44px selection labels and a separate choice cell; idea title remains the row header. |
| Unknown compare slug crashes during outage | Optional pricing enrichment tolerates lookup failure; prompts and exports retain strict failure behavior. |
| Forged-token evidence can pass on refresh failure | Fresh `iat` and `exp`, genuine refresh credential, direct backend rejection, no-refresh assertion and a successful refresh control. |
| Traces check only upper limits | Require every canonical idea MDX in all sampled routes and the manifest in the sitemap route that consumes it. Missing-file fixtures must fail. |
| Rulings / handoffs / local paths / environment label | Repair table, identify remote and local branches, refresh both agent handoffs, sanitize evidence paths and label local production-build evidence. |
| Backend/frontend deploy order | Explicit backend-first runbook; no deployment or production data operation performed. |
| New finding: refreshed headers not forwarded | Middleware forwards refreshed request headers so routes see the new token in the same request. |

## Verification results

Engineering gate passed: **1,133 tests** (221 Node and 912 Vitest), typecheck, lint (zero errors; 35 baseline warnings), 428-page production build, content corpus/tag checks and supported codegen against disposable local Convex. Required-content trace checks pass for all 228 MDX files in each sampled route and the sitemap manifest; assembled traces remain 8.49–8.74 MB. No dependency changes in this follow-up.

The local production-build integration proves: real code redemption; valid member 200; anonymous, fresh forged JWT and revoked-session 401; direct backend forged-token 401; stale Save 409; successful session refresh 200 on the first request and replay; private caching, canonical/JSON-LD and sitemap checks. The positive refresh control uses a genuine refresh credential, and the fresh forged-token case asserts no refresh cookie was issued.

Chromium verified dashboard Save retains focus during requests and accepts another Space toggle; public Save outage/Retry transfers focus to the persistent Save control during and after success; named shortlist grouping, separate row headers, 44px targets and arrow-key selection; no empty-draft heading flash. Dormant collection deletion, sparse final-page draft focus and replaced pending-save browser scenarios were not exercised end to end; their code/unit/SSR checks are documented separately. No axe or screen-reader speech certification is claimed.

Evidence: [summary](evidence/dashboard-review-followup-2026-09-26/summary.json), [local integration](evidence/dashboard-review-followup-2026-09-26/local-production-integration.json), [browser observations and limits](evidence/dashboard-review-followup-2026-09-26/browser.json), and logs in the same directory. Two initial gate failures were stale source assertions; they now require the stricter mutation guard and updated focus effect. Final full run passed without skipped tests. Temporary local servers were stopped.

## Latest review polish — WP44-R9

[Claude’s review of `69c450b`](https://github.com/jeberulz/weekendmvp/pull/81#issuecomment-5850026986) confirms every earlier finding is fixed and CI is green. Its two remaining notes are non-blocking. The untouched Builds drafts section now renders nothing during the first load or when that first page is exhausted without drafts. A member who explicitly checks more pages still keeps the continuation control and completion announcement, preserving the earlier focus repair. Existing drafts still render their resume links.

The subscription backfill remains an operator step soon after the backend deployment, following the inventory/authorization runbook above. It was not run on production. Until then, the conservative legacy lookup may hide the kit on overflow and read up to 501 legacy rows for members without a proven claim; eligible promos remain available.

R9 validation: 1,134 tests passed (221 Node + 913 Vitest), including seven focused render checks. Typecheck, lint (zero errors; 35 baseline warnings), 428-page build and server-trace checks passed. This small rendering change did not rerun the earlier full browser/auth journeys.
