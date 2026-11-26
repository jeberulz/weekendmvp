# WP103 Progress - Guide template and /publish-guide skill

Append-only progress log. Do not rely on chat history for project state.

## 2026-11-26 - Setup

- Branch/worktree: `claude/wp103-s1-guide-shared-blocks`, cut from `claude/magical-dirac-f4ehf2` (which holds main after #331 plus the hero, currency and Receipt fixes). No worktree.
- Assignment: S1 only, extract shared blocks and a per-guide spec.
- File boundaries: `app/(marketing)/guides/**`, `tests/home/five-to-nine-builder-guide.test.ts` (paths only), `docs/wp/wp103-*`, `docs/PROJECT_STRATEGY.md`, `CLAUDE.md` key paths.
- Required checks: typecheck, lint, `test:home`, guide test, built-HTML copy check, before and after markup comparison.
- Initial risks: markup drift while moving code (mitigated by snapshot compare), missing slots now surfacing only at render time (mitigated by a throw plus the existing guide test).

## 2026-11-26 - WP103-S1

- Actions taken: moved the client components and CSS to `app/(marketing)/guides/_shared/`, added shared server blocks (`blocks.tsx`), copy renderer (`copy.tsx`), page frame (`GuideLayout.tsx`), SEO builders (`seo.ts`), bootstrap and types. Renamed `guideContent.ts` to `guide.spec.ts` and moved the guide's steps, skills, roles, weeks, FAQ, hero and gate config into it. `page.tsx` is now a thin composition. Guide-specific sections (Shift, Catch, Idea Bank, First Sale) and the Build-Along `SprintCard` stay in `_sections.tsx` until S3.
- Decisions made: shared blocks take the copy deck as a prop and throw on a missing slot, instead of relying on compile-time slot types. The per-guide file keeps typed slot wrappers, so static slots are still checked at compile time. Gate text, UTM campaign, checklist storage key and prompt file name moved into the spec. Analytics event names and payloads, localStorage keys, the `builder-guide` class and `data-guide` attribute are unchanged.
- Checks run: before and after `renderToStaticMarkup` of the guide page, byte-identical (md5 match), and metadata JSON identical. `npx tsc --noEmit` exit 0. `npx eslint` on the guides folder and both test files, 0 errors and 0 warnings. `npm run test:home` 107 passed, 1 skipped. `npm run build` failed once on the Next.js security upgrade nudge, retry exit 0 and `/guides/5-to-9-builder` prerendered. `CHECK_BUILT_GUIDE=1 npm run test:home` 108 passed, built-HTML copy check included. `next upgrade` was not run.
- Result: S1 acceptance met. New test file `tests/home/guide-shared-blocks.test.ts` covers the missing-slot throw, the idea-count placeholder, the serialisable nav slice, gated versus ungated JSON-LD and spec-driven metadata. The existing guide test changed only in two file paths (spec import, CSS path) and one unused constant removed. No assertion weakened.
- Gotchas: the first `npm run build` fails on the Next.js security nudge and passes on retry, the same as PR 331. A visual check at phone width was not run, and none is needed for a byte-identical markup change.
- Next: S2, the GuideSpec zod schema and `audit:guide`. Wait for an owner go-ahead.
