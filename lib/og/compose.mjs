import satori from 'satori';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.mjs';
import { loadLogoDataUrl } from './assets.mjs';
import * as ideaTemplate from './templates/idea.mjs';
import * as articleTemplate from './templates/article.mjs';

const TEMPLATES = {
  idea: ideaTemplate,
  article: articleTemplate
  // newsletter, carousel — added in follow-up surfaces
};

// Surface-agnostic 2-pass composite:
//   1. sharp resizes the Recraft bg to template.config.bgRect dimensions
//   2. sharp builds a frame-sized canvas, places fittedBg at bgRect offset
//   3. Satori renders the chrome (transparent root) at full frame size
//   4. sharp composites the chrome PNG over the canvas
//
// Each template encodes its own layout intent in `config` (canvas dims,
// where Recraft goes, what fills the rest). Compose has no per-surface
// branching beyond looking up the template.
export async function compose({ bgBuffer, title, surface, accent, readMinutes }) {
  const tpl = TEMPLATES[surface];
  if (!tpl) {
    throw new Error(`compose: unknown surface "${surface}"`);
  }
  const cfg = tpl.config;

  const [fonts, logoDataUrl] = await Promise.all([
    loadFonts(),
    loadLogoDataUrl({ height: 28, color: '#FFFFFF' })
  ]);

  // 1. Resize Recraft to bgRect dimensions
  const fittedBg = await sharp(bgBuffer)
    .resize(cfg.bgRect.width, cfg.bgRect.height, {
      fit: 'cover',
      position: 'centre'
    })
    .png()
    .toBuffer();

  // 2. Build the frame canvas, place fittedBg at bgRect offset
  const canvas = await sharp({
    create: {
      width: cfg.width,
      height: cfg.height,
      channels: 3,
      background: cfg.bgFill
    }
  })
    .composite([{ input: fittedBg, left: cfg.bgRect.x, top: cfg.bgRect.y }])
    .png()
    .toBuffer();

  // 3. Render chrome over a transparent root
  const element = tpl.buildElement({ title, accent, logoDataUrl, readMinutes });
  const svg = await satori(element, {
    width: cfg.width,
    height: cfg.height,
    fonts
  });
  const chromePng = new Resvg(svg, {
    fitTo: { mode: 'width', value: cfg.width },
    background: 'rgba(0, 0, 0, 0)'
  })
    .render()
    .asPng();

  // 4. Composite chrome over the canvas
  return await sharp(canvas)
    .composite([{ input: chromePng, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
