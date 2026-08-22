# Phase 2. MDX auditor

Back: [overview](overview.md)

## Goal

Replace the dead HTML auditor and the skill's manual grep with one script a reviewer can re-run. A new idea that misses a section, the HowTo list, or 800 words exits 1.

## Changes

- Add `scripts/audit-idea-mdx.mjs`. Port the section regexes from `scripts/extract-idea-bodies.mjs` (`REQUIRED_SECTIONS`). Check: seven canonical `##` headings in order, a required `## Sources` (eight headings total), `**How it works:**` plus a numbered list under The Solution, at least two markdown links under Sources, no `{{` placeholders, no bare `<` or `{` that MDX would parse as JSX, body word count >= 800, slug matches `^[a-z0-9-]+$`.
- Wire `audit:idea` in `package.json`. Support `--slug` and `--all`.
- Add `npm run validate:idea-tags` to `.github/workflows/ci.yml` next to `npm test`. It already exists and is not in CI.
- Rewrite `ideas/SECTIONS.md` so it describes MDX under `content/ideas/`, not `ideas/*.html`, and points at this script. Delete references to `scripts/audit-ideas.js`. Leave `ideas/_audit.json` alone. It is a 2026-06-09 fossil.

Do not change the publish skill yet. The skill still says "manual section gate" until phase 7.

## Data structures

No new domain type. The script reads MDX as text. Reuse the `{ key, match }` section spec already in `extract-idea-bodies.mjs`. If both files would drift, extract that spec into `scripts/lib/idea-sections.mjs` and import it from both. Prefer that extract over copying regexes.

## Verification

Static: `npm run typecheck`, `npm run lint`.

Runtime: `npm run audit:idea -- --slug ai-rfp-response-assistant` exits 0. `npm run audit:idea -- --slug ai-code-reviewer` exits 0. A throwaway copy with The Problem removed exits 1. No browser.
