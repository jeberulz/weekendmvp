import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const LOGO_SVG_PATH = join(process.cwd(), 'image/weekendmvp-logo.svg');

const cache = new Map();

// Loads image/weekendmvp-logo.svg, recolors it (the source has fill="black"),
// rasterizes to PNG at the requested height via resvg, returns a data URL
// suitable for use as a Satori <img src=...>. Cached per (height, color) key
// because rasterization is non-trivial.
export async function loadLogoDataUrl({ height = 28, color = '#FFFFFF' } = {}) {
  const key = `${height}|${color}`;
  if (cache.has(key)) return cache.get(key);

  const raw = await readFile(LOGO_SVG_PATH, 'utf8');
  const recolored = raw.replace(/fill="[^"]*"/g, `fill="${color}"`);
  const png = new Resvg(recolored, {
    fitTo: { mode: 'height', value: height }
  })
    .render()
    .asPng();
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  cache.set(key, dataUrl);
  return dataUrl;
}

// Logo aspect ratio (width / height) from the source SVG viewBox 771x98.
// Used by the template to size the <img> correctly.
export const LOGO_ASPECT_RATIO = 771 / 98;
