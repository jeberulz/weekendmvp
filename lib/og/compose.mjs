import satori from 'satori';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.mjs';
import { loadLogoDataUrl } from './assets.mjs';
import { buildElement as buildIdea } from './templates/idea.mjs';

const TEMPLATES = {
  idea: buildIdea
  // article, newsletter, carousel — added in follow-up tickets
};

// Two-pass composite:
//   1. sharp resizes the Recraft bg to 1200x630 (cover crop, center)
//   2. Satori renders the chrome (logo, title, dot, bar) over a transparent bg
//   3. sharp composites the chrome PNG over the bg PNG
// Why: Satori's CSS backgroundImage / absolute-positioned <img> with multi-MB
// data URLs silently fails — the chrome renders but the bg drops out. Letting
// sharp do the bg+overlay composite is reliable, fast, and lossless.
export async function compose({ bgBuffer, title, surface, accent }) {
  const builder = TEMPLATES[surface];
  if (!builder) {
    throw new Error(`compose: unknown surface "${surface}"`);
  }
  const [fonts, logoDataUrl] = await Promise.all([
    loadFonts(),
    loadLogoDataUrl({ height: 28, color: '#FFFFFF' })
  ]);

  // 1. Resize Recraft output to exact OG dimensions
  const resizedBg = await sharp(bgBuffer)
    .resize(1200, 630, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  // 2. Build chrome (logo + title + accent dot/bar) over transparent bg
  const element = builder({ title, accent, logoDataUrl });
  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts
  });
  const chromePng = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    background: 'rgba(0, 0, 0, 0)'
  })
    .render()
    .asPng();

  // 3. Composite chrome over the bg
  return await sharp(resizedBg)
    .composite([{ input: chromePng, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
