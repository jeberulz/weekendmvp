# Editorial Admin — implementation and integration contract

## Architecture and ownership

Use the existing Next.js/React stack and Convex Auth. Add an isolated feature under `/admin/editorial`. Private editorial storage holds drafts/revisions/reviews; existing Git MDX plus the manifest remain the canonical released content artifacts. Convex's current `ideas` table is a public projection, not draft storage. A durable release coordinator stages reviewed artifacts and records deployment/activation outcomes.

Do not implement a second research engine or a second Markdown compiler. WP45 owns source verification, safety, quality policy and compiled artifact hashes. Editorial owns human review, private revision lifecycle and release intent. A later integration adapter connects them. WP38 supplies narrow super-admin authentication/audit primitives; if absent, build only its editorial-required subset in an assigned security integration window. Do not accidentally open WP38's billing/customer operations or WP32's full harvest catalogue.

Build the UI through typed repository interfaces and fixtures first. Fixture mode is local/test-only and cannot approve, seed, deploy, or obtain production tokens. Production `/admin/editorial` fails closed until its real auth/repository adapter is available. No query parameter, local-storage role or production environment flag that bypasses authentication.

| Owner | Allowed scope during parallel work |
|---|---|
| UI agent | New `app/admin/editorial/**`, `components/admin/editorial/**`, `lib/editorial/**`, `tests/editorial/**`, feature docs; fixture adapters and contract tests. Reuse shared components read-only. |
| WP45 agent | `lib/engine/**`, engine scripts, quality/eval/promotion behaviour and its assigned CI/seed changes. Editorial does not edit these. |
| Security/backend integrator | Assigned WP38 subset and `convex/editorial/**`; additive schema/index merge and generated API regeneration in one serialized window. |
| Release/public-site integrator | Narrow release workers and public visibility/seed/caching/API/SEO changes after WP45 and security contracts pass. |

No shared-file modifications during the initial parallel slice: `convex/schema.ts`, `convex/_generated/**`, auth helpers, root layout/styles, middleware/proxy, lockfiles/package scripts, `.github/workflows/**`, public routes, `ideas/manifest.json`, `content/ideas/**`, existing compiler/seed scripts and strategy registry. New dependencies require a coordinated lockfile update. Put commands in feature docs until the package-script merge window. Choose free local ports and an isolated disposable backend, never WP44's 3310/3311/3188/3189 or the shared 3210 backend without explicit coordination.

## Contract first, engine integration last

Freeze a small **Editorial DTO v1**, owned under `lib/editorial/contracts/`, before UI work. It is a presentation/command boundary, not an invented replacement for WP45's eventual ResearchRecord v2. The engine adapter maps its final output to this DTO. Unknown/missing evidence remains unknown; do not generate defaults that look verified.

Minimum incoming envelope:

```ts
type EditorialSubmission = {
  contractVersion: 1;
  submissionId: string;             // idempotency key scoped to producer
  producer: "engine" | "legacy-import" | "manual";
  mode: "live" | "fixture" | "legacy";
  engineRunId?: string;
  engineContractVersion?: number;
  artifactHash: string;             // recomputed by trusted receiver
  title: string;
  proposedSlug: string;
  buyer: string;
  job: string;
  wedge: string;
  recommendation: "accept" | "needs_research" | "reject" | "unknown";
  recommendationReasons: string[];
  markdown: string;
  metadata: EditorialMetadata;      // explicit existing tag/highlight fields
  sources: EditorialSource[];       // IDs, URLs, permitted excerpts, freshness
  claims: EditorialClaim[];         // source IDs, observed/derived/assumed
  checks: QualityCheck[];           // IDs, scope, policy/version/hash/outcome
};
```

Define referenced types with explicit validators, maximum field/array/body sizes, timestamp rules and unknown values; never `any` or an unrestricted metadata bag passed through to public output. Producer, actor, mode and verification authority are server-established, not trusted merely because JSON says so. Raw imported bodies remain quarantined until safe parsing succeeds.

Required interfaces, implemented by fixture then real adapters:

