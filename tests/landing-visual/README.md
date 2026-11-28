# Landing-page visual gate

The references come from a pristine production build at `43721c0fb8a7bfd827a1a4ca80cf12ae82537ba0`, the 27 November 2026 tip of main before CMS integration. They cover the nine landing pages in the migration. Each image includes the full document at 375 or 1440 CSS pixels wide, 900 pixels of viewport height, and device scale factor 1.

## Compare a change

Use a clean worktree without local deployment environment files. Install locked dependencies with Node 22, run `npm run build`, then `npm run test:visual`. The command starts and stops its own production servers on loopback. It honours `CHROME_PATH` or uses the installed Google Chrome stable executable. A single-page check accepts `npm run test:visual -- --route=/guides/5-to-9-builder`.

Checks compare decoded RGBA pixels. Every pixel must match exactly except for the measured mobile antialias variation below. On a difference, the candidate PNG is written to `tmp/landing-visual/`. Software rasterisation keeps glyph colours reproducible. The reference captures used Chrome 158.0.8127.37 on arm64 macOS 26.6.2. A different browser, font rasteriser, or OS can produce pixel differences. This suite runs separately from CI's standard tests.

The masks in `antialias/` mark the precise pixels that alternated in repeated renders of main at the curved edges of mobile controls. At 375px, the ended state has 36 such pixels (maximum channel difference 3/255), pre-sale has 51 (2/255), and the sold-out states have 35 (5/255). Those pixels fall between rows 33 and 53. The returning mobile guide also has 83 variable pixels in the top controls (rows 84–127, maximum 2/255). No difference is permitted elsewhere. A pass that uses this exception prints the affected image name.

## Capture inputs

- The clean source tree fixes the idea text, media, and manifest. The script checks the manifest blob ID. Its loopback Convex query fixture supplies an empty editorial overlay, legacy image visibility and a closed build CTA. Browser requests to external origins, APIs, and route prefetches are blocked. The browser starts each capture with analytics declined.
- The guide is captured with and without the existing subscription flag. Each capture checks that the guide selected the intended gate state.
- The test freezes the Node and browser Date clocks and sets the browser timezone to Europe/London. It requests reduced motion before loading the page, disables animations and transitions, and waits for local fonts and images.
- The live references cover 30 October pre-sale, 31 October during the webinar, 2 November during the replay and early-bird sale, 10 November during standard pricing, 14 November during the paid workshop and 27 November after both events. Times are UTC. On-sale and workshop-live captures use 20 seats sold. Other phases use two sold.
- The historical available-ticket checkout on main renders the error boundary when its active ticket button requests Convex auth context. The checkout route inherits the root public provider. Its available-ticket view therefore has no successful pre-migration reference. The sold-out view exercises those clocks. This gate does not submit checkout or registration forms.
- On the clean self-hosted production build, Next's internal image-optimiser request for idea art lacks a Host header, which the existing middleware rejects. The public deployment returned a WebP for the same image request. For these local `/image/og/idea/*.png` optimiser requests only, Puppeteer supplies the WebP generated from the checkout's actual PNG by the locked Next image transform, using the requested width and quality. For the freelancer tax filing bot art at width 1080 and quality 75, the harness and the public deployment returned byte-identical 73,326-byte WebP files (SHA-256 `9da2d85311c8de3574bf941d33fe23796bc66c3c64947e8aa9d3d2ace2f01336`). Every requested image must decode. This tests layout and artwork; HTTP delivery of those images is a separate check.

## Verification on 27 November 2026

A second run against the clean main build matched all 44 references. The clean CMS candidate at `446a3590` also passed all 44. It matched 42 exactly. Only the mobile pre-sale and standard-price checkout navs exercised the measured rounding allowance. Both guide gate states matched exactly at both widths.

## Baseline provenance

To replay reference generation, build the recorded main revision in a separate clean worktree. From the spike worktree set `LANDING_VISUAL_APP` to that checkout and run `npm run test:visual -- --record`. The script requires the exact reference commit and a clean source tree for recording. The normal comparison command only reads reference images.

## Builder guide reference after the SEO release

The four Builder guide images in `guide-baseline/` come from a clean production build of main at `692b7b3f`. That revision includes the metadata and link changes from PR #346 and still renders the guide from its TypeScript deck. To replay this capture, set `LANDING_VISUAL_APP` to a clean build at that commit and run `npm run test:visual -- --record --route=/guides/5-to-9-builder`. The original nine-route capture remains in `baseline/`.

## Starter reference after the SEO release

The two Starter images in `starter-baseline/` come from a clean production build of main at `692b7b3f`. That revision includes PR #346 and renders the Starter from its inline sections. To replay the capture, point `LANDING_VISUAL_APP` at a clean build at that commit and run `npm run test:visual -- --record --route=/5-to-9-starter`.
