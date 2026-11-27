# WP104 · Landing page editor

## PR 0 · Keystatic compatibility

The spike runs on `codex/wp104-keystatic-spike`, based on main at `43721c0f`. The editor mounts at `/admin/pages` throughout. Keystatic core 0.6.10 hardcodes its native path, so the repository applies a versioned patch with patch-package 8.0.1 during installation. The app uses Keystatic Next 5.0.5 and Markdoc 0.5.14. The staged JSON singleton contains the builder guide's current search metadata.

| Configuration | Observed result |
| --- | --- |
| Integrated Next dev, local storage | An operator opened the guide, saved a search title through its form, and read the saved value after a reload. The test restored the original bytes. |
| Integrated Next dev, GitHub storage | The sign-in screen, OAuth redirect and a fixture-backed content branch form rendered. Attempting a main-branch save prompted for a new branch before a commit request. |
| Integrated production build/start, GitHub storage | The same browser flow passed with a loopback Convex session and read-only GitHub fixtures. Logout returned to the editor. |
| Optimized build, local storage | A disposable app with the same patched adapter, Next 16.4.5, React 19.2.7 and Cache Components saved JSON and read the result in a fresh session at the required mount. |
| Integrated production build/start, credentials absent | The site refused operator editing and API writes. This is the required deployment behaviour when GitHub storage is unavailable. |

In the integrated tests, anonymous and member requests to the editor and write API received HTTP 404, including with the general local editorial fixture enabled. Direct requests for the native editor URL also returned 404. A scoped content security policy limits scripts in the editor. Token exchange requires a live operator grant, the browser-readable access cookie is scoped to the editor, and the API receives a separate HttpOnly copy.

The smoke harness verifies editor behaviour using synthetic identities. Live OAuth consent, actual GitHub App permissions and the owner's branch protection still need an owner-run check. On 27 November the read-only GitHub branch query reported main as unprotected, and the rules query returned an empty list. The runbook covers owner setup. No commit was sent to GitHub.

The visual harness records the nine public routes from a clean main checkout. See the visual gate notes for the fixed manifest, frozen clocks, six webinar/workshop date scenarios, Chromium version and observed colour-rounding tolerances. Historical on-sale Build-Along screenshots use sold-out inventory because the unmodified open-seat route errors during hydration.

- [Operator setup](../runbooks/landing-page-editor.md)
- [Runtime matrix](../../scripts/keystatic-smoke/README.md)
- [Visual evidence and commands](../../tests/landing-visual/README.md)

## Handoff

The owner will push the spike and run its hosted PR 0 check. Page migrations start after that check passes. The guide migration includes editable structure with a code-owned subscription boundary. Dare is included as a noindex draft. The supplied context, voice review and copy deck were read from the owner's Downloads folder. Their editorial guidance applies when the guide and AI work begin.

Local comparison of the clean candidate to main passed 44/44 full-page cases. Forty-two were pixel-identical. Only two mobile checkout control edges used the measured reference allowance. The visual harness stays outside the hosted quality job and `npm test`.

The locked install applied the versioned patch. A clean production build and server trace checks passed without editor credentials. A separate production build with synthetic GitHub settings passed the browser matrix. The production dependency audit found zero high-severity issues and one moderate Satori advisory. The guide audit passed with its existing warning for disabled upsells.

`npm test` passed locally with 7,116 passing tests and two skipped checks. Both application and Convex typechecks passed. A temporary Bash 5 installation ran the guide audit on macOS. The browser checks used synthetic sessions.

Lint passed with 45 warnings and zero errors. All 14 prompt versions matched the base lock and all 231 idea tags validated. The local PR 0 gate passed. Hosted CI and the owner's review remain pending.

## Verification against updated main

The spike was updated through main at `69baeb5d`. The main-branch CI run failed the Convex module path check on the new ingestion test's filename. Commit `b8c8c7b8` renames the test to follow the existing Convex convention and preserves all its assertions. The deployment path check and the ingestion tests pass.

The updated branch passed 7,186 tests, both typechecks, lint, the production build and artifact trace checks. The built guide passed its HTML test, and its JSON-LD was byte-identical to the file captured from pristine main. The latest visual replay passed all 44 references, with the existing rounding allowance used on two mobile checkout images. An earlier replay differed at two mobile Shipable pixels. The final replay matched them exactly with the same reference and comparison rules.