- `listIdeas(filter, cursor, pageSize)`, `getIdea(id)`, `getRevision(id, revisionId)` and `listActivity(cursor)`.
- `importSubmission(envelope, ingestionCredential)` with dedupe, size/format validation and no human capability.
- `saveDraft(id, baseVersion, patch, idempotencyKey)` returns acknowledged version or a conflict, never last-write-wins.
- `setCandidateDecision(id, expectedVersion, decision, reason)`; reopening always invalidates prior decision-dependent approvals.
- `markReviewed(revisionId, reviewItemId, dependencyHash)` and `approveRevision(revisionId, artifactHash, reason)`.
- `prepareRelease(revisionId, expectedLiveReleaseId)` creates isolated staging/preview only; `publishRelease(releaseId, expectedState, approvalId, idempotencyKey)` creates the exact production release intent.
- `unpublishIdea(id, expectedLiveReleaseId, reason, idempotencyKey)`, `trashIdea`, `restoreIdea`, `retryRelease`, `requestRollback` with explicit state preconditions.

Every mutation derives identity server-side. Do not take `actorId`, trusted role, approval status, published revision pointer or verified flags from the client. UI gating explains errors; the backend enforces them again. Signed service callbacks only advance authorised release jobs and can never create human approval.

Fixtures cover: new accepted engine candidate; duplicate rejection; evidence unavailable; changed source; live legacy idea with no record; live idea with edited draft; conflicting autosave; stale approval; failed deployment; uncertain activation; unpublished; trash. Use these same contracts to test the final adapters. No engine branch imports are required to build the UI.

## Private storage model

Add separate private tables in the coordinated schema phase. Suggested names (adapt to existing WP38 primitives where present):

| Table | Essential contents/invariants |
|---|---|
| `editorialIdeas` | Stable ID, reserved slug, candidate decision/reason, lifecycle active/trash, current draft ID, published release ID, generation counter. Engine run is not the idea identity. |
| `editorialRevisions` | Immutable submitted snapshots plus an editable working draft with version fence; content/metadata/evidence hashes, parent revision, origin, author, timestamps. Approving freezes a snapshot; later edits fork. |
| `editorialEvidence` | Revision-scoped sources/claims, verification references, safe excerpts, freshness and review dependencies; never full scraped-page archives. |
| `editorialReviews` | Actor, revision, checklist item, dependency hash, explicit attestation, timestamp; overall approval includes policy/check/artifact hashes and revocation state. |
| `editorialReleases` | Target revision, expected prior live release, operation, state, idempotency key, branch/commit/build/deploy IDs, health proof, activation result, recovery reference. |
| `editorialAudit` | Append-only command attempts/outcomes, actor/capability/target, reason, correlation ID and redacted errors. Prefer WP38 audit table/helper when available. |
| `editorialImports` | Source commit/deployment snapshot, checksums, dedupe keys, report and conflicts; resumable import without publication side effects. |

Use bounded documents/chunks or private object storage for large revisions; design indexes for state+updated time, idea+revision, release state and audit time. No unbounded `.collect()` admin feeds. Audit failed attempts in a committed path that survives a rejected mutation; an audit insert rolled back with the denial is not an audit record. Do not log raw bodies, tokens, provider responses or personal account details.

## Three independent state machines

**Candidate decision:** `new → accepted | needs_research | rejected`; reopening goes to `new/needs_research` with reason. Engine recommendation is stored separately. Accept does not approve copy.

**Revision review:** `draft → in_review → changes_requested | approved`; save creates a new version and invalidates obsolete approval; rejected candidates cannot approve. Review checklist is tied to the exact material, not an idea-wide boolean.

**Publication:** `never_published | live | unpublished`, with separate asynchronous release states `preparing → preview_ready → publish_requested → deploying → verifying → activating → succeeded`, or `failed/cancelled/needs_reconciliation`. Keep the last known live release visible throughout an update. “Live” comes from verified activation, never from the Publish button click.

Trash is an independent soft-delete lifecycle allowed only when not live and no in-flight activation can resurrect it. Unpublish must revoke/advance the release generation so delayed workers cannot activate afterward. Restore does not restore approval or public visibility. Slugs remain reserved across trash/unpublish; slug changes are deferred in v1 to avoid breaking saved references and SEO.

## Security and human authority

