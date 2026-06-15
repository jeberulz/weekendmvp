# ship·able deck — Figma export

28 slides at **1920×1080** (16:9). Source script: `../01-slide-deck.md`.

## Preview locally

```bash
cd shipable-launch/deck && npx --yes serve .
```

- **Export layout (default):** http://localhost:3000 — all frames stacked for import
- **Presenter mode:** http://localhost:3000/?present=1 — arrow keys, `F` fullscreen

## Import to Figma

1. Open `index.html` in Chrome (via local server above — plugins need a URL).
2. Install **[html.to.design](https://www.html.to.design/)** (or HTML to Figma / Anima).
3. Import the page URL. Select individual `.slide` elements if the plugin asks for frames.
4. In Figma: each slide is one 1920×1080 frame — rename, swap fonts (Geist if you have it), adjust orange tokens.

**Alternative:** Screenshot each slide in presenter mode at 100% zoom, or use Figma's "Place image" if you only need static PNGs.

## Files

| File | Purpose |
|------|---------|
| `index.html` | All 28 slides |
| `deck.css` | Brand tokens + layout |
| `deck.js` | Presenter mode only |

## Brand tokens (match ship·able LP)

- Dark `#0a0a0a` · Cream `#fcfaf7` · Orange `#CC5500` / `#e9a06a`
- Fonts in deck: Inter, Newsreader (italic accent), IBM Plex Mono — swap to Geist in Figma if desired

Speaker notes stay in `01-slide-deck.md` — not on slides.