The owner-run hosted PR 0 check remains the entry gate for page migrations.

## PR 1 · Builder guide migration

The owner reported that PR 0 passed its hosted check and authorised the migration. Local branch `codex/wp104-guide-cms` starts at the verified PR 0 tip `efc98494`. The remote branch initially points to that same commit. The pristine guide reader and JSON-LD fixtures come from `43721c0f`.

### PR 1 verification

PR #348 merged the spike with a green hosted quality check. This branch starts from main at `692b7b3f`, after PR #346 changed the guide's search metadata, branding and links. The four refreshed guide screenshots, reader inputs and JSON-LD were captured from that untouched revision before the reader switch.

The guide and CLI audit use the same Keystatic Reader. The page still prerenders, and the server trace includes the guide JSON. The reader matches the original section inputs, keeps the original fragment IDs through reorder, and derives the gate's next link from the first protected section. The FAQ moves with its closing panel. The countdown and live workshop price remain outside the guide content model. Existing guide links and publication dates from main survive the migration.

The production visual gate passed at 375 and 1440 pixels in both locked and returning states. The built guide's JSON-LD matched the pre-switch script byte for byte. The full suite passed 7,194 tests, and typechecks, lint, production build, trace checks and guide audit passed. A local browser save and reload round-tripped the full singleton. The seed omits its optional empty hero label to match Keystatic's serializer.

## PR 2 · Starter migration

Local branch `codex/wp104-starter-cms` stacks on the verified builder guide migration. The Starter's two production screenshots, rendered section tree and JSON-LD were captured from main at `692b7b3f` before the Keystatic switch.

The Starter reads a JSON singleton through Keystatic and still prerenders. The trace contains the singleton. Editors can update the fixed opening and final signup copy, arrange the four middle sections and edit the five emails in sequence. Form placement, automation IDs, subscription callbacks, live idea count and offer routing come from code. Build-Along link labels contain a validated price token and render the standard USD price from live configuration.

Both final screenshots match pixel for pixel. The actual production HTML matches the published section and JSON-LD fixtures. Restoring the original adjacent text grouping resolved small raster differences in the first candidate. The editor browser test round-tripped the Starter JSON, and the full suite passed 7,196 tests. Lint, both typechecks and trace checks passed.

## PR 3 · Starter Kit migration

Local branch `codex/wp104-starter-kit-cms` stacks on the Starter. The pristine main build at `692b7b3f` supplied the two page screenshots, rendered section tree, sidebar links, JSON-LD and the 12 original prompt bodies.

The Starter Kit now reads its JSON singleton through Keystatic and still prerenders. The server trace includes the singleton. Its teaching sequence stays fixed. Editors can reorder the three resource groups while their links retain the original anchors and the sidebar follows the displayed order. Copy and clipboard content come from the editor. Booking, subscription controls and the schema graph remain code-owned.

Both screenshots matched pixel for pixel. The actual production HTML matched the published section tree, links and JSON-LD. All 12 real copy buttons passed the exact clipboard payload comparison. A local editor save and reload preserved the full singleton. The full suite passed 7,199 tests. The app and Convex typechecks, lint, production build, production dependency audit at the high threshold and trace checks passed.

## PR 4 · Shipable migration

Local branch `codex/wp104-shipable-cms` stacks on the Starter Kit. The two screenshots, rendered section tree, sticky action and JSON-LD were recorded from main at `692b7b3f` before the reader switch.

Shipable now reads its JSON singleton through Keystatic and still prerenders. The server trace contains the singleton. Editors can reorder the seven middle sections and update the fixed sections, metadata and FAQ. Ticket detail and line labels come from the editor. Amounts, schedule, timezones, seat status, form routing and historical paid confirmation come from code. The next-date page continues to show the free Starter Kit form.

Both screenshots matched pixel for pixel. The built page matched the published section tree, links and JSON-LD. Search and social metadata matched the reference. A local operator saved and reloaded the singleton in the browser and the smoke harness restored the original file. The full suite passed 7,201 tests. The app and Convex typechecks, lint, production build, production dependency audit at the high threshold, prompt version check, idea tags and trace checks passed.