- Bootstrap one verified owner account to a server-side capability in deployment configuration; no hardcoded email or client-supplied ID. No public grant-role endpoint. Missing/revoked capability denies every query, command, preview and export.
- Protect route/RSC/API/backend functions, not just layout/navigation. No private bodies in unauthorised HTML, streamed payloads, cache, errors or search indexes. Private/no-store, noindex and sitemap exclusion. Revalidate access on writes and job execution.
- Publish/unpublish/rollback/trash require explicit action, reason, state preconditions and recent strong authentication. Choose a proven supported re-auth mechanism in the security phase; do not ship a “type your name” substitute or use an old login timestamp as proof. Credential revocation cancels unexecuted release authority.
- Ingestion credentials can create/update quarantined submissions only. Publisher identity can stage and execute a narrowly scoped recorded release; it cannot approve, change the reviewed body, grant roles or read customer data. Restrict repository/project/environment access and preserve CI/branch protections.
- Use actual backend transactions for review/version fences, then an outbox/job coordinator for external deployment. Stable idempotency keys, monotonic generation fences and compare-and-swap publication pointers handle retries and competing tabs. Test real contention where the test harness otherwise serializes operations.
- Safe preview uses Markdown parsing with JSX/ESM/expressions rejected. No `eval`, arbitrary component imports or raw HTML execution. External source URLs use WP45's safe fetch service; no browser-to-arbitrary-host proxy or uncontrolled webhook destination. Safe links and filenames, path containment and sanitised downloads.
- Protect cookie-authenticated HTTP writes against CSRF, validate origin and request sizes, rate-limit dangerous commands, redact errors and verify webhook signatures/replay timestamps. Never invoke shell strings constructed from slugs/Markdown.
- Security/evidence blockers cannot be overridden with a checkbox. Human judgement can resolve editorial warnings with reasons, but must not falsify machine verification. Source changes/removals revoke dependent checks and require fresh review before the next release.

## Publishing integration — preserve the existing public architecture

**Important baseline:** MDX currently takes precedence over Convex body; routes can fall back to files on backend failure; homepage and sitemap use repository data. Adding `published:false` to a database row does not unpublish a page. This integration is required for the product and deliberately excluded from parallel UI work.

Choose Git-backed releases with a narrowly scoped publication visibility/version gate. Do not migrate all public content to an ad-hoc runtime CMS in this work package. The integrator must support exact revision selection, not merely a Boolean allow/deny over whichever MDX happens to be in the latest deployment.

1. Private revision passes WP45 verification and the editorial review checklist. Stage exact artifact/record/metadata/OG hashes into an isolated release branch via a repository-restricted worker. Never stage draft artifacts into an automatically public deployment. Rebase/conflict resolution invalidates affected checks; non-content commit changes still require exact build provenance.
2. Build a protected preview from that commit, verify safety/rendering/links/assets and show it to the admin. Preview cannot be indexed or anonymously enumerated. A public Vercel preview URL is not adequate privacy by itself. The preview review binds to its artifact set.
3. Approve that revision and confirm Publish. Backend records an immutable release intent bound to approval, hashes, expected current live release and recent re-auth. Background service does the remaining steps; no extra terminal approval is needed for each internal step in the activated product.
4. Stage inactive public projection/version artifacts and deploy through the approved protected repository pipeline. Newly built content must remain nonpublic until activation. For an update, serve the previous approved version until the new one activates—deployment must not silently replace it ahead of the state transition. This requires retaining addressable prior/current release artifacts, with a narrow resolver adapter; design and test that adapter in the integration gate.
5. Verify deployment identity and artifact fingerprints, not just status 200. Check rendered section structure, metadata/OG, source links and smoke-test public delivery without exposing a private draft. Only a trusted worker can record this proof.
6. Atomically advance the public version/visibility pointer using the generation fence, publish the matching public projection and invalidate all affected caches. Reconcile Git/manifest/Convex/static artifacts so feeds and pages reflect the same release. Changes across systems are a recoverable state machine, not a pretend distributed transaction.
7. Probe the real canonical route and public surfaces against the expected fingerprint. Only then mark Succeeded/Live. An uncertain result is Needs reconciliation; never retry a completed side effect blindly. A failed update retains the old live version or explicitly reports a degraded state.

Reuse WP45's audit/promotion validation library; wrap its local receipt in server-authenticated approval. Do not trust a JSON `approvedBy` field signed by the submitting agent. Version and verify the capability/receipt at the release worker. WP45's original no-deploy scope remains intact; this separate release integration provides deployment only after its production activation gate.

