# WP27 Progress - Structured Site Renderer And Isolated Preview

Append-only progress log. Do not rely on chat history for project state.

## 2026-08-06 - Setup and story freeze

- Branch: `codex/wp27-site-preview`, created from `codex/wp26-research-workflow` (which carries the passed Wave 2 gates, the WP26-S1 contract subgate, and the cherry-picked WP38 planning docs). Primary checkout, no worktree.
- Assignment: not yet dispatched to a worker. This session (orchestrator) verified dependencies, surfaced a frozen-contract conflict, obtained three owner rulings, and froze `docs/wp/wp27-stories.md`. No code written.
- Dependencies verified as actually satisfied, not assumed: WP25 passed 2026-08-06; the WP26-S1 site-input contract subgate passed 2026-08-06 and its `SiteInputPayload` parser exists at `convex/platform/engine/contracts.ts`. WP27 is **not** blocked on WP26-S2 through S6 — a repository-idea preview derives content from the canonical `ideas` record plus the customisation step, not from a generated Validation Report. Confirmed against the S1 parser that `socialProof` accepts an empty array on this path while `keyBenefits` does not.

### Frozen-contract conflict found and escalated

- Reading the frozen WP22 schema against the frozen pricing ruling surfaced a real conflict rather than a gap in the plan. The ruling grants an **anonymous** free landing-page preview with no signup, but `projects`, `site_configs`, and `site_versions` all require `ownerId: v.id("users")`, and no capability or token table exists among the 16 frozen platform tables. Under the frozen schema there was literally nowhere to store an anonymous preview artifact.
- WP27's manifest file boundary is "Site config/version functions, preview route, renderer/components, metadata/security tests" — it does not include `convex/schema.ts`. Per `AGENTS.workflow.md` ("If reality disagrees with the manifest, stop and escalate"), this was escalated to the owner rather than resolved silently. Precedent: WP23 hit the same class of wall and the orchestrator authorized one additive index amendment recorded as a ruling.

### Owner rulings obtained

- **Anonymous storage:** add one additive `preview_capabilities` table. Chosen over relaxing `ownerId` to optional on `site_configs`/`site_versions` (which would weaken the owner-only authorization invariant on tables whose security gate already passed, forcing a re-review of every authz path) and over ephemeral no-persistence rendering (which contradicts "signup keeps it" and would make `/preview/{token}` meaningless).
- **Capability lifetime:** 7 days, reusable within the window. Chosen over 24 hours, which would kill the realistic come-back-later conversion, and over 30 days, which weakens "expiring" as a security property.
- **Template set:** three templates with a picker. This went against the recommendation of one template; the trade-off was stated in the question (triples the renderer surface, XSS/schema test matrix, and accessibility review inside a 10-day launch window) and the owner chose it with that in view. The cost is concentrated in `S3` and is written into the story as a **per-template** security and accessibility matrix rather than a single shared suite.

### Architecture decisions taken by the orchestrator (not owner rulings)

- **`SiteRenderSpec` wrapper resolves the template-storage question without a second schema change.** The three-template choice implied storing a template selection somewhere, and neither the frozen `site_configs` nor WP26-S1's frozen `SiteInputPayload` has a field for it. Rather than amend either, WP27 defines `SiteRenderSpec = { contractVersion, templateId, siteInput }` stored as the site version's `documents.body`. Template choice is a rendering property, not content, so this is also the correct home for it on the merits — and it carries the selection through the anonymous-to-claimed transition at no extra cost.
- **Capability tokens are stored hashed**, never in plaintext, mirroring the discipline WP21 applied to magic-link tokens. A database read must not be able to reconstruct a working preview URL.
- **Token resolution is constant-shape.** Expired, unknown, and malformed tokens are indistinguishable to the caller so the endpoint cannot be used to enumerate valid capabilities.

### Live finding: `/build/{slug}` is a dead link with four inbound references

- Verified by request, not inferred: `/build/adspark` returns 404 locally and on the live site, while `/ideas/adspark` returns 200. Four already-merged components link to `/build/{slug}` — `components/ideas/PreviewIdeaCta.tsx` (on every public idea page), `components/platform/explore/ExploreCard.tsx`, `components/platform/shell/DashboardHome.tsx`, and `components/platform/projects/ProjectCard.tsx`.
- **Production is unaffected.** Confirmed `PreviewIdeaCta` is absent from `origin/main`; the entire platform program is unmerged, so no live page currently renders the dead CTA. This is the expected division of labour — WP25's stories explicitly state it built the CTA seam and did not add `/build/{slug}` — not a regression.
- It is, however, a **merge-order constraint** worth recording: WP27-S2 must land before the platform branch merges to `main`, or every published idea page ships a dead primary conversion CTA.

### Boundaries and next step

- File boundaries: per story in `docs/wp/wp27-stories.md`. `S1` is the only story touching `convex/schema.ts`, and only to add the one ruled table; that file remains a serialized one-writer seam.
- Required checks: standard WP gate plus per-template XSS and accessibility matrices, capability security tests, and anonymous/authenticated browser journeys.
- Initial risks: Critical per the manifest. The preview is the first artifact an unauthenticated stranger can cause this system to generate and render, which makes `S2`'s rate limiting and `S3`'s injection surface the two highest-risk seams in the package. `S4`'s caching and indexing headers are the third — a shared-cache hit on a private preview would be a real disclosure.
- Next: dispatch `WP27-S1` (capability contract and additive table) to a high-tier worker. Production remains untouched: no deploy, host cutover, publish, lead capture, payment, or data mutation is authorized in this package.
