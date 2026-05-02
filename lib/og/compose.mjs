import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadFonts } from './fonts.mjs';
import { buildElement as buildIdea } from './templates/idea.mjs';

const TEMPLATES = {
  idea: buildIdea
  // article, newsletter, carousel — added in follow-up tickets
};

export async function compose({ bgBuffer, title, surface, accent }) {
  const builder = TEMPLATES[surface];
  if (!builder) {
    throw new Error(`compose: unknown surface "${surface}"`);
  }
  const fonts = await loadFonts();
  const bgDataUrl = `data:image/png;base64,${bgBuffer.toString('base64')}`;

  const element = builder({ title, accent, bgDataUrl });
  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts
  });
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 }
  })
    .render()
    .asPng();
  return png;
}
