# Super-admin binding — operator runbook (WP46-E4a)

The editorial workspace opens for exactly one account: the one bound to the `super_admin` capability (owner ruling 2026-08-06). The binding is made from deployment configuration and stored against that account's Convex Auth user ID. Authorization never compares emails and never trusts anything the browser sends.

Nothing in this runbook has been run against production. Binding production is an auth-sensitive change: it needs the owner's explicit go-ahead for that deployment, a restore point and a dry run, as in `docs/wp/backup-restore.md`.

## Before you start

- The owner has signed in to the target deployment at least once with the account to be bound, using an **email sign-in link**. Only email-link sign-in records a verified email on this site: the Google sign-in does not keep Google's verified-email flag, so a Google-only account is refused with `no_verified_account`. An account cannot add the other method later (accounts are never linked across providers), so create the owner account with the email link. Making Google accounts bindable means mapping that flag in the shared sign-in code, which is an owner decision (WP46-E4f review).
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
| `refused` / `no_verified_account` | No verified, signed-in account uses that email yet (or it is a Google-only account). Sign in once with the email link, then retry. |
| `refused` / `ambiguous_account` | More than one account matches. Investigate before binding anything. |
| `refused` / `another_account_bound` | Someone else holds it. Revoke first (below). |

Every result, including refusals, is written to the editorial activity log.

After binding, the setting is no longer read at request time; keep it or remove it (`npx convex env remove SUPER_ADMIN_BOOTSTRAP_EMAIL`). Changing the account's email later does not move or end the binding.

## Check

```bash
npx convex run admin/superAdmin:bindingStatus
```

Returns `{ configured, activeBindings, boundAt }` and no personal details. An `INVARIANT` error means more than ten active bindings exist, which bootstrap never creates; investigate before changing anything.

## Revoke

```bash
npx convex run admin/superAdmin:revokeSuperAdmin '{"reason":"<why>"}'
```

Every active binding ends at once, and the workspace closes for the account at its next request. The rows stay as history. Binding again is a fresh `bootstrapOwner` run.

## Using the workspace

- Sign in at `/login?returnTo=/admin/editorial` with the bound account. Anyone else, and a signed-out visitor, gets the site's ordinary 404.
- Publishing, retrying, rolling back, unpublishing and moving to Trash ask for a sign-in from the last 10 minutes. "Confirm it's you" starts a fresh sign-in with the account's own method: for the bound email-link account, a link to its own address that comes back to the same idea page (the link carries the page path only, not revision ids). The Google path is built and tested for the day Google accounts become bindable.
- Until WP46-E5 connects WP45's checks and WP46-E6 the release worker, the workspace says so: checks cannot run, nothing can be approved (whatever checks a submission carried), and every release action is refused. Nothing in it changes the public site.

## What this does not do

- It creates no roles beyond `super_admin`, no staff accounts and no impersonation, and gives no access to customers' private data.
- It does not deploy, seed or import anything. Publishing stays unavailable until the release worker (WP46-E6) exists.
