# WP27 Stories - Structured Site Renderer And Isolated Preview

Branch: `codex/wp27-site-preview`
Lane: Work Package
Registry: `docs/PROJECT_STRATEGY.md`
Definition of done: Every story below passes its verification, the required
checks pass, an independent high-risk reviewer finds no remaining
critical/high/medium issue, and `docs/wp/wp27-progress.md` records honest
evidence. This is a Critical-risk publishing/security package: the preview is
the first artifact an unauthenticated stranger can cause this system to
generate and render.

## Dependencies (both satisfied)

- WP25 (intake/projects/public CTA) — passed 2026-08-06.
- WP26-S1 report/site-input contract subgate — passed 2026-08-06. WP27
  consumes `SiteInputPayload` from `convex/platform/engine/contracts.ts`.
- **Not** blocked on WP26-S2 through S6. A repository-idea preview derives its
  content from the canonical `ideas` record plus the customisation step, not
  from a generated Validation Report. `socialProof` may be an empty array on
  this path (the S1 parser permits it); `keyBenefits` may not.

## Ruled Inputs (2026-08-06, see `docs/wp/RULINGS.md`)

- **Anonymous preview storage:** one additive `preview_capabilities` table.
  The frozen WP22 tables (`projects`, `site_configs`, `site_versions`) all
  require `ownerId: v.id("users")`, so an anonymous visitor has nowhere to
  store an artifact. This table holds the pre-signup artifact and is claimed
  into a real owned project on signup. No frozen table is modified and no
  WP22 owner-only invariant is relaxed.
- **Capability lifetime:** 7 days. Reusable within the window (a visitor may
  reload or reopen the link); expiry is enforced server-side on every read,
  never by client-side comparison or by absence of a cleanup job.
- **Template set:** three templates with a picker.

## Architecture Decisions (orchestrator, not owner rulings)

- **`SiteRenderSpec` wrapper.** Template choice is a rendering property, not
  content, so it does not belong in WP26-S1's frozen `SiteInputPayload`.
  WP27 defines `SiteRenderSpec = { contractVersion, templateId, siteInput }`
  and stores it as the site version's `documents.body`. This keeps the S1
  contract unchanged at v1, needs no `templateId` column on the frozen
  `site_configs`, and carries the template choice through the anonymous ->
  claimed transition for free.
- **Token storage.** The capability token is a cryptographically random value
  returned to the visitor once and stored only as a hash, the same discipline
  WP21 applied to magic-link tokens. A database read must never be able to
  reconstruct a working preview URL.

## Stories

- [x] `WP27-S1` - Preview capability contract and additive table
  - Scope: `convex/schema.ts` (one additive table, serialized one-writer
    seam), `convex/platform/preview/{capabilities,renderSpec}.ts`, contract
    and authorization tests. No route or UI in this story.
  - Acceptance criteria:
    - One new `preview_capabilities` table storing at minimum: token hash,
      source idea reference, `templateId`, the `SiteRenderSpec` (or a
      `documents` reference to it), `expiresAt`, `createdAt`, and optional
      `claimedByUserId`/`claimedAt`. No frozen WP22 table is modified.
    - The plaintext token exists only in the generating response and the
      visitor's URL. Only its hash is persisted; no query returns it.
    - `SiteRenderSpec` is versioned, validates its nested `siteInput` through
      WP26-S1's existing `parseSiteInputPayload`, and rejects an unknown
      `templateId` — a template set is a closed enum, never a free string
      that could select an arbitrary component or path.
    - Expiry is evaluated server-side against a passed-in timestamp on every
      capability read, per the Convex guideline against reading the wall
      clock inside a query.
    - Resolution is constant-shape: an expired, unknown, and malformed token
      are indistinguishable to the caller, so the endpoint cannot be used to
      enumerate valid tokens.
  - Verification:
    - Convex tests: unknown token denied; expired token denied; valid token
      resolves; plaintext token is absent from every stored row and every
      query projection; unknown `templateId` rejected; malformed
      `SiteRenderSpec` rejected; a `SiteInputPayload` that fails S1's parser
      fails closed here too rather than being stored.
    - Adversarial: a token differing by one character resolves to the same
      generic not-found as a well-formed unknown token.