Concrete artifact strategy for the integration prototype: build an allowlisted, server-only release index mapping stable idea ID + release ID to immutable Markdown/metadata/asset hashes. Package both the currently active release and the proposed release with the deployment; keep the current release resolvable until the pointer changes. Do not place private candidate bodies in `public/`, client bundles, downloadable static paths or an exposed repository. The resolver takes only a server-approved release ID and cannot accept arbitrary filesystem paths. Version the index format and verify compatibility before activation/rollback. If this repository or its deployment artifacts are publicly readable, stage unreleased artifacts in private storage/build inputs instead of committing drafts there. Verify that exposure before choosing the storage adapter.

The public reader uses this index only for ideas managed by the new release protocol; the cutover inventory pins untouched legacy pages to their verified baseline. Activation, rollback and older deployment compatibility need explicit tests—an older binary that cannot interpret the active release must fail closed, not serve a different revision. This is a narrow version resolver integration, not permission to rewrite unrelated public page layouts.

Existing `convex/revalidate.ts` can no-op without a secret and swallow failures. Its successful return is not release evidence. The release adapter must expose failed/missing invalidation configuration, require successful invalidation acknowledgements where supported, and independently probe the warmed public surfaces. Include generated slug manifests in the release inventory.

### Unpublish and public visibility contract

Unpublishing revokes the exact public release and advances the generation fence before acknowledging success. A public route must not fall back to stored MDX and resurrect it. Apply the same decision to HTML/RSC, metadata/JSON-LD, prompt endpoints/exports, catalogue queries/search, related ideas, today pick, homepage highlights/counts/weekly picks, category/tool/audience hubs, sitemap and image/content assets covered by the takedown scope.

Perform the visibility check outside stale content caches and before response streaming. CDN policy/invalidation must not allow stale published responses after removal. Define and measure the supported removal latency before activation; UI shows Pending removal until probes pass. Direct URLs should return a real 404 in v1 (410 only if a later permanent-removal policy requires it), not a PPR shell with hidden content and HTTP 200. No sitemap entry or fallback body. Privacy-related removal cannot be described as complete while an export endpoint still returns the text.

Retain original `publishedAt`; record `updatedAt` for subsequent releases. Deliberately update sitemap `lastmod` with the verified content release time, not current request time. Retain stable identifiers for saved ideas and member plans; show unavailable status without deleting user-owned data. Do not expand super-admin permissions to inspect those private plans.

Old deployments/preview URLs and repository history may retain previous content. Document which surfaces can be revoked and how protected previews, old assets and public repository artifacts affect removal. “Unpublish” means removed from the supported public site, not erased from the internet; privacy takedown uses a separate scoped procedure if stronger erasure is required.

### Import existing live ideas

Use a read-only inventory from the deployed repository commit and its actual production metadata snapshot, not assumptions based solely on local main. Resolve MDX-versus-Convex body using the same canonical precedence. Record all slugs, origins, body/metadata hashes, missing records/assets, retired flags and mismatches. No production reads containing secret values in logs.

Import only into private editorial tables, with dry-run and dedupe; do not seed, redeploy, rewrite dates or change live status. Do not mark old `auditPassed` flags as new human approval. An original live snapshot is immutable and labelled legacy. Repeated import is idempotent; upstream differences create a reconciliation task, never overwrite an in-progress draft. Unsupported/unsafe legacy markup is quarantined for safe display and correction, not executed in the admin.

Before enabling lifecycle controls, establish a verified baseline release mapping for existing live content and prove unchanged rendering/catalogue coverage. This is a separately gated additive integration, not something the UI agent runs in parallel.

## Delivery stories and gates

