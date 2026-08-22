# U-wp29-verify

STATUS   complete
VERDICT  unit-test-verified
SHA      b9db0d0ce562d59d34cb3c609493c459e33fdd2c (== origin/main at verify time)
PR       https://github.com/jeberulz/weekendmvp/pull/58 (merged 2026-08-14T05:39:51Z)
WORKTREE .worktrees/wp29-verify (detached, clean tree, `npm ci` exit 0)
SCOPE    Compile/unit only. No merge, no push, no product edits, no env changes.

## Acceptance

| # | Criterion | Result |
|---|-----------|--------|
| 1 | HEAD is b9db0d0…fdd2c | PASS |
| 2 | `npm run typecheck` exit 0 | PASS |
| 3 | `npm test` (RECRAFT unset) exit 0, incl. new wp29 tests | PASS |
| 4 | `npm run build` exit 0 + `/dashboard/projects/[projectId]` in route table | PASS |
| 5 | ProjectWorkspace.tsx has publish control + `/ideas/` link | PASS |

## Command tails

Run from `/Users/jeberulz/Documents/AI-projects/weekendmvp/.worktrees/wp29-verify`,
HEAD asserted `b9db0d0ce562d59d34cb3c609493c459e33fdd2c` inside the same shell.

### typecheck

```
> weekendmvp@1.0.0 typecheck
> tsc --noEmit

===TYPECHECK_EXIT=0===
```

### test — `env -u RECRAFT_API_KEY -u RECRAFT_STYLE_ID npm test`

Full chain ran: test:og, test:links, test:redirects, test:auth, test:security,
test:sitemap, test:convex.

```
> weekendmvp@1.0.0 test:auth
> vitest run tests/auth

 Test Files  4 passed (4)
      Tests  44 passed (44)

> weekendmvp@1.0.0 test:convex
> vitest run convex

 Test Files  20 passed (20)
      Tests  266 passed (266)

===TEST_EXIT=0===
```

New WP29 tests confirmed present and executed (`tests/auth/wp29-cockpit.test.ts`,
run explicitly with `--reporter=verbose`):

```
 ✓ WP29 cockpit view model > links repository projects to the canonical idea path
 ✓ WP29 cockpit view model > suggests a valid tenant slug from the source slug
 ✓ WP29 cockpit view model > shows a tenant URL whenever the site stored a hostname
 ✓ WP29 cockpit view model > labels publish for repository sites and hides it for own ideas
 ✓ WP29 cockpit view model > labels invalid slugs and mapped publish errors
 ✓ WP29 cockpit UI contract > the workspace reads server status, credits, publish, tenant URL, and idea link

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### build — `npm run build`

```
▲ Next.js 16.3.0 (Turbopack)
✓ Running next.config.ts took 127ms
- Cache Components enabled
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.

├ ◐ /dashboard/projects                                         1d      1w
├   /dashboard/projects/[projectId]                             1d      1w
│ └ ◐ /dashboard/projects/[projectId]                           1d      1w

===BUILD_EXIT=0===
```

### Cockpit file inspection (criterion 5)

`components/platform/projects/` contains `ProjectWorkspace.tsx`, `cockpit.ts`,
`ProjectCard.tsx`, `ProjectList.tsx`, `PlatformRouteError.tsx`.
Route dir `app/dashboard/projects/[projectId]/` has `page.tsx` + `error.tsx`.

Publish control — `ProjectWorkspace.tsx`:

```
 33: const publishSite = useMutation(api.platform.sites.publish.publish);
 99: const publishDisabled = control.kind !== "ready" || publishing || slugError !== null;
