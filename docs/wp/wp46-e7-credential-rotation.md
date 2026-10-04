# WP46-E7 production credential rotation plan

Status: **completed for the canonical live site; editorial launch remains NO-GO** (2026-10-04). This is the
credential follow-up to the private operator log exposure recorded in
[`wp46-e7-gate.md`](wp46-e7-gate.md). Do not copy credential values into this
repository, a PR, a ticket, a shell transcript or a deployment log. A current
reader/backend deployment and healthy public pages do not close this gate.

## Scope and live dependencies

| Credential | Current live dependency | Rotation effect to plan for |
| --- | --- | --- |
| `AUTH_GOOGLE_SECRET` | Convex Auth's Google provider on the live Convex deployment | New Google OAuth callbacks must work before revoking the old client secret. Check the actual Google client ID and callback registration without recording the secret. |
| `JWT_PRIVATE_KEY` and its public `JWKS` | Convex Auth signs and verifies sessions | Replace as a **matched pair**. Existing sessions may be invalidated; require fresh login and check the existing super-admin account binding. Do not treat a valid old browser session as the test. |
| `REVALIDATE_SECRET` | Convex `revalidate.run` calls the canonical Next `/api/revalidate` route | Both ends must agree. The production Vercel variable is present, but edits apply to a **new deployment**, not the running one. Pause content changes during a mismatch; failed revalidation is logged and does not fail the originating content mutation. |
| `PLATFORM_BILLING_BRIDGE_SECRET` | Convex billing bridge HMAC verification | The current Vercel production env-name inventory has **no** matching bridge variable; do not infer an active production billing integration. Rotate the Convex value. If billing is later enabled, provision a fresh matching secret on both sides and verify the complete test-mode flow separately. |

`SITE_URL`, `AUTH_GOOGLE_ID`, `SUPER_ADMIN_BOOTSTRAP_EMAIL`, and the public
`JWKS` are configuration/identity inputs, not independently secret values.
Do not remove or change them incidentally. `CONVEX_DEPLOY_KEY` was created
after the exposed log for this E7 build and is limited to
`deployment:deploy`; verify its creation time and scope before excluding it
from the final exposure inventory. The live Convex target is
`first-squirrel-244` (`https://first-squirrel-244.eu-west-1.convex.cloud`),
not this checkout's default `--prod` target.

## Execution record and remaining sequence

The owner authorized the ordered E7 work in this conversation. A new full
snapshot of the exact live target was captured immediately before rotation:
`tmp/wp46-e7/live-before-credential-rotation-20261004.zip`, snapshot
`1791123922265844827`, SHA-256
`b6d86085a1d9afae0e22b4916d6beb29e29e4e8f65812b2b0ed72be1a2912ddf`.
ZIP integrity passed; the file is ignored and mode `0600`. The canonical
reader reported `d4b53c2367d14ebb7236692a57c79c88b70cf43f` and the
editorial release switch was absent throughout these changes.

- A second Google OAuth client secret was added to the **existing** production
  client, matched to the live `AUTH_GOOGLE_ID` and Convex callback. Only the
  new secret was set on `first-squirrel-244`. Fresh owner Google sign-in and
  editorial access passed before and after disabling the former secret. The
  former secret was then deleted in Google Cloud; only the new one remained
  enabled. No secret value was placed in this repository.
- `JWT_PRIVATE_KEY` and `JWKS` were replaced atomically on the exact live
  Convex target using a one-hour `deployment:env:write` key, then read back
  as an exact pair. That temporary key was revoked. The old session failed,
  as expected; fresh owner Google sign-in succeeded, the same one active
  super-admin binding remained, and editorial settings loaded.
- `PLATFORM_BILLING_BRIDGE_SECRET` was replaced with a fresh random value on
  the same live target and verified by exact readback without logging the
  value. The current Vercel production environment inventory has no matching
  bridge variable; the frontend requires explicit test mode, test Stripe key,
  test prices and a matching bridge, so live checkout remains disabled. A
  complete test-mode billing flow is a separate future gate if billing is
  enabled.
- `REVALIDATE_SECRET` was rotated after PR #103 merged at
  `b40687e20480289a2a5c90596ddacaa28d02020b`. The canonical route now
  rejects a missing or query-only credential (401) and accepts the header
  (200). The first replacement Vercel redeploy rejected the replacement value;
  Convex was deliberately left on its previous value. Reapplying the Vercel
  value **without a trailing stdin newline** and building a protected
  production-target diagnostic deployment made the new header pass. A fresh
  Git-backed production redeploy `dpl_3zAUL9BYgD6C2JxfKi1upsjFwAEQ` then
  reached Ready on the canonical domains with the same reader commit. Only
  after its header probe passed was the new value set on `first-squirrel-244`;
  exact readback matched. A missing credential still returned 401. The
  temporary local plaintext copy was deleted. This sequence does not prove
  the original failure's precise cause; it proves the final paired values.
