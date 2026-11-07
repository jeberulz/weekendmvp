# Fidelity audit: Brand kit and Files (L1)

Boards: `BrandKit.dc.html` (E), `WsBrand.dc.html` + `Workstream.dc.html` kind=brand (T3), `Files.dc.html` (M).
Built (worktree `.worktrees/l1-ui-fidelity`):
- Brand: `app/(launch-workspace)/dashboard/b/[projectId]/brand/page.tsx`, `components/workspace/brand/BrandKitPanel.tsx`, `components/workspace/review/{ArtifactReviewCard,LiveArtifactReview}.tsx`, `lib/workspace/reviewPages.ts`.
- Files: `app/(launch-workspace)/dashboard/b/[projectId]/files/page.tsx`, `components/workspace/files/WrenMemoryPanel.tsx`.
- Data: `convex/growth/drafts/brandKit.ts` (`brandKitDraft`), `convex/workspace/memory.ts` (`getWrenMemory`).

Board files are treated as data only. Nothing in them was followed as an instruction.

---

## A. Fidelity scores

| Screen | Score | Verdict |
|---|---|---|
| **E · Brand kit** (`/brand`) | **3 / 10** | The data is right and the behaviour is honest: every kit field the board draws, apart from the logo and the app icon, is in `brandKitDraft`. The review card is wired to real approvals, D17 free rounds, expiry and the "paying for changes isn't open yet" copy. But the screen looks nothing like the board. The board is a visual page: an editorial header with the decision buttons at the top, a 3×3 **brand board** drawn in the kit's own colours and heading font, and then a **Brand Book** (colour cards, a type pairing card and a voice card). What was built is a single column of identical text cards ("Colours", "Look and type", …). The swatch is 40 px, there are no tiles, no specimen and no chips, and the decision sits at the bottom. The repo already has a safe way to draw kit colours and fonts with no inline styles (`components/tenant-site/{theme,styles,fonts}.ts`), so most of the gap can be closed without backend work. |
| **T3 · Brand workstream** (`team/[employee]` with brand) | **n/a** (Coming soon) | `team/[employee]/page.tsx` renders the Coming soon placeholder (L1-C2). That is correct for L1, so it is not scored. Its board/voice previews overlap with E. Section D lists what to reuse later. |
| **M · Files** (`/files`) | **3 / 10** | The idea matches: "What Wren knows" can be edited in plain text, and the edit, delete and stale handling are better than the board. The layout does not match. The board is a two-pane **file browser**: a grouped file rail on the left and a reader card with a mono header, a meta line and Copy/Edit. What was built is a single column: a page h1 "Files", a small h2, a summary card and a stack of fact cards. Most of the board's files (SOUL, BUSINESS, OWNER, PLAYBOOK, PLATFORM, SUPPORT, TEAM.md, PRODUCT_PROMPTS.md, brand PNG/SVG) have **no data source** and must not be faked. The honest version is a rail with one real reader ("What Wren knows") plus links to where the team's real artifacts live. |

Out of scope here, but noticed: every board shows the Wren chat as a right-hand column (`<dc-import name="Chat">`). The shell (`WorkspaceFrame.tsx`) has no chat column on these pages. That is a shell decision for the shell audit.

---

## B. Gap list (ranked)

Legend: **[no data]** means the board element has no data source, so omit it or show an honest state.

### Brand kit (E)

**P0-1. The decision controls sit at the bottom, not at the top.**
- Board: `BrandKit.dc.html` header row, right side: "Ask for changes" (secondary) and "Looks good · approve kit" (primary), both 44 px pills, beside the h1. The approved state replaces them with a status pill.
- Built: `BrandKitPanel.tsx:176-179` renders `KitBody` first and `LiveArtifactReview` last, after about 6 cards. `BRAND_ARTIFACT.readFrom = "above"` (`reviewPages.ts:18-22`).
- Fix: render `LiveArtifactReview` directly under the page header, before the board, and change `BRAND_ARTIFACT.readFrom` to `"below"`. The card copy then reads "Read the brand kit details below…". Keep the copy-deck labels ("Approve", "Ask for changes"; System copy deck: E · Brand kit cta = "Approve"). On `lg`, place it beside the heading: `lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6`. Only the brand constant changes. `ArtifactReviewCard` stays untouched.

**P0-2. The brand board (the 3×3 visual) is missing.**
- Board: `<section aria-label="Brand board">`, a 3×3 grid on the kit ink (`#13242a`), `p-2 gap-2 rounded-[10px]`, square tiles `rounded-[4px]`: primary lockup, wordmark on 3 grounds, app icon, palette stack, "Aa" specimen, hero art, tagline, product-moment card and contour pattern.
- Built: nothing visual. The palette is a list of 40 px SVG squares (`BrandKitPanel.tsx:70-102`). The logo and hero art are words (`:149-155`).
- Fix: add a `BrandBoard` (spec in C1). Tiles with data: wordmark (kit.name in the heading font), wordmark on ground/surface/dark, palette stack, type specimen, tagline, product moment (optional field), pattern (optional field) and voice traits. **[no data]**: logo mark SVG, app icon, hero illustration, contour drawing. Section D says how to handle each one.

