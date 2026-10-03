# PR #93: live editorial access failure

Review baseline: merged `6f8a2593eab8fbdefca3fad2a6cec36769f07c26`.
Repair branch: `codex/wp46-admin-login-fix`. Lane: Work Package, WP46-E4h.

## Finding

The owner reaches the member dashboard after Google sign-in but receives the ordinary 404 at `/admin/editorial`. The live frontend embeds `https://first-squirrel-244.eu-west-1.convex.cloud`. Authenticated, explicitly targeted read-only inspection confirms that this deployment has the customer auth/dashboard functions but **no `admin/superAdmin:bindingStatus` or editorial functions**. Middleware correctly refuses access when `editorial/reads:session` is unavailable.

The checkout's `--prod` commands reached a different backend: its binding status was configured with zero bindings and its users table was empty. Those initial results must not be used as evidence about the live site's accounts. All subsequent inventory and backup explicitly targeted `first-squirrel-244`, independently confirmed by the Convex management API as a production deployment.

On the live backend:

- Google credentials and `SITE_URL` are present; `SUPER_ADMIN_BOOTSTRAP_EMAIL` is absent.
- The existing owner email configured on the other backend matches exactly one live account, whose provider is Google. The email value and account IDs are deliberately omitted.
- That account has no `emailVerificationTime`; PR #93 must be deployed and the owner must sign in again before bootstrap can succeed.

No new authorization bypass or account-linking change is needed. PR #93 preserves Google `sub`, maps its verified-email claim and leaves the binding requirement intact. Its deterministic tests pass. The missing backend rollout is the immediate root cause; the missing owner setting and verification stamp are the next readiness blockers.

## Production repair (deployed and bound 2026-10-03)

1. Preserve the live database and file storage; record the approved code candidate and recovery path.
2. Deploy the merged backend at `6f8a259` to **first-squirrel-244**, using target-specific credentials and verifying the printed URL. Do not use this checkout's implicit project default. The exact-target dry run passed schema validation, reported 22 additive editorial/admin indexes and no index deletions. It also reported a Node action runtime configuration change; retain the deployment diff with the approval record.
3. Set only `SUPER_ADMIN_BOOTSTRAP_EMAIL` on that same deployment to the already-configured owner email, which matches its existing Google account. Preserve Google credentials and existing customer accounts.
4. Have the owner sign out and back in with Google at `/login?returnTo=/admin/editorial`. The page can still refuse access until step 5. Read-only verification must confirm the email stamp before proceeding; never manufacture it.
5. Run `admin/superAdmin:bootstrapOwner --deployment first-squirrel-244`. Expected writes: one `super_admins` binding and its audit event. Verify `bindingStatus` and the owner's real editorial page visit. Re-run bootstrap only idempotently; stop on ambiguity or a conflicting binding.

The owner approved this exact repair with “go ahead” on 2026-10-03. Backend deployment and the owner environment setting are complete. After the owner completed a fresh Google sign-in, verification was confirmed and bootstrap succeeded; no verification stamp was fabricated. No seed/import or publishing occurred.

## Backup and recovery

- Cloud snapshot timestamp: `1790975737380039625`, including file storage.
- Local download (ignored): `tmp/wp46-admin-login/first-squirrel-before-admin.zip`.
- SHA-256: `b7d93684221f72417affe074821d7d2d9f4a510393b722d7cc2a583911c2dd5b`.
- ZIP integrity check passed (89 archive entries).
- The existing `convex-backup-before-wp46.zip` in the root was left untouched; it was not assumed to cover the live backend.
- Before execution, preserve a Convex deployment-history restore point for the current live functions/configuration and a Git marker for the approved candidate. The local checkout is newer than the live backend, so its HEAD alone is not a rollback baseline.
- If the capability must be withdrawn, use the audited `revokeSuperAdmin` command on the same deployment. Restore previous functions through the deployment-history restore point if required. Database import would need a separately reviewed plan; do not overwrite customer activity with the snapshot automatically.

## Verification

- `npm test`: passed, including 435 Convex tests and 142 auth tests.
- `npm run typecheck`: passed.
- `npm run build`: passed (local configured backend; this does not prove live access).
- Exact-target Convex deployment dry run and Convex TypeScript check: passed.
- Lint and final documentation checks: recorded in WP46 progress after completion.
- Not verified: a fresh real Google round trip with the deployed fix, owner bootstrap, or successful production editorial access. These remain execution gates.

WP46 E5/E6 remain incomplete: gaining editorial access does not enable canonical content publishing.


## Approved execution — 2026-10-03

- Deployed the unchanged merged candidate `6f8a259` to the verified live URL. The CLI confirmed schema validation, 22 additive indexes, no index deletions and successful deployment. Log: ignored `tmp/wp46-admin-login/deploy-approved.log`.
- Set `SUPER_ADMIN_BOOTSTRAP_EMAIL` on `first-squirrel-244` to the existing configured owner email, after rechecking that it matches exactly one Google account. No Google credentials changed.
- `bindingStatus` now succeeds on the live backend: configured, zero bindings. `editorial/reads:session` correctly returns signed out/no editor without identity.
- Live HTTP smoke: `/` 200; `/login` 200; anonymous `/admin/editorial` 404 with `private, no-store` and `noindex, nofollow`.
- Fresh predeployment snapshot including storage: `1791002812598807860`; ignored file `tmp/wp46-admin-login/first-squirrel-approved-predeploy.zip`; SHA-256 `6bf98562cc4e6b0ed0a4f959c45b8741bed084610cd643d5a19dea32b6c7a73f`; ZIP integrity passed.
- Local candidate marker: annotated Git tag `wp46-admin-approved-20261003`. Live predeployment configuration/module hashes saved to ignored `tmp/wp46-admin-login/predeploy-config-hashes.json`, SHA-256 `8f424677e5564bb211dfcba97714f786ac92f1d33879ad1cd1c01367964ba3f6`. This identifies prior code/configuration; it is not a standalone downloadable source rollback bundle.
- The live owner account still lacked the verified-email stamp immediately after deployment. Requested fresh Google sign-in. Binding and authenticated editorial page verification remain pending. Owner approval for the final bootstrap is already granted.


## Owner binding — 2026-10-03 04:49 UTC

- Owner reported completing fresh Google sign-in. Read-only check confirmed exactly one configured account and a recorded verified-email stamp.
- Ran the previously approved `admin/superAdmin:bootstrapOwner --deployment first-squirrel-244`: `outcome: bound`, `boundAt: 1791002965476`.
- Read-back `bindingStatus`: configured, exactly one active binding with the same timestamp. The bound user is verified and has stored auth sessions.
- Confirmed the immutable `editorial_audit` entry: `settings.changed`, `succeeded`, “Super-admin capability bound to the account configured for this deployment.” at `2026-10-03T04:49:25.476Z`.
- Backend repair and binding are complete. The owner should reload `/admin/editorial`; no further sign-in or approval is needed. A successful owner browser render has not been independently observed.