- The Convex `revalidate:run` internal action then invalidated the `articles`
  tag on the exact live target. A warmed canonical `/articles` response moved
  from HIT (`age: 13`) to STALE (`age: 25`) and then a fresh HIT (`age: 8`).
  This exercises Convex → Next rather than only calling the HTTP route.
  Known and unknown idea pages, articles, sitemap and reader health remained
  healthy; public pointers and managed versions remained zero. The release
  switch, reader origin and reader SHA stayed absent. The local release
  secret and pulled environment file were removed after verification.

All four affected live credentials have been replaced. Historical Vercel
deployment URLs can retain their original environment snapshot; the canonical
domains now use the new value. The original procedural checklist below is
retained as the operation plan; the execution record above is current status.

### Original preparation checklist

1. In [`backup-restore.md`](backup-restore.md), append the dated production
   action record: exact Convex deployment, Vercel project, serving Git SHA,
   full snapshot including storage, restore tag, current environment **names**,
   scheduled-job inventory, affected-key inventory from the private log, and
   explicit owner approval for key rotation. Store old/new values only in the
   owner's secret manager with restricted access. The previously exposed
   values are **not** a safe long-term rollback target.
2. Freeze editorial release and content updates for the rotation window.
   Confirm `EDITORIAL_RELEASE_ENABLED` remains absent/off. Capture a fresh
   backup and public-route/auth baseline. Record who can access the Google
   OAuth console, Convex production deployment and Vercel production project.
3. Prepare independent fresh secrets and a new JWT key pair in the secret
   manager. Verify the Google provider supports a transition before changing
   its active secret. Determine the existing session impact and communicate
   that users may need to sign in again. Rehearse the exact operations and
   smoke checks in an isolated deployment; do not copy live credential values
   to staging.

## Coordinated execution after approval

1. Rotate the Google OAuth client secret through the provider's supported
   overlap/reset procedure, update `AUTH_GOOGLE_SECRET` on **only** the
   verified live Convex deployment, and complete a new Google
   redirect/callback/session/logout journey. Revoke the old provider secret
   after the new path succeeds. If the provider offers no overlap, use a
   scheduled sign-in maintenance window and stop on failure.
2. Replace `JWT_PRIVATE_KEY` and `JWKS` together on the same Convex deployment
   using an atomic environment update where available. Verify a newly minted
   session, logout, and re-auth; confirm the authenticated account still has
   the one expected super-admin binding before any editorial action. If it
   does not, stop and investigate identity mapping; never bootstrap a second
   account to make the check pass.
3. For revalidation, prepare a new Vercel production secret and deployment
   without promoting a mismatched deployment to the canonical domain. In a
   short content-write pause, promote the new Vercel deployment and update
   the live Convex `REVALIDATE_SECRET` to the same new value. Exercise an
   authorized revalidation request and verify a representative tagged page
   actually refreshes. A 200 from the route alone is insufficient. Restore
   content writes only after both ends pass. If the promotion cannot be
   coordinated safely, add a temporary dual-key verification path in a
   separately reviewed change before rotating; do not accept silent stale
   cache as success.
4. Rotate the Convex billing bridge value. Since the Vercel production bridge
   variable is absent and billing requires test mode in the current code,
   verify billing remains disabled rather than attempting a live charge. If
   a matching Vercel variable is found in a fresh inventory, stop and expand
   this step to a coordinated two-sided rotation with a test-mode checkout,
   webhook and idempotent event check.

## Stop, recovery and closure

- Stop if the target, account identity, published reader commit, key pairing,
  route refresh or scheduled-job inventory differs from the approved record.
  Leave editorial release disabled and keep content writes paused while
  reconciling a bridge mismatch.
- Restore the **serving code and data** from the approved tag/snapshot only
  when that layer is actually implicated. For a credential failure, repair
  with a newly generated secret or matched key pair; do not reintroduce an
  exposed secret as a lasting rollback. Reconcile pending functions/jobs and
  confirm the public route matrix after recovery.
- Record only key names, change times, deployment IDs, pass/fail smoke
  results, observed account ID/binding count (not PII), and provider-side
  revocation completion. Recheck that no old key remains active. Independent
  security/design review and the remaining E7 managed-release journey are
  separate gates; rotation alone does not authorize the release switch.

References: [Vercel environment changes and deployments](https://vercel.com/docs/environment-variables/managing-environment-variables),
[Vercel secret rotation](https://vercel.com/docs/environment-variables/rotating-secrets),
[Convex atomic environment update](https://docs.convex.dev/deployment-api/update-environment-variables),
[Convex Auth key-pair setup](https://labs.convex.dev/auth/setup/manual), and
[Google OAuth credential guidance](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).
