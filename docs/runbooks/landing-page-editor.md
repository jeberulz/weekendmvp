# Landing page editor

Open `/admin/pages` after signing in as the bound Weekend MVP super-admin. The dashboard, singleton form and branch views all live under this address. The 5-to-9 Builder guide reads its published copy from the guide singleton at build time.

## Local editing

Use the project's usual authenticated Next development setup with a local Convex deployment and its bound operator. With all four Keystatic settings empty, saving updates `content/landing-pages/guide-5-to-9-builder/index.json`. Local tree enumeration starts inside `content/landing-pages`. Each page will have one JSON singleton. The editorial demo has no filesystem access.

For GitHub-mode development, start at the loopback address `http://127.0.0.1:<port>` and sign in there. The site session cookie belongs to that host. Keystatic changes localhost to 127.0.0.1 during GitHub login.

## Editing the builder guide

Keep the opening section in its own group. In **After the email gate**, drag sections into reading order and keep exactly one of each type. Public anchor IDs from the original guide stay with their sections. The FAQ moves together with the closing panel. Steps retain their worked examples when renamed or moved. Skills, roles, weeks and FAQ rows each keep their wording together. The saved checklist uses the same 18 item numbers as before the migration.

Keep `{ideaCount}` in the library summaries and a FAQ answer, `{price}` in each Build-Along promise, and the founder note's two offer tokens. The reader resolves `{section:ideaBank}` and similar references to the current section number. The offer switch, checkout link, current price, subscription integration, and public gate boundary come from code.

Run `npm run audit:guide -- --slug=5-to-9-builder` to validate the same content used by the site.

## Editing the 5-to-9 Starter

Open **5-to-9 Starter** to edit the opening, four middle sections and final signup copy. The opening and final signup have fixed placements. Keep one of each middle section and keep the Day 1–5 copy aligned with the existing email sequence. Use the `{buildAlongPrice}` token in the Build-Along link labels. The live price, idea count, checkout link and both Beehiiv form destinations come from code.

## Editing the Starter Kit

Select **Starter Kit** to edit the opening, rules, build steps, resources and closing actions. The first three steps remain in teaching order. In **Resources**, drag the ideas, prompts and templates into reading order and keep one of each. The sidebar follows that order. Existing URLs with fragment identifiers still find their sections.

Keep `{count}` in the idea and prompt headings and contents labels. The displayed count comes from the corresponding list. Prompt bodies go straight to the clipboard, so preserve intended line breaks and placeholders. Signup automation and the booking destination come from code.

## GitHub setup for the owner

1. Protect `main` on GitHub. Require a pull request and passing CI. Apply the rule to the owner and GitHub App, including administrator bypass settings. Keystatic opens the repository default branch. Saving there prompts for a content branch before sending a commit. GitHub enforces branch protection independently for every client.
2. Create an owner-only GitHub App and install it solely on `jeberulz/weekendmvp`. The shipped adapter's app manifest requests repository Contents read/write, Metadata read, and Pull requests read. Enable expiring user tokens. Disable webhooks if creating the app by hand. Use the deployed site's `/admin/pages` URL as the homepage and its `/api/keystatic/github/oauth/callback` URL as the callback. Add `http://127.0.0.1/api/keystatic/github/oauth/callback` for loopback development.
3. Set the app's client ID, client secret, and a random encryption secret of at least 32 characters in the three server-only `KEYSTATIC_*` variables in `.env.example`. Set the public app slug in `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` at build time. Store real values in the host's secret settings. An incomplete set disables the editor. An unconfigured production installation also refuses access.
4. Sign in to Weekend MVP and open `/admin/pages`. Complete Keystatic's GitHub sign-in. Create or select a `content/` branch before editing, and verify the branch name before saving. Open the pull request on GitHub, review the actual JSON change and CI, then merge as the repository owner. The editor never requires a Vercel preview. The owner can disable previews for `content/*` if desired.

In GitHub mode a visitor can start OAuth and reach its callback. Exchanging an authorization code, refreshing a token and accessing repository data require a live operator session. The browser can read the GitHub access cookie at the editor path. The API receives a separate HttpOnly cookie for logout and refresh. JSON files and browser configuration contain no provider secrets.

[Keystatic GitHub mode](https://keystatic.com/docs/github-mode) · [Next.js adapter installation](https://keystatic.com/docs/installation-next-js)


## Adapter maintenance

Keystatic core 0.6.10 hardcodes its browser mount. The versioned patch in `patches/` changes its router prefix, internal links, branch navigation and app homepage to `/admin/pages`. It also checks the configured branch prefix before a GitHub save or deletion. The API wrapper maps upstream OAuth return locations to the same prefix. API requests still use `/api/keystatic`. A normal `npm ci` applies the patch. Review it and rerun the browser gate when upgrading Keystatic.