262:   disabled={publishDisabled}
263:   aria-describedby="publish-status"
269:     : "Publish"}
271: <p id="publish-status" ... aria-live="polite">
```

`/ideas/` link — built in `cockpit.ts` and rendered twice in the workspace:

```
cockpit.ts:34  export function ideaHref(sourceSlug) { return sourceSlug ? `/ideas/${sourceSlug}` : null; }
ProjectWorkspace.tsx:57   const researchHref = ideaHref(project.sourceSlug);
ProjectWorkspace.tsx:142  <Link href={researchHref}>Read source research</Link>
ProjectWorkspace.tsx:191  <Link href={researchHref}>  // "Canonical idea" row
```

Note: the literal string `/ideas/` lives in `cockpit.ts`, not in
`ProjectWorkspace.tsx`. Criterion 5 is satisfied by import + render, not by a
hardcoded path in the component file.

## Disagreement with the worker

None on the verdict. The worker's claim that typecheck/test/build are green at
this SHA reproduces independently. Two qualifications:

1. **The "UI contract" test does not render the component.** It imports
   `ProjectWorkspace.tsx?raw` and asserts substrings against the file text
   (`toContain("Tenant URL")`, `toContain('id="publish-status"')`, etc.). It
   would still pass if the component threw on mount, if the JSX branch were
   unreachable, or if the strings were moved into a comment. The five
   `cockpit.ts` view-model tests are real unit tests; the component itself has
   zero render coverage. Treat "cockpit works" as unproven at the UI layer.
2. The brief's framing is accurate: this is compile/unit only. The live stranger
   journey remains blocked on `PLATFORM_PREVIEW_BRIDGE_SECRET` (owner gate,
   preference 18). Nothing here speaks to runtime behaviour.

## Verification hazards hit (method notes, not defects)

Both were harness artifacts. Recording them so the next verifier does not
mistake them for regressions at this SHA.

1. **First run executed in the wrong checkout.** The shell's
   `working_directory` was not honoured on the persistent session; `pwd`
   resolved to the primary checkout (4ee44b2). Symptoms: vitest collected test
   files from sibling worktrees (`.worktrees/wp29-min/convex/...`), resolved
   `node_modules` from the primary, reported 52 failures, and silently skipped
   `test:auth`/`test:security`. Discarded and re-run with an explicit `cd` plus
   a `git rev-parse HEAD` assertion inside the same shell.
2. **`npm ci` failed under the sandbox** (permissions error against the
   sandbox npm cache), leaving `node_modules` half-removed. That produced a
   bogus `Could not find the Next.js package (next/package.json)` build failure
   and `ERR_MODULE_NOT_FOUND` for `typescript`/`eslint` in `test:security`.
   Re-running `npm ci` unsandboxed (exit 0) cleared both. All three green
   results above come from that clean install.

No sibling worktree was resumed, modified, or checked out. wp23/24/25/26/29-min/38
were only read incidentally by the discarded run's test collection.

## Primary checkout moved mid-unit — not by me

The primary checkout was **not** stale at 4ee44b2 for the duration of this unit.
A concurrent actor changed it while I was running. Reflog from
`/Users/jeberulz/Documents/AI-projects/weekendmvp`:

```
b9db0d0 HEAD@{2026-08-14 07:18:54}: checkout: moving from main to fix/local-magic-link-resend-401
b9db0d0 HEAD@{2026-08-14 07:05:47}: merge origin/main: Fast-forward
4ee44b2 HEAD@{2026-08-14 02:50:45}: pull --rebase origin main (finish): returning to refs/heads/main
```

Current primary state: branch `fix/local-magic-link-resend-401` at b9db0d0 with
uncommitted work (mtime 07:19):

```
 M convex/resendMagicLink.test.ts   (+59)
 M convex/resendMagicLink.ts        (+22/-3)
 M convex/siteUrl.ts                (+6)
```

I ran no `checkout`, `merge`, `pull`, or `commit` anywhere. My only write to a
tracked path was zero; my only write at all is this report. The magic-link
changes are someone else's in-flight work — do not attribute them to WP29 and do
not let a later unit `git add -A` in the primary.

This also explains hazard 1's odd symptom. My discarded run started 07:04:40 in
the primary while it was still at 4ee44b2, whose `package.json` `test` script did
not yet include `test:auth`/`test:security` — hence the silent skip. The 07:05:47
fast-forward then rewrote `package.json` to the b9db0d0 version mid-run, which is
why a later inspection showed a `test` script that did not match what had
actually executed. Nothing was wrong with the commit; the harness was reading a
moving tree.

**Warning for the orchestrator:** a second actor is live in the primary checkout.
Any unit that assumes the primary is parked at 4ee44b2, or that runs
build/test there, will collide.

## Follow-ups

- Give the cockpit a real render test (RTL against `ProjectWorkspace` with a
  mocked Convex provider) so publish/credits/tenant-URL states are asserted as
  behaviour rather than as source substrings.
- `test:convex` is `vitest run convex` — a bare substring filter. From any root
  that contains a `.worktrees/` sibling it will collect other worktrees' convex
  tests. Consider anchoring it (`vitest run ./convex` or a config `include`) to
  make verification hermetic.
- Next.js warns the `middleware` convention is deprecated in favour of `proxy`.
  Non-blocking today; will bite on a Next major.
- Live stranger-journey proof for WP29 still owed once
  `PLATFORM_PREVIEW_BRIDGE_SECRET` is resolved.