- [x] `WP27-S2` - `/build/{slug}` anonymous customisation and preview generation
  - Scope: `app/build/[slug]/**`, a bounded preview-generation Convex
    mutation, analytics events. No renderer internals (S3) and no
    `/preview/{token}` route (S4).
  - **This route currently 404s while four shipped components already link to
    it** (`PreviewIdeaCta` on every public idea page, plus `ExploreCard`,
    `DashboardHome`, `ProjectCard`). Production is unaffected because the
    platform program is unmerged from `main`, but WP27 must land before that
    merge or every idea page ships a dead primary CTA.
  - Acceptance criteria:
    - Server-renders a short customisation step prefilled from the canonical
      `ideas` record, resolved server-side from the slug. An unknown slug
      returns the normal 404, never a generated preview.
    - Works for a fully anonymous visitor: no signup, no payment, no session.
    - Submitting generates one `SiteRenderSpec`, issues one capability, and
      redirects to `/preview/{token}`.
    - Generation is rate-limited per client. This is the only endpoint where
      a stranger causes server-side artifact creation, so an unbounded path
      here is an abuse vector, not a nicety. Prefer the
      `@convex-dev/rate-limiter` component over a hand-rolled counter, per
      the Convex guidelines.
    - Customisation input is length-bounded and normalized before storage,
      reusing the WP25 brief-field discipline rather than inventing a second
      validation style.
    - Persists the spec **only** through `serializeSiteRenderSpec`. The
      schema stores `renderSpec` as a bare `v.string()` and cannot compel
      this; a direct `JSON.stringify` would bypass both the contract
      round-trip and the byte ceiling.
    - Supplies `now` from a server `Date.now()` in the mutation. It must
      never be accepted as a client argument: `S1` fails closed on a
      non-finite clock, but a client-controlled *finite* timestamp would
      still let a caller choose their own expiry window.
    - Emits `preview_started` and `preview_generated`, consent-gated, with no
      PII in the payload per the UX brief's analytics contract.
    - The route is `noindex` and absent from the sitemap.
  - Verification:
    - Route tests: anonymous generation succeeds; unknown slug 404s; private
      metadata asserted; rate limit denies a burst; oversized/malformed
      customisation input fails closed.
    - Confirms all four existing inbound links resolve rather than 404.

- [x] `WP27-S3` - Structured renderer with three templates
  - Scope: `components/preview/templates/**`, shared renderer primitives,
    per-template snapshot/security/a11y tests.
  - Acceptance criteria:
    - Three templates render **only** from a validated `SiteRenderSpec`. No
      raw HTML, JSX, `dangerouslySetInnerHTML`, script, arbitrary CSS, or
      client-supplied protocol is accepted anywhere in the path — this is the
      manifest's binding tenant-content guardrail, not a style preference.
    - Any URL-valued field is protocol-allowlisted (`https:`/`http:` only);
      `javascript:`, `data:`, and `vbscript:` are rejected before render.
    - Templates read **only named fields** from the render spec. They must
      never iterate its keys or spread it onto an element. `S1`'s parser
      validates the named contract but returns the parsed object as-is, so
      unknown keys survive — matching WP26-S1's convention. That is harmless
      to a reader of named fields and load-bearing to anything that spreads,
      which is exactly how an injected `evil` key would reach the DOM.
    - Every template carries the preview watermark; it is part of the
      template contract, not an overlay a caller can omit.
    - Each template independently meets WCAG 2.1 AA: one semantic `main`,
      logical heading order, visible focus, AA contrast, and no
      colour-only status.
    - The picker is keyboard-operable and announces the selected template.
  - Verification:
    - **Per template, not once for the set** — this is the cost of choosing
      three: an XSS suite (script tag, `javascript:` href, `onerror`
      attribute, `data:` URI, unicode-escaped payload) and an automated
      accessibility scan against each of the three.
    - Snapshot tests proving no unsanitized field reaches the DOM.