| Story | Work and acceptance | Dependencies |
|---|---|---|
| E0 Contract/fixtures | Freeze DTOs, validators, repository interfaces, status meanings and fixtures. Tests demonstrate no service import can approve. Document shared-file ownership and resolve a fresh WP number. | None; docs/new files only. |
| E1 Shell/queue/library | Responsive shell, search/filter/pagination, truthful states, guarded routes and environment banner. Keyboard/a11y passes; no member UI changes. | E0; local fixtures, production deny by default. |
| E2 Review workspace | Safe editor/preview, autosave conflicts/recovery, evidence/claim inspector, quality issues, metadata/highlights, revision diff/history. No unsafe MDX execution. | E0/E1; fixtures exercise failures. |
| E3 Human workflow | Candidate decisions, explicit section/evidence review, hash invalidation, approval and publish confirmation, releases/trash/activity states; backend-interface tests. | E2; still fixture/dry-run. |
| E4 Auth/private backend | Editorial-only WP38 capabilities/audit/re-auth, private tables/indexes, repository adapter and denial matrix. Serialized schema/generated-file work. No generic admin bypass. | Assigned integration window; security review. |
| E5 Engine + legacy bridge | Map final WP45 records/checks/receipt, authenticated ingestion, dedupe, fixture-mode rejection, read-only import inventory and private import adapter. Real engine fixture contract suite passes. | WP45 contract freeze, E4; import live data separately gated. |
| E6 Release/lifecycle bridge | Durable release worker, protected preview, exact reviewed-artifact activation, stale-job fences, public visibility/version gate, idempotent scoped projection updates, unpublish/rollback/recovery. | WP45 promotion ready; E4/E5; public-site integration window. |
| E7 Launch gate | Full checks, staging publish/edit/republish/unpublish/restore journeys, source changes, failures/recovery, visibility scans, backup/restore rehearsal, bootstrap/import dry-run and owner activation plan. | All previous gates; independent high-risk review. |

E0–E3 can proceed immediately in parallel without engine integration. E4 can be developed against contracts after a coordinated security/schema window. E5–E7 are integration milestones; do not pretend they are finished using mock data. The agent should complete all work available within its assigned slice before reporting a dependency.

## Required tests

- **Human boundary:** engine submission cannot accept/approve/publish; anonymous/customer/forged admin/service calls denied; revoked role/stale re-auth denied; private previews/exports never leak. Review cannot be completed through forged item IDs or hashes.
- **Revision boundary:** approve v3, edit one byte/source/metadata/policy, publish v3 receipt against v4 fails; two tabs cannot overwrite each other; unsaved editor state cannot be included in a supposedly approved release. Approval and concurrent edit have a deterministic winner.
- **Lifecycle:** edit live v2 leaves it byte-identical until approved v3 activation; reject draft leaves live alone; trash live refused; unpublish fences delayed publish; restore remains unpublished. Saved member references persist without cross-owner access.
- **Release failure:** duplicate clicks/webhooks, worker restart, deploy timeout, missing assets, failed seed/projection, activation succeeded but acknowledgement lost, revocation during staging, stale base commit, unrelated repository changes and failed rollback. Demonstrate reconciliation and no unreviewed public bytes.
- **Visibility:** direct route, rendered HTML/RSC, JSON-LD, catalogue API, exports, sitemap, homepage/weekly pick and hubs deny/unlist unpublished content with warm caches and during backend outage. Production-build probes prove status, body and fingerprint. No false 200 success.
- **Import:** deployed snapshot mismatch, duplicate import, missing metadata, Convex-only body, invalid legacy MDX, existing draft conflict and checksum differences produce reports without changing live content.
- **Source/preview:** hostile URLs, credential-bearing links, oversized submission, prompt injection, executable MDX, code fences, source disappearance and excerpt changes. Use shared WP45 protections rather than duplicating weaker validators.
- **UI:** 1440/1024/390px, keyboard-only end-to-end review, focus trapping/return, screen-reader statuses, contrast, reduced motion, autosave failure/conflict, long titles/URLs and large documents.

Run configured `typecheck`, `lint`, `npm test`, production build and server trace checks after integration, plus tag validation/engine quality checks for affected content and `git diff --check`. A documentation-only plan does not require re-running the application suite. Read installed Next.js docs before implementation and the full generated Convex guidelines before backend changes. Do not describe mock/OCC-serialised tests as proof of real deployment or concurrency behaviour.

## Production activation checklist

The owner authorises the product's Publish interaction; this plan does not itself bootstrap production privileges or deploy code. Before turning it on: approve the exact super-admin account binding privately, verify strong re-auth, install least-privilege repository/deployment credentials through the approved secret store, rehearse restore, review dry-run import/mapping counts, verify all public visibility paths, and run an independent security review. Start with an isolated staging idea, then one explicitly approved real release. Keep a server-side publishing kill switch that blocks new activations while permitting unpublish/recovery.

Record docs, schema/contract versions, gate evidence, known limitations, rollback instructions and actual readiness in the feature progress file. Existing work continues independently until the named integration windows are agreed.
