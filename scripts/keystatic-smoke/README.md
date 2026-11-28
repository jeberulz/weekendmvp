# Landing editor compatibility gate

Run the commands below from an isolated checkout of the spike with Node 22, the locked dependencies and Chrome or Chromium. Set `CHROME_PATH` if the browser is installed elsewhere. The checkout must have no Next environment files. The test creates random credentials recognized only by its loopback session fixture.

```sh
node scripts/keystatic-smoke/run.mjs dev-local
node scripts/keystatic-smoke/run.mjs dev-github
node scripts/keystatic-smoke/run.mjs build
node scripts/keystatic-smoke/run.mjs prod-github
node scripts/keystatic-smoke/run.mjs prod-disabled
```

Run each process to completion. The gate starts Next on port 44074 and a test Convex session endpoint on 44075. The two production starts use the same build. The disabled case removes the server credentials.

The local case edits the guide's search title through Chrome, checks the file, reloads the editor and restores the original JSON bytes. Use an idle checkout during this save. The GitHub cases inspect the sign-in link and OAuth redirect, then read the same singleton on a simulated `content/smoke` branch. A save attempted on `main` must open the branch dialog before any GitHub mutation. Browser interception supplies the read-only GitHub API and raw file responses. A real OAuth exchange, branch protection and GitHub repository permissions need an installed App and owner verification.

For a local round-trip of the Starter singleton, run `node scripts/keystatic-smoke/run.mjs dev-local starter-5-to-9` in a disposable checkout.