- [x] `WP27-S4` - `/preview/{token}` isolated preview route
  - Scope: `app/preview/[token]/**`, security headers, metadata.
  - Acceptance criteria:
    - Renders only on a valid, unexpired capability. Expired or unknown
      returns a generic, non-enumerating page — never a partial render and
      never a message distinguishing "expired" from "never existed".
    - `S1` guarantees constant response *shape* (all three cases return
      null), not constant time. `S4` therefore owns the observable half of
      that contract: identical status code, body, and cache headers across
      malformed, unknown, and expired. A differing 404-vs-410, or a
      `Cache-Control` that varies by case, would reintroduce the oracle that
      `S1`'s null-for-everything exists to close.
    - Sends `noindex, nofollow, noarchive, nocache` and private/`no-store`
      caching. A preview must never be cached by a shared cache or CDN.
    - Excluded from `app/sitemap.ts`.
    - Lead capture is **structurally disabled**: any contact form renders as
      a visibly inert demonstration with no production `leads` write path
      reachable from this route. Disabled-by-config is not sufficient; there
      must be no wired endpoint.
    - Does not claim, resolve, or imply a tenant hostname. Host routing is
      WP28's exclusively.
    - Emits `preview_viewed`.
    - Offers the signup path that converts the preview into an owned project.
  - Verification:
    - Security tests: header matrix, expired/unknown token behavior,
      sitemap exclusion, absence of any lead-write path, no tenant-host
      resolution.
    - Carried from `S2`: the preview API's same-origin check currently reads
      `PLATFORM_BILLING_APP_ORIGIN` and silently skips when that is unset.
      Give the preview surface its own origin configuration, or fail closed
      when it is missing, rather than leaving a preview route depending on a
      billing-named variable.
    - Carried from `S3`: run the **live automated accessibility scan per
      template** against this route at desktop and mobile widths. `S3`
      asserted the structural properties it could prove without a route (one
      `main`, `h1` first, heading order, inert CTA, `aria-hidden` watermark),
      but colour-contrast needs the compiled stylesheet, which only exists
      once a real page renders a template. Do not treat `S3`'s structural
      pass as satisfying the contrast half.
    - Verifies the preview page is not server-cached across two requests
      with different tokens.

- [x] `WP27-S5` - Claim an anonymous preview into an owned project
  - Scope: claim mutation, signup integration, ownership tests.
  - Acceptance criteria:
    - On signup, a held capability converts into a real owned `project`,
      `site_config`, and `site_version`, carrying `templateId` and
      `siteInput` forward unchanged via the stored `SiteRenderSpec`.
    - Claiming is **exactly once** and idempotent: a repeated or concurrent
      claim of the same capability yields one project graph, matching the
      WP25 concurrent-create discipline rather than a new pattern.
    - A capability already claimed by user A cannot be claimed or read by
      user B. An expired capability cannot be claimed at all.
    - The created records satisfy every WP22 authorization invariant —
      identity derived server-side, no caller-supplied owner ID.
    - Emits `signup_completed` and `project_created` only after server
      confirmation.
  - Verification:
    - Convex tests: single claim; concurrent duplicate claim via
      `Promise.all` yields one graph; cross-owner claim denied; expired
      claim denied; created graph passes owner-isolation checks.

- [ ] `WP27-S6` - Run the WP27 renderer/preview/security gate
  - Scope: `docs/wp/wp27-progress.md` plus WP27-owned fixes only.
  - Acceptance criteria:
    - Standard checks pass: `npm run typecheck`, `npm run lint`, `npm test`,
      `npm run build`, `npm audit --omit=dev --audit-level=high`,
      `git diff --check`, secret scan.
    - Authenticated and anonymous browser journeys at desktop and mobile
      widths, including keyboard-only and automated accessibility passes.
    - Independent high-risk review reports no unresolved critical/high/medium
      finding in capability security, XSS/injection, caching/indexing,
      ownership, or claim idempotency.
    - No host cutover, publish, live lead capture, payment, production
      deploy, or data mutation occurred.
  - Verification:
    - Full standard suite plus the per-template security and a11y matrices.

## Out Of Scope

- Tenant host routing, wildcard DNS, published-site hostnames, and rollback —
  WP28 owns all of it. WP27 must not resolve or claim a tenant host.
- Production lead capture — WP28. WP27's forms are structurally inert.
- Payment and publish authorization — WP24 (done) and WP28.
- Validation Report generation — WP26-S2 through S6.
- Any change to WP22-frozen tables beyond adding the one ruled
  `preview_capabilities` table.
- `middleware.ts`/`proxy.ts`, lockfiles, and webhook routes unless the
  orchestrator explicitly serializes the seam.
- Production deployment, data mutation, or credential rotation.

## Notes

- Promote unknown product decisions to `docs/wp/RULINGS.md`.
- The three-template choice was the owner's, made against a recommendation of
  one, with the trade-off stated. Its cost is concentrated in `S3`, where the
  XSS and accessibility matrices must run per template rather than once — do
  not collapse them to a single shared suite to save time.
- `convex/schema.ts` is a serialized one-writer seam. `S1` is the only story
  that touches it, and only to add the one ruled table.
