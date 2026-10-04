# Super-admin binding — operator runbook (WP46-E4a)

The editorial workspace opens for exactly one account: the one bound to the `super_admin` capability (owner ruling 2026-08-06). The binding is made from deployment configuration and stored against that account's Convex Auth user ID. Authorization never compares emails and never trusts anything the browser sends.

Nothing in this runbook has been run against production. Binding production is an auth-sensitive change: it needs the owner's explicit go-ahead for that deployment, a restore point and a dry run, as in `docs/wp/backup-restore.md`.

## Before you start

- **Resolve the live backend first.** Confirm the `NEXT_PUBLIC_CONVEX_URL` embedded in the deployed frontend, then use that exact deployment name for every status, environment, export and bootstrap command. `--prod` chooses the configured project's default production deployment; it does not prove that the live frontend uses it. On 2026-10-02 the live frontend used `first-squirrel-244.eu-west-1.convex.cloud`, while this checkout's `--prod` commands reached a different backend. See [the PR #93 deployment review](../../reviews/2026-10-02-pr93-admin-login.md).
- Before binding, confirm `admin/superAdmin:bindingStatus` and `editorial/reads:session` exist on the live backend. A missing function means the backend rollout is incomplete. A local `npm run build` does not deploy Convex. The E7h Vercel production build command deploys the verified live backend first with a deployment-scoped key, then builds Next; verify both the target and function spec after its first production run. For a separate manual backend rollout, use target-specific credentials, first with `--dry-run`, and verify the printed destination. Do not work around a missing backend API by loosening the middleware gate.

- The owner has signed in to the target deployment at least once with the account to be bound: with Google, or with an email sign-in link. Both record a verified email: email-link sign-in proves the inbox, and Google sign-in keeps Google's own verified-email claim (since the WP46 Google follow-up; a Google address Google has not verified stays unverified and cannot be bound). A Google account created before that change records the flag at its next sign-in, so sign out and sign in with Google once after the change is deployed. Accounts are never linked across providers, so use the method the account was created with.
- You have deployment credentials for that deployment (the Convex CLI is logged in, or `CONVEX_DEPLOY_KEY` is set). Never paste the key into chat, docs or commits.

## Bind

```bash
npx convex env set SUPER_ADMIN_BOOTSTRAP_EMAIL "<owner email>" --deployment <verified-live-deployment>
```

```bash
npx convex run admin/superAdmin:bootstrapOwner --deployment <verified-live-deployment>
```

Possible results (none of them echo the email):

| Result | Meaning |
|---|---|
| `{ outcome: "bound", boundAt }` | The capability is bound to that account. |
| `{ outcome: "already_bound", boundAt }` | Nothing changed; it was already bound. |
| `refused` / `not_configured` | The setting is missing or not an email. |
| `refused` / `no_verified_account` | No signed-in account with a verified email uses that address yet. Sign in once (Google, or the email link), then retry; a Google account created earlier must sign in again first. |
| `refused` / `ambiguous_account` | More than one account matches. Investigate before binding anything. |
| `refused` / `another_account_bound` | Someone else holds it. Revoke first (below). |

Every result, including refusals, is written to the editorial activity log.

After binding, the setting is no longer read at request time; keep it or remove it (`npx convex env remove SUPER_ADMIN_BOOTSTRAP_EMAIL`). Changing the account's email later does not move or end the binding.

## Check

```bash
npx convex run admin/superAdmin:bindingStatus --deployment <verified-live-deployment>
```

Returns `{ configured, activeBindings, boundAt }` and no personal details. An `INVARIANT` error means more than ten active bindings exist, which bootstrap never creates; investigate before changing anything.

## Revoke

```bash
npx convex run admin/superAdmin:revokeSuperAdmin '{"reason":"<why>"}' --deployment <verified-live-deployment>
```

Every active binding ends at once, and the workspace closes for the account at its next request. The rows stay as history. Binding again is a fresh `bootstrapOwner` run.

## Using the workspace

- Sign in at `/login?returnTo=/admin/editorial` with the bound account. Anyone else, and a signed-out visitor, gets the site's ordinary 404.
- Publishing, retrying, rolling back, unpublishing and moving to Trash ask for a sign-in from the last 10 minutes. "Confirm it's you" starts a fresh sign-in with the account's own method (Google, or an email link to its own address; the link carries the page path only) and comes back to the same page. With Google the round trip may complete silently while the browser is still signed in to Google.
- Until WP46-E5 connects WP45's checks and WP46-E6 the release worker, the workspace says so: checks cannot run, nothing can be approved (whatever checks a submission carried), and every release action is refused. Nothing in it changes the public site.

## Existing live ideas

The editorial lists read private `editorial_ideas` records. Deploying E4 and binding the owner do not populate them. Existing public ideas need the separate WP46-E5a legacy import; its first step is a read-only inventory:

```bash
node scripts/editorial-import-legacy.mjs
```

The command prints the number of source pages, validation refusals and a SHA-256 inventory digest. It never writes without `--apply`. Before importing, compare the checked-in manifest and MDX against the live frontend, confirm the target deployment and current private editorial count, take and verify a fresh target-specific Convex backup including file storage, and obtain owner approval for that exact digest and row count. The apply command requires the digest, backup path, target name, deployment URL and admin key. Keep the key in the environment, not in command arguments or logs:

```bash
EDITORIAL_IMPORT_CONVEX_URL=https://<verified-target>.convex.cloud \
EDITORIAL_IMPORT_ADMIN_KEY=<deployment-admin-key> \
node scripts/editorial-import-legacy.mjs --apply \
  --target=<verified-target> \
  --confirm-inventory=<approved-digest> \
  --backup=<verified-target-backup.zip>
```

The importer calls the internal service mutation for each validated page, preserves the existing public release as a legacy baseline, and uses stable submission IDs so a retry skips already imported pages. It stops on a rejection or slug conflict. The existing public pages stay unchanged; edits become private revisions. Approval and publishing still require the later check runner and release worker.

## What this does not do

- It creates no roles beyond `super_admin`, no staff accounts and no impersonation, and gives no access to customers' private data.
- It does not deploy, seed or import anything. Publishing stays unavailable until the release worker (WP46-E6) exists.
