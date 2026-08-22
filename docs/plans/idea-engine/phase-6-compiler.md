# Phase 6. Compiler

Back: [overview](overview.md)

## Goal

Turn a `ResearchRecord` into the two files `/publish-idea` already writes: `content/ideas/{slug}.mdx` and one `ideas/manifest.json` row. Existing seed, OG, and tag validation stay the next steps. The compiler does not seed production or push git.

## Changes

- Add `lib/engine/compile.ts` that maps record sections onto the seven MDX headings, injects `**How it works:**` from `goToMarket` or a dedicated steps field on the record if phase 1 grew one, writes Sources from citation URLs, and builds a manifest stub (`description`, `scores` if present, `source: "engine:{slug}"`, `provenance.researchCalls`, tagging fields left for the operator or a later tagger).
- Add `scripts/engine-compile.mjs` and `engine:compile`. Flag `--record engine/records/{slug}.json`. Refuse to overwrite an existing MDX unless `--force`.
- Add `lib/engine/compile.test.ts` that compiles the fixture record from phase 5 into a temp dir and runs the phase 2 auditor against it.

Do not use `.worktrees/wp26-research-workflow/convex/platform/engine/compile.ts`. That file maps draft URLs onto `CitationRef` indices for `documents.body`. This phase writes MDX.

Do not edit the skill yet. Run `interrogate` on this split (script compiler vs LLM-in-skill authoring) before merge. The script must produce a page the auditor accepts. Voice polish can stay a skill pass *after* the script, not instead of it.

## Data structures

Compiler input is `ResearchRecord`. Output is `{ mdx, manifestEntry }`. Manifest `source` is `engine:{slug}`. Do not emit `ideabrowser:` sources.

## Verification

Static: `npx vitest run lib/engine/compile.test.ts`, `npm run typecheck`, `npm run lint`.

Runtime: compile the fixture record to a throwaway slug, `npm run audit:idea -- --slug {throwaway}`, `npm run validate:idea-tags -- --slug {throwaway}` once tags are filled. Load `/ideas/{throwaway}` with `control-ui` on `npm run dev`. Confirm seven headings and HowTo steps. Delete the throwaway before merge, or keep it under a `_` prefix so `lib/mdx.tsx` ignores it.
