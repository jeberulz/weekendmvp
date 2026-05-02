import satori from 'satori';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.mjs';
import { loadLogoDataUrl } from './assets.mjs';
import * as ideaTemplate from './templates/idea.mjs';
import * as articleTemplate from './templates/article.mjs';
import * as newsletterTemplate from './templates/newsletter.mjs';
import * as emailNewsletterTemplate from './templates/email-newsletter.mjs';
import * as carouselHeroTemplate from './templates/carousel-hero.mjs';

const TEMPLATES = {
  idea: ideaTemplate,
  article: articleTemplate,
  newsletter: newsletterTemplate,
  'email-newsletter': emailNewsletterTemplate,
  'carousel-hero': carouselHeroTemplate
};

// Encode the final sharp pipeline to PNG or JPEG depending on template config.
// Defaults to PNG (the OG card pattern); email surfaces opt in to JPEG via
// `format: 'jpeg'` + optional `jpegQuality` in their config.
function applyFormat(pipeline, cfg) {
  if (cfg.format === 'jpeg') {
    return pipeline.jpeg({ quality: cfg.jpegQuality ?? 85, mozjpeg: true });
  }
  return pipeline.png();
}

// Surface-agnostic 2-pass composite:
//   1. sharp resizes the Recraft bg to template.config.bgRect dimensions
//   2. sharp builds a frame-sized canvas, places fittedBg at bgRect offset
//   3. (only if template exports buildElement) Satori renders the chrome,
//      then sharp composites the chrome PNG over the canvas
//   4. encode to format (PNG or JPEG per config) and return the buffer
//
// Image-only surfaces (no buildElement) skip step 3 entirely and emit the
// canvas directly.
export async function compose({
  bgBuffer,
  title,
  surface,
  accent,
  readMinutes,
  edition,
  publishedAt
}) {
  const tpl = TEMPLATES[surface];
  if (!tpl) {
    throw new Error(`compose: unknown surface "${surface}"`);
  }
  const cfg = tpl.config;

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

  // 3. If the template has a chrome layer, render + composite it.
  // Image-only surfaces (no buildElement) skip this entirely.
  if (typeof tpl.buildElement === 'function') {
    const [fonts, logoDataUrl] = await Promise.all([
      loadFonts(),
      loadLogoDataUrl({ height: 28, color: '#FFFFFF' })
    ]);

    const element = tpl.buildElement({
      title,
      accent,
      logoDataUrl,
      readMinutes,
      edition,
      publishedAt
    });
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

    return await applyFormat(
      sharp(canvas).composite([{ input: chromePng, top: 0, left: 0 }]),
      cfg
    ).toBuffer();
  }

  // No chrome — canvas IS the final output. Just encode to the right format.
  return await applyFormat(sharp(canvas), cfg).toBuffer();
}
