# WP42 Stories - Fix idea pages contradicted by their own sources

Branch: `claude/tender-carson-s0bvo8`
Lane: Work Package
Registry: Weekend MVP idea corpus
Definition of done: the 23 pages the WP41 sweep (2026-10-01) flagged with `claims.contradicted` state what their cited sources say today, pass Layer 0, and show 0 contradicted claims and no judge failures on a live Layers 1-3 run.

## Stories

- [x] `WP42-S1` - Correct the 27 contradicted claims on 23 pages
  - Scope: `content/ideas/{slug}.mdx` for the 23 pages listed in `wp42-progress.md`
  - Acceptance criteria:
    - Each figure matches its cited source's current text (year, period and edition stated); dependent arguments on the page updated to match.
    - `ai-material-estimator` also clears its `judges.fake_data` failure.
    - Dead Sources links on these pages replaced with the publisher's current URL, or removed when another source backs the claim.
    - No structure change: 8 H2s, How-it-works list, no bare `<` or `{`.
  - Verification:
    - `npm run evals:changed -- --base HEAD --layers 3 --live --check-links`: 0 contradicted, no FAIL
    - `npm run evals:calibrate -- --live` still passes (`ai-code-reviewer` is a gold page)
    - `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`

## Out Of Scope

- The 31 structural failures and the ~180 `claims.unsupported` warnings.
- Manifest, Convex and OG changes (descriptions carry none of the stale figures; bodies are MDX).