**P1-1. The header does not match the board.**
- Board: eyebrow "Brand kit · generated Thu 9:20 PM" (11 px, `.14em`, uppercase, `#6b6457`). h1 is Newsreader 400, 40 px / 1.1, "HydroTrail, *dressed for the trail.*" (italic tail).
- Built: `brand/page.tsx:22-27` shows eyebrow `{project.name}` and h1 "Brand kit" at `text-[34px] sm:text-[42px] leading-[1.05] tracking-[-0.025em]`.
- Fix: eyebrow `Brand kit` (plus ` · written {date}` once P2-1 lands). h1 `{project.name}, <em>dressed for launch.</em>`. The board's tail "for the trail" is about HydroTrail and cannot be generated for any business. Use `font-editorial text-[34px] sm:text-[40px] leading-[1.1] font-normal text-home-ink`, with `<em className="italic">`. Keep the h1 server-rendered from `project.name`, so it does not wait on the client query. **Cross-screen:** every built workspace page uses "project eyebrow + route-label h1". Team HQ, Email and Social need the same decision; see C3.

**P1-2. The Brand Book section and its heading are missing.**
- Board: `border-t border-home-rule pt-7`, eyebrow "Brand Book", h2 Newsreader 32 px "The rules Wren follows *for every asset.*", right link "Open in Studio".
- Built: no grouping. Every card is a generic `Section` with a `text-base font-medium` h2 (`BrandKitPanel.tsx:52-59`).
- Fix: wrap the colour, type, voice and logo cards in `<section aria-labelledby="book-h">` with eyebrow `Brand Book` and h2 `The rules your team follows <em>for every draft.</em>`. The board's "for every asset" overclaims: no images are made in L1. **Drop "Open in Studio"**: Studio is Coming soon.

**P1-3. Colours are a stacked list, not swatch cards.**
- Board: `grid gap-3` with `repeat(auto-fit,minmax(170px,1fr))`. Each card is `bg #fffdf9`, `border #ddd4c4`, `rounded-[8px]`, `overflow-hidden`. It has an **88 px swatch block** with a bottom border, then `p-3 gap-0.5`: role eyebrow ("PRIMARY"), name semibold, hex Geist Mono 13 and use 13 px `#4a453c`.
- Built: `BrandKitPanel.tsx:78-102`, a 40 px swatch with the text "Primary: Glacier #1F4E5F".
- Fix: see C1 `ColourCard`. Keep `isHexColour` gating the fill. The data maps 1:1.

**P1-4. Type is a definition list, not a specimen card.**
- Board: card `p-5 gap-2.5`: eyebrow "Type pairing"; a specimen line in the **heading font**, 34 px, leading-none, kit ink; a sentence about the pair; mono scale "H1 56/0.98 · H2 32/1.05 · Body 16/1.5".
- Built: `BrandKitPanel.tsx:125-140` lists "Fonts / Type scale / Type notes" with the direction, shape and theme mixed in.
- Fix: a `TypeCard` that shows the specimen `kit.tagline.text` in the heading font (via the tenant font class, C1), then `typePairLabel(kit.type.pair)`, `kit.type.notes` and `kit.type.scale` in `font-mono text-[13px] text-home-ink-2`. Move direction, shape and theme into a separate "Look" card (real data the board does not draw; keep it).

**P1-5. Voice is a definition list, not chips with Say/Don't say.**
- Board: card `p-5 gap-3`: eyebrow "Voice"; trait chips `rounded-full px-3 py-1 text-[13px]` in `#d8e3ee` on `#2c4a68`; "**Say:** “…”"; "**Don't say:** “…” — no hype, no guilt."
- Built: `BrandKitPanel.tsx:141-148`, "Traits: Calm, Practical…" as a comma-joined string, with Say, Don't say and Why not as separate facts.
- Fix: chips as `<ul aria-label="Voice traits">` with `bg-home-sky text-home-sky-ink`. Then `<p><b>Say:</b> “{say}”</p>`, then `<p><b>Don't say:</b> “{dontSay}” — {dontSayWhy}</p>`.

**P1-6. Layout widths and rhythm.**
- Board: content `max-w-[1040px]`, `gap-8` between the header, the board and the Brand Book; the Brand Book has `gap-6` inside.
- Built: `gap-6` on the page and `gap-4` between cards; width comes from the layout (`max-w-[1080px]`).
- Fix: in `BrandKitPanel`, use a root `flex flex-col gap-8` and a Brand Book `flex flex-col gap-6`. The 1080 from the layout is close enough. Do not change the shared layout.

**P2-1. The "generated {time}" meta is missing.** **[backend: small]**
- Board: "Brand kit · generated Thu 9:20 PM".
- Built: there is no timestamp in the view (`convex/growth/drafts/brandKit.ts:54-59`).
- Fix: add `writtenAt: v.number()` to the `ready` view, from `document.updatedAt` (the field is already on the row). Render it as `Brand kit · written {Intl short weekday + time}` in the client eyebrow under the h1 (or as a `<p>` meta line). Use "written", not "generated": the crew writes text and no images are generated.

