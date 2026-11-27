# WP104 · Enhance with AI verification

## PR A · Panel

The static Enhance route won over Keystatic's catch-all at `/admin/pages/enhance`. The operator opened it after saving the homepage singleton. Signed-out and signed-in non-operator requests received 404. The section picker covers all nine landing singletons. The schema supports an optional homepage note or checklist before the closing call. The fixture tests rejected altered tokens, amounts, dates, URLs, seat figures and automation identifiers.

Production build, typecheck, lint and the 7,242-test suite passed. The local editor round-trip passed after the homepage seed explicitly represented the empty optional section list. The Phase 1 cumulative visual rerun matched 44/44 references. One prior matrix run hit the observed two-pixel mobile Shipable variation. The individual rerun and final matrix matched that page.

## PR B · Generate

The Anthropic provider uses the existing API key and Claude Haiku 5.5. The generate route independently checks operator access and same origin. It accepts six previews per minute per process, returns validated before/after wording and usage, and has no save path. Mocked fixtures cover malformed output, provider errors, the rate limit and a missing key. A production build passed on the Generate branch.

## PR C · Approve

The approval route independently checks operator access, verifies a 15-minute proof of the preview and revalidates both the selected copy and the resulting page schema. Local approval serialises writes with the Keystatic handler and atomically replaces the reviewed file. GitHub approval uses the operator's Keystatic session and an optimistic file-SHA check. New branches start at the reviewed commit. Draft saves require `content/`.

The fixtures cover all nine current page documents, a local write and replay, rejection of altered wording and stale content, an optional homepage checklist, and GitHub branch creation plus a conflicting create. Provider and GitHub calls use fixtures. The hosted workflow and a live operator sign-in still require the repository owner.
