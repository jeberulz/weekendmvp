# Super-admin binding — operator runbook (WP46-E4a)

The editorial workspace opens for exactly one account: the one bound to the `super_admin` capability (owner ruling 2026-08-06). The binding is made from deployment configuration and stored against that account's Convex Auth user ID. Authorization never compares emails and never trusts anything the browser sends.

Nothing in this runbook has been run against production. Binding production is an auth-sensitive change: it needs the owner's explicit go-ahead for that deployment, a restore point and a dry run, as in `docs/wp/backup-restore.md`.

## Before you start

- The owner has signed in to the target deployment at least once with the account to be bound (Google or email link). The account's email must be verified; Convex Auth records that on sign-in.
- You have deployment credentials for that deployment (the Convex CLI is logged in, or `CONVEX_DEPLOY_KEY` is set). Never paste the key into chat, docs or commits.

## Bind

```bash
npx convex env set SUPER_ADMIN_BOOTSTRAP_EMAIL "<owner email>"
```

```bash
npx convex run admin/superAdmin:bootstrapOwner
```

Possible results (none of them echo the email):

| Result | Meaning |
|---|---|
| `{ outcome: "bound", boundAt }` | The capability is bound to that account. |
| `{ outcome: "already_bound", boundAt }` | Nothing changed; it was already bound. |
| `refused` / `not_configured` | The setting is missing or not an email. |
| `refused` / `no_verified_account` | No verified, signed-in account uses that email yet. Sign in once, then retry. |
| `refused` / `ambiguous_account` | More than one account matches. Investigate before binding anything. |
| `refused` / `another_account_bound` | Someone else holds it. Revoke first (below). |

Every result, including refusals, is written to the editorial activity log.

After binding, the setting is no longer read at request time; keep it or remove it (`npx convex env remove SUPER_ADMIN_BOOTSTRAP_EMAIL`). Changing the account's email later does not move or end the binding.

## Check

```bash
npx convex run admin/superAdmin:bindingStatus
```

Returns `{ configured, activeBindings, boundAt }` and no personal details.

## Revoke

```bash
npx convex run admin/superAdmin:revokeSuperAdmin '{"reason":"<why>"}'
```

Every active binding ends at once, and the workspace closes for the account at its next request. The rows stay as history. Binding again is a fresh `bootstrapOwner` run.

## What this does not do

- It creates no roles beyond `super_admin`, no staff accounts and no impersonation, and gives no access to customers' private data.
- It does not deploy, seed or import anything. Publishing stays unavailable until the release worker (WP46-E6) exists.