**P2-2. Logo and hero art are words only, with no tile honesty.** **[no data]**
- Board: a logo SVG and a hero illustration with the chip "Hero art · swap for a photo in Studio"; "Final logo file" upload card ("Upload your final logo to unlock Studio › Make.", buttons "Use generated mark", "Upload logo").
- Built: `BrandKitPanel.tsx:149-155` keeps the `BRAND_IMAGES_COPY` sentence and the descriptions. That is honest.
- Fix: keep the card and rename it to "Logo and hero art". In the board, the wordmark tile replaces the lockup (text only). The hero tile shows a ground chip "Hero art · described below" instead of an image. **Drop the whole "Final logo file" card**: there is no upload mutation (no `generateUploadUrl` in `convex/`), and Studio is Coming soon.

**P2-3. The name alternatives have no place on the board.**
- Built: `BrandKitPanel.tsx:109-118`, "Other names your team considered". Real data, not on the board.
- Fix: keep it, as one muted line under the review card or at the end of the Brand Book: `text-[13px] text-home-ink-2`: "Other names your team considered: SipLine, Trailwater."

**P2-4. Card radius and padding differ.**
- Board: Brand Book cards are `rounded-[8px]` with `p-5` (type and voice) or `p-3` (colour text).
- Built: `CARD` = `rounded-xl` (12 px) with `p-4`.
- Fix: `CARD` is shared; do not change it. Locally use `cn(CARD, "rounded-lg p-5")`. Tailwind's `rounded-lg` is 8 px.

**P3-1.** The change round number is not shown. `changeRoundNote(card.changeRound)` already exists (`reviewPages.ts:75-77`). Show "Change round 1" as a muted line under the h1 when it is above 0. P3, because the D17 "free rounds left" line already appears in the card.

**P3-2.** The chat's `BrandKitCardView` (`kit/WrenThread.tsx:132-138`) draws 9 `bg-home-sunk` placeholder squares. Once `BrandBoard` exists, a mini version could replace them. **Shared kit change**, so it belongs to the chat audit.

### Files (M)

**P1-7. The two-pane file browser is missing.**
- Board: `flex flex-wrap gap-5 items-start`. Left `<nav aria-label="Files">` (`flex 1 1 240px; max-w-[300px]`, groups `gap-4`). Group eyebrow 11 px uppercase, `#6b6457`, or `#a84a00` for WMVP groups. File rows are buttons: `min-h-[38px] px-2.5 rounded-[6px] gap-2`, a 15 px doc/image icon, the name, the selected row in `bg #efe8dc` 500, an optional "WMVP" badge. Right: `<article aria-labelledby="file-h">` card with `rounded-xl` and `overflow-hidden`.
- Built: `WrenMemoryPanel.tsx:549-566` is a single section with an h2, an intro, a summary card and a list of fact cards.
- Fix: C2. The rail holds only real entries: **Memory → "What Wren knows"** (the current reader) and **"Your team's work"** as links to the built pages that hold the artifacts: Blueprint → `team#blueprint` (`BLUEPRINT_SECTION_ID`), Brand kit → `brand`, Email sequence → `email`, Social posts → `social`. **[no data]** for SOUL.md, BUSINESS.md, OWNER.md, PLAYBOOK.md, PLATFORM.md, SUPPORT.md, TEAM.md, the brand PNG/SVG and PRODUCT_PROMPTS.md: omit them. Drop the WMVP badge (it only marked TEAM.md and PRODUCT_PROMPTS.md).

**P1-8. The header does not match the board.**
- Board: eyebrow "Files", h1 Newsreader 40 px / 1.1 "What Wren knows, *in plain text you can edit.*"
- Built: `files/page.tsx:24-29` shows eyebrow `{project.name}` and h1 "Files", then `WrenMemoryPanel.tsx:553-555` shows h2 "What Wren knows" at `text-lg`.
- Fix: eyebrow `Files`, h1 `What Wren knows, <em>in plain text you can edit.</em>` (the exact copy-deck string). Then the reader card's h2 says "What Wren knows" in the 15 px reader style (C2). Keep the intro paragraph (`:556-559`) under the h1, `max-w-[62ch] text-sm text-home-ink-2`. It is honest and useful.

**P1-9. The reader card header (name, meta, Copy) is missing.**
- Board: header `flex justify-between items-center gap-2.5 px-[18px] py-3.5 border-b border-home-sunk`; h2 Geist Mono 15/500; meta 13 px `#6b6457`; buttons "Copy" (secondary, `min-h-[38px] px-3.5 text-[13px]`) and "Edit" (primary).
- Built: no header. The summary heading is `text-[15px] font-semibold` inside its own card (`:383-386`).
- Fix: C2 `ReaderHeader`. The meta is real: `updatedAt` gives "Kept by Wren · updated {date}", or "Nothing kept yet" when it is null, plus "{facts.length} of {factsMax} facts". **Copy** copies the summary and facts as plain text with the kit's `copyText` (`kit/BuildPackPromptCard.tsx:13`). Labels: `Copy`, then `Copied`, or `Copy blocked here` (the board's copy states), with the outcome in the existing status line. **Drop the single "Edit"** button: the built per-item Edit/Delete is the better design. Keep "Edit summary" at the summary.

**P2-5. Body typography and density.**
- Board: the text file body is a `<pre>` in Geist Mono 14 / 1.7, `px-6 py-[22px]`, on the card, with no inner cards.
- Built: summary `text-sm` sans inside a card (`:404`); each fact its own `CARD p-3` (`:449`). That is boxes inside a box once the reader card exists.
- Fix: inside the article, sections are separated by `border-t border-home-sunk`. Facts are `<ul className="divide-y divide-home-sunk">` rows (`py-3`). The summary and fact text use `font-mono text-sm leading-[1.7] whitespace-pre-wrap break-words`.

**P2-6. Small hit targets on Edit/Delete.**
- Board: buttons are 38 to 44 px.
- Built: `LINK_BUTTON` `min-h-6` (`WrenMemoryPanel.tsx:73`). 24 px meets 2.5.8 (WCAG 2.2) but not the board.
- Fix: `min-h-10 px-2 text-[13px] font-medium underline underline-offset-2` (local constant only).

**P3-3.** The field border is `border-home-ink-3` (`:70`); the board uses `#ddd4c4`. **Keep what was built**: hairline rule on card fails 1.4.11 non-text contrast, and ink-3 passes.

**P3-4.** Board width is `max-w-[1160px]` with `pt-8`. The layout gives 1080. Leave it; the shared layout owns it.

### Brand workstream (T3)
No gaps are scored: the route is Coming soon in L1 (`team/[employee]/page.tsx:29`), and that is correct.

---

## C. Implementation spec

Tokens used below (all in `app/globals.css`): `home-paper #f7f3ec`, `home-card #fffdf9`, `home-sunk #efe8dc`, `home-rule #ddd4c4`, `home-ink #1a1814`, `home-ink-2 #4a453c`, `home-ink-3 #6b6457`, `home-orange-ink #a84a00`, `home-sky #d8e3ee` / `home-sky-ink #2c4a68`, `home-sage #dce6d5` / `home-sage-ink #3a5530`, `home-clay #f1d9d2` / `home-clay-ink #83382a`, `home-d2 #cfc6b6`. Kit constants: `EYEBROW`, `CARD`, `BTN_PRIMARY`, `BTN_SECONDARY`, `FOCUS` (`components/workspace/kit/styles.ts`). Fonts: `font-editorial` (Newsreader, from the layout's `newsreaderEditorial.variable`), `font-sans` (Geist), `font-mono` (Geist Mono).

### C1. Brand kit page

**Drawing kit colours and fonts with no inline styles.** Reuse the tenant renderer's checked mechanism:
- `deriveTheme(kit)` (`components/tenant-site/theme.ts:87`);
- `tenantStyle(theme, TENANT_FONTS[pairId], TYPE_PAIRS[pairId].heading.defaultWeight, false)` (`components/tenant-site/styles.ts:32`);
- `typePairFor` / `TENANT_FONTS` (`components/tenant-site/fonts.ts`).

Together they give a scope class plus a `<style>` rule of checked `--t-*` custom properties (hex or font stacks only), which is how `TenantSite.tsx:46-58` already does it. Wrap the board and the Brand Book in that scope and use Tailwind v4 variable utilities: `bg-(--t-primary)`, `text-(--t-ink)`, `font-(family-name:--t-font-heading)`, `[font-weight:var(--t-hw)]`.
- Text sits only on the contrast-checked pairs `deriveTheme` resolves: `--t-ground`/`--t-ink`, `--t-surface`/`--t-ink`, `--t-btn-bg`/`--t-btn-text`, `--t-dark`/`--t-dark-text`. **Never put body text on `--t-secondary` or `--t-accent`** (the schema says accent is never text). On those tiles, text sits in a ground chip.
- The view type has no `schemaVersion`. Pass `{ schemaVersion: 1, ...view.kit }`, or widen `deriveTheme` to `Pick<BrandKit, "palette" | "visualSystem" | "type">`. The second option is a **shared tenant-site change**; prefer the first.
- `fonts.ts` holds next/font loaders (`preload: false`). Importing it into the client panel must be checked with `npm run build`. If that is a problem, move `BrandBoard` into a small server component that takes the kit as props.
- Keep `isHexColour` as the guard for showing a fill. If it fails, show the swatch as a dashed `border-home-d2` empty box plus the hex text.

**Component tree**
```
page.tsx (server)
└─ <div className="flex flex-col gap-8">
   ├─ <header className="flex flex-col gap-1.5">
   │   ├─ <p className={EYEBROW}>Brand kit</p>
   │   └─ <h1 className="font-editorial text-[34px] font-normal leading-[1.1] text-home-ink sm:text-[40px]">
   │        {project.name}, <em className="italic">dressed for launch.</em></h1>
   └─ <BrandKitPanel projectId>   (client; states unchanged: Loading / Empty / Unavailable / Error)
      ready:
      <div className="flex flex-col gap-8">
        ├─ <p className="text-[13px] text-home-ink-3">Written {when}{round ? ` · ${changeRoundNote}` : ""}</p>   (P2-1/P3-1)
        ├─ LiveArtifactReview (card, headingLevel 2, BRAND_ARTIFACT.readFrom = "below")   wrapper: "max-w-[560px]"
        └─ <div className={cn(fonts.classNames, style.scope, "flex flex-col gap-8")}> <style>{style.css}</style>
           ├─ BrandBoard
           └─ BrandBook
```
At `lg`, the header and the review card may sit side by side. If so, render the review card inside the panel at the top and the header stays server-side. A two-column header would need the header moved into the panel. Simplest: keep it stacked.

**BrandBoard**
```
<section aria-labelledby="board-h" className="flex flex-col gap-3">
  <h2 id="board-h" className={EYEBROW}>Brand board</h2>
  <ul className="grid grid-cols-2 gap-2 rounded-[10px] bg-(--t-dark) p-2 sm:grid-cols-3">
    each tile: <li className="relative aspect-square overflow-hidden rounded-[4px]"> … </li>
```
Tiles, in order. Optional tiles are left out when their field is missing; the grid wraps.
1. **Wordmark**: `bg-(--t-btn-bg) text-(--t-btn-text) flex flex-col items-center justify-center gap-3 p-3 text-center`. Name: `font-(family-name:--t-font-heading) [font-weight:var(--t-hw)] text-[clamp(20px,2.4vw,34px)] leading-none tracking-[-0.01em] break-words`. Caption: `text-[11px] tracking-[0.2em]` "WORDMARK" (the board says "PRIMARY LOCKUP"; there is no mark, so "WORDMARK" is the honest label).
2. **Wordmark on three grounds**: `grid grid-rows-3`. Rows: `bg-(--t-ground) text-(--t-ink)`, `bg-(--t-surface) text-(--t-ink)`, `bg-(--t-dark) text-(--t-dark-text)`. Each row: `flex items-center justify-center border-b border-(--t-hairline) font-(family-name:--t-font-heading) [font-weight:var(--t-hw)] text-xl`, showing `{kit.name}`.
3. **Palette stack**: `grid grid-rows-[2fr_1fr_1fr_1fr_1fr]`. Rows primary/secondary/accent/ground/ink use `bg-(--t-primary)`, `bg-(--t-secondary)`, `bg-(--t-accent)`, `bg-(--t-ground)`, `bg-(--t-dark)`. Each row: `flex items-center justify-between px-3 text-xs` with `<b className="font-semibold">{name}</b><span className="font-mono">{hex}</span>`. Pick text colour per row from the exported `contrastRatio`: the class is `text-black` or `text-white`, whichever is higher, and must be ≥ 4.5. **Flag:** the ink row uses `--t-dark`, which equals ink unless `deriveTheme` fell back. If a fallback happened, show the fill with no hex.
4. **Type specimen**: `bg-(--t-ground) text-(--t-ink) flex flex-col justify-between p-[18px]`. "Aa" uses `font-(family-name:--t-font-heading) [font-weight:var(--t-hw)] text-[clamp(64px,9vw,120px)] leading-[0.9] tracking-[-0.03em]` with `aria-hidden`. Below it, `<span className="flex flex-col text-[13px]"><b className="font-(family-name:--t-font-heading) text-base">{heading.family}</b><span className="font-(family-name:--t-font-body)">{body.family} for body and UI</span></span>`.
5. **Hero art** [no image]: `bg-(--t-secondary)`, plus a chip `absolute bottom-2.5 left-2.5 rounded-full bg-(--t-ground) px-2 py-0.5 text-[11px] text-(--t-ink)`: "Hero art · described below".
6. **Tagline**: `bg-(--t-dark) text-(--t-dark-text) flex flex-col justify-between p-[22px]`. Eyebrow `text-[11px] tracking-[0.2em]` "TAGLINE". The text uses `font-(family-name:--t-font-heading) [font-weight:var(--t-hw)] text-[clamp(26px,3.2vw,44px)] leading-none tracking-[-0.02em]`. `tagline.emphasis` goes in `<em className="italic">`. **Not** accent-coloured, because accent is never text.
7. **Product moment** (when `kit.productMoment` is set): `bg-(--t-btn-bg) flex items-center justify-center p-[18px]`. Inner card `w-full rounded-[14px] bg-(--t-ground) p-3.5 text-(--t-ink) shadow-[0_14px_30px_-14px_rgb(0_0_0/0.6)] flex flex-col gap-0.5 text-[13px] leading-[1.35]`, containing `<b className="font-semibold">{title}</b><span>{body}</span>`. Drop the board's drop-icon square: there is no mark.
8. **Pattern** (when `kit.pattern` is set): `bg-(--t-secondary) p-3 flex items-end`. Chip `rounded-lg bg-(--t-ground) px-2.5 py-1.5 text-xs text-(--t-ink) line-clamp-4`: "Pattern · {pattern}".
9. **Voice** (replaces the board's app-icon tile, which has no data): `bg-(--t-surface) text-(--t-ink) flex flex-wrap content-center justify-center gap-1.5 p-4`. Each trait: `rounded-full border border-(--t-hairline) px-3 py-1 text-[13px]`.

Accessibility:
- Tile content is real text, so screen readers read it in order. Colour fills are decorative.
- The "Aa" is `aria-hidden`; the family names carry the meaning.
- No `role="img"`, because nothing is an image.

**BrandBook**
```
<section aria-labelledby="book-h" className="flex flex-col gap-6 border-t border-home-rule pt-7">
  <div>
    <p className={EYEBROW}>Brand Book</p>
    <h2 id="book-h" className="mt-1.5 font-editorial text-[28px] font-normal leading-[1.15] text-home-ink sm:text-[32px]">
      The rules your team follows <em className="italic">for every draft.</em></h2>
  </div>
  ├─ <ul aria-label="Colours" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
  │    ColourCard ×5 (order primary, secondary, accent, ground, ink):
  │    <li className="overflow-hidden rounded-lg border border-home-rule bg-home-card">
  │      <div aria-hidden className="h-[88px] border-b border-home-rule bg-(--t-primary|…)" />
  │      <div className="flex flex-col gap-0.5 p-3">
  │        <span className={EYEBROW}>Primary</span>
  │        <span className="font-semibold text-home-ink">{name}</span>
  │        <span className="font-mono text-[13px] text-home-ink">{hex}</span>
  │        <span className="text-[13px] text-home-ink-2">{use}</span>
  ├─ <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
  │    TypeCard  (<section className={cn(CARD,"rounded-lg p-5 flex flex-col gap-2.5")}>)
  │      <h3 className={EYEBROW}>Type pairing</h3>
  │      <p aria-hidden className="font-(family-name:--t-font-heading) [font-weight:var(--t-hw)] text-[34px] leading-none text-home-ink">{kit.tagline.text}</p>
  │      <p className="text-home-ink">{typePairLabel(pair)}. {type.notes}</p>
  │      <p className="font-mono text-[13px] text-home-ink-2">{type.scale}</p>
  │    VoiceCard (<section className={cn(CARD,"rounded-lg p-5 flex flex-col gap-3")}>)
  │      <h3 className={EYEBROW}>Voice</h3>
  │      <ul aria-label="Voice traits" className="flex flex-wrap gap-1.5">
  │        <li className="rounded-full bg-home-sky px-3 py-1 text-[13px] text-home-sky-ink">{trait}</li>
  │      <p className="text-sm text-home-ink"><b className="font-semibold">Say:</b> “{say}”</p>
  │      <p className="text-sm text-home-ink"><b className="font-semibold">Don't say:</b> “{dontSay}” — {dontSayWhy}</p>
  ├─ <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
  │    LookCard (h3 EYEBROW "Look"; dl: Direction / Shape and spacing / Theme — existing Fact rows and copy)
  │    LogoHeroCard (h3 EYEBROW "Logo and hero art"; p BRAND_IMAGES_COPY; dl Logo idea / Hero art idea;
  │                 when pattern or productMoment: Pattern / Product moment rows)
  └─ nameAlternatives → <p className="text-[13px] text-home-ink-2">Other names your team considered: {a}, {b}.</p>
```
The specimen line is `aria-hidden` because the same tagline is already read in the board. Remove the `aria-hidden` if the board is cut. Headings run h1 → h2 (Your review, Brand board, Brand Book) → h3 (cards).

**States** (keep the existing copy and kit components):
- Loading: `LoadingState` "Loading your brand kit…".
- None: `EmptyState` with `BRAND_NONE_COPY`; the header still renders.
- Unavailable: `EmptyState` with `BRAND_UNAVAILABLE_COPY`.
- Error: `ErrorState` "Your brand kit couldn't load right now. Reload the page to try again."
- Review states (pending, changes requested, busy, expired, cancelled, approved, spend_required) come from `ArtifactReviewCard` unchanged. The approved copy stays **"Approved. Nothing is published yet."**. Do not use the board's "site, emails and Studio now use this kit": publishing is paused and Studio is Coming soon.

**Responsive:**
- Board: 2 columns below `sm`, 3 from `sm`. Tile text uses the `clamp()` sizes above, with `break-words` on long names (40-char max).
- Colour cards and the type/voice grid reflow through `auto-fit`.

**Files touched:**
- `BrandKitPanel.tsx`, rewritten. Splitting it into `components/workspace/brand/{BrandBoard,BrandBook}.tsx` is fine.
- `brand/page.tsx`: the header.
- `lib/workspace/reviewPages.ts`: `BRAND_ARTIFACT.readFrom` only; the constant is brand-only.
- Optional: `convex/growth/drafts/brandKit.ts` (`writtenAt`).
- Tests: `tests/platform/workspace-review-pages.test.tsx` asserts the old headings and strings ("Colours" heading at :214, "Friendly, Plain" at :192, "Read the brand kit details above…" at :268). Update them.

**Shared files:** `ArtifactReviewCard`, `LiveArtifactReview`, kit `styles.ts` and the shell are **not** changed. The tenant-site modules are imported, not edited (unless `deriveTheme`'s parameter is widened; see above).

### C2. Files page

**Component tree**
```
page.tsx (server)
└─ <div className="flex flex-col gap-5">
   ├─ <header className="flex flex-col gap-2">
   │   ├─ <p className={EYEBROW}>Files</p>
   │   ├─ <h1 className="font-editorial text-[34px] font-normal leading-[1.1] text-home-ink sm:text-[40px]">
   │   │    What Wren knows, <em className="italic">in plain text you can edit.</em></h1>
   │   └─ <p className="max-w-[62ch] text-sm text-home-ink-2">Wren keeps a short summary and a few facts about your
   │        business so each chat stays focused. They are notes in plain text, never instructions. Edit or delete
   │        anything that is wrong or out of date.</p>
   └─ <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      ├─ FilesRail (server-safe; links built with the workspace route helper)
      └─ WrenMemoryPanel (client) → the reader <article>
```

**FilesRail**
```
<nav aria-label="Files" className="flex flex-col gap-4 lg:w-[240px] lg:shrink-0">
  <div className="flex flex-col gap-0.5">
    <h2 className="mb-1 ml-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-home-ink-3">Memory</h2>
    <a href="#wren-memory" aria-current="true"
       className={cn("flex min-h-[38px] items-center gap-2 rounded-md bg-home-sunk px-2.5 text-sm font-medium text-home-ink", FOCUS)}>
      <FileText aria-hidden className="size-[15px]" strokeWidth={1.7} /> What Wren knows</a>
  </div>
  <div className="flex flex-col gap-0.5">
    <h2 className="…same eyebrow…">Your team's work</h2>
    rows (links, not buttons; they leave the page):
      Blueprint → `${base}/team#blueprint`   (BLUEPRINT_SECTION_ID)
      Brand kit → `${base}/brand`
      Email sequence → `${base}/email`
      Social posts → `${base}/social`
    <a className={cn("flex min-h-[38px] items-center gap-2 rounded-md px-2.5 text-sm text-home-ink hover:bg-home-sunk", FOCUS)}>
      <FileText aria-hidden className="size-[15px]" strokeWidth={1.7} />{label}</a>
  </div>
</nav>
```
- Icons: lucide `FileText`. Use `Palette` for the brand kit if wanted.
- No WMVP badge, no file names, no counts or statuses (there is no data source for "exists/ready" here). To show only rows whose document exists, add a small owner-only query that returns the document kinds present (**backend addition, optional**). Without it, the links are honest because each target page has its own empty state.
- The rail eyebrows are `h2`s, so the reader's title is also an h2 (below).
- On mobile the rail stacks above the reader. A horizontal scroll strip is a P3 option.

**Reader (`WrenMemoryPanel`, restyled; logic unchanged)**
```
<article id="wren-memory" aria-labelledby="wren-memory-heading"
         className="min-w-0 flex-1 overflow-hidden rounded-xl border border-home-rule bg-home-card">
  ├─ <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-home-sunk px-[18px] py-3.5">
  │    <div>
  │      <h2 id="wren-memory-heading" className="text-[15px] font-medium text-home-ink">What Wren knows</h2>
  │      <p className="mt-0.5 text-[13px] text-home-ink-3">
  │        {updatedAt ? `Kept by Wren · updated ${formatWhen(updatedAt)}` : "Nothing kept yet"} · {n} of {factsMax} facts</p>
  │    </div>
  │    <button type="button" className={cn(BTN_SECONDARY, "min-h-[38px] px-3.5")} onClick={copyAll}
  │            aria-disabled={empty || undefined}>{copyLabel}</button>   // "Copy" | "Copied" | "Copy blocked here"
  ├─ <section aria-labelledby={summaryId} className="flex flex-col gap-2 px-6 py-5">
  │    <h3 id={summaryId} className={EYEBROW}>Summary</h3>
  │    summary text: <p className="whitespace-pre-wrap break-words font-mono text-sm leading-[1.7] text-home-ink">
  │    empty: <p className="text-sm text-home-ink-2">No summary yet. Wren writes one as your plans take shape.</p>
  │    <button className={LINK_BUTTON}>Edit summary | Write a summary</button>     (MemoryEditForm in place, unchanged)
  ├─ <section aria-labelledby={factsId} className="flex flex-col gap-2 border-t border-home-sunk px-6 py-5">
  │    <h3 id={factsId} ref tabIndex={-1} className={cn(EYEBROW, "rounded", FOCUS)}>Facts <span className="normal-case tracking-normal">({n} of {max})</span></h3>
  │    full note (unchanged copy)
  │    <ul className="divide-y divide-home-sunk">
  │      <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
  │        <p className="whitespace-pre-wrap break-words font-mono text-sm leading-[1.7] text-home-ink">{fact}</p>
  │        <div className="flex shrink-0 gap-1">Edit / Delete (LINK_BUTTON)</div>     confirm group + form unchanged
  └─ status line (role=status, unchanged)
```
- Local `LINK_BUTTON` becomes `cn("min-h-10 rounded px-2 text-[13px] font-medium text-home-ink underline underline-offset-2", FOCUS)`.
- `copyAll` text is `# What Wren knows\n\n{summary}\n\n## Facts\n- {fact}…`. Copy announces through the existing status line: "Copied what Wren knows." or "Copy is blocked in this browser. Select the text and copy it by hand."
- `formatWhen` uses `Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })` for under 7 days, and a date otherwise.
- **Empty:** inside the article body, keep `EmptyState title="Wren hasn't noted anything yet"` with the existing text plus "Write a summary". The header still shows "Nothing kept yet · 0 of {max} facts", and Copy is `aria-disabled`.
- **Loading / error:** inside the article area, `LoadingState` "Loading what Wren knows…" and `ErrorState` (existing copy). The rail and the h1 render regardless.
- Move the `WrenMemoryPanel` outer `<section>` and h2 into the article as above. Delete the old page-level h2 and intro (the intro moves to the page header).

**Files touched:**
- `files/page.tsx`: header and the two-pane layout.
- New `components/workspace/files/FilesRail.tsx`.
- `WrenMemoryPanel.tsx`: markup and classes only; focus, stale and edit logic untouched.
- Tests: `tests/platform/workspace-wren-memory-panel.test.tsx`, for the heading level and role changes.

**Shared files:** none.

### C3. Cross-screen flag (not for this screen alone)
The boards use "eyebrow = route label (+ meta), h1 = editorial sentence with an italic tail" on every workspace page (Brand, Files, Workstream). Every built page uses "eyebrow = project name, h1 = route label". Changing only Brand and Files makes them inconsistent with Team HQ, Email and Social. Decide once:
- either all pages follow the board (recommended; workspace pages are `noindex`, so there is no SEO heading constraint);
- or Brand and Files keep the current pattern and only append the italic tail: "Brand kit, *{project.name}.*" and "Files, *what Wren knows.*"

---

## D. Board elements to drop or defer for L1

| Board element | Board location | Why | What to show instead |
|---|---|---|---|
| Logo mark SVG and primary lockup with mark | BrandKit "PRIMARY LOCKUP" tile; Workstream `isLockup` | No image generation in L1; the kit only has `logo.markDescription` | Wordmark tile (text in the heading font), plus the description in "Logo and hero art" |
| App icon tile | BrandKit 3rd tile ("App icon, large") | No data | The voice-traits tile |
| Hero illustration | BrandKit tile "Hero art · swap for a photo in Studio" | No image; Studio is Coming soon | Secondary-colour tile with the chip "Hero art · described below" |
| Contour pattern drawing | BrandKit last tile | Only a text description exists | Pattern chip with the text, only when `kit.pattern` is set |
| Accent-coloured tagline emphasis ("thirsty." in Ember) | Tagline tile; Workstream voice | The schema says accent is never text, and that pair's contrast is not checked | Italic emphasis in `--t-dark-text` |
| "Final logo file" card (Use generated mark / Upload logo, "unlock Studio › Make", logo uploaded status, `#cc5500` border) | BrandKit Brand Book bottom | No upload mutation in `convex/`; Studio is Coming soon | Nothing. `BRAND_IMAGES_COPY` already says images are coming soon |
| "Open in Studio" link | Brand Book header | Studio is Coming soon | Omit |
| Approved copy "site, emails and Studio now use this kit" | BrandKit header status | Not true in L1: publishing is paused, Studio is Coming soon | Keep "Approved. Nothing is published yet." |
| "Looks good · approve kit" label | BrandKit header | The copy deck (System, acceptance reference) says "Approve"; the shared card uses "Approve" | Keep "Approve" |
| Brand workstream page (brief, outputs with per-output approve, "Files Iris owns", Blockers/holds about Ads and Studio, "Ask Iris a scoped question" with mock reply) | WsBrand / Workstream kind=brand | `team/[employee]` is Coming soon; per-output approvals, blockers, holds and the scoped-ask thread have no backend; holds mention Ads and Studio (both Coming soon) | The Coming soon placeholder (already built). Later: its `board`/`voice` previews should reuse `BrandBoard` |
| SOUL.md, BUSINESS.md, OWNER.md, PLAYBOOK.md, PLATFORM.md, SUPPORT.md | Files "Memory" group | No data source. OWNER.md's "SMS updates: skipped" breaks D10. BUSINESS/PLATFORM state sites, addresses and services the backend does not hold | Omit. The real memory is "What Wren knows" |
| MEMORY.md (founder signals list) | Files | No founder-signals reader in L1; the closest real data is Wren's summary and facts | "What Wren knows" reader |
| TEAM.md (+ WMVP badge) | Files "Team" group | There is no TEAM.md document. The roster lives on Team HQ | A rail link to Team HQ is optional. The "Your team's work" links cover Blueprint; add "Your team → team" if wanted |
| PRODUCT_PROMPTS.md (Part A founder pack, Part B platform engineering prompts B1–B8 + WMVP badge) | Files "Build" group, default selected file | Build pack is Coming soon. Part B is the platform's own build notes (how to build this mock), not founder content, and must never ship to founders | Omit. The nav already marks Build pack "Coming soon" |
| hydrotrail-brand-kit.png, hydrotrail-mark.svg and the image preview ("Open in Brand kit") | Files "Brand" group | No generated images or business_files in L1 | The "Brand kit" link in the rail |
| Single file-level "Edit" button | Files reader header | The built per-fact Edit/Delete and Edit summary are finer and safer (stale checks) | Keep the built controls; the header has Copy only |
| Right-hand Chat column | All three boards | Shell-level; not part of these pages | Decide in the shell audit |

**Colours with no `home-*` token** (seen in these boards or the components they touch):
- `#fbf3e8` ("ember soft", the ready/needs-you fill). The kit already hard-codes it as `bg-[#fbf3e8]` in `StatusPill.tsx`. Neither page here needs it after this spec.
- `#e3c3a0` (Workstream note border). Not needed in L1.
- `#e8cfae` (ember border). Not needed here.
- `#ddd8cc` (hairline inside the brand mock) and `rgba(19,36,42,.7)` (hero chip) are sample-business colours, replaced by `--t-hairline` and the `--t-ground` chip.
- All HydroTrail hexes (`#1F4E5F`, `#8CC2D3`, `#E07B2E`, `#F2EEE6`, `#13242A`) are kit data, drawn through the `--t-*` variables, never as product tokens.
- Every other board hex maps exactly to a token: paper, card, sunk, rule, ink, ink-2, ink-3, orange-ink, orange (`#cc5500`), sage/-ink, sky/-ink, clay/-ink, d2, panel, orange-light.

**Fonts:** Newsreader → `font-editorial`. Geist / Geist Mono → `font-sans` / `font-mono`. The board's Archivo is HydroTrail's heading font, so draw the kit's own pair with `TENANT_FONTS`, never Archivo hard-coded.
