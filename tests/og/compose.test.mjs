import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { compose } from '../../lib/og/compose.mjs';

// 100x100 dark grey PNG — stand-in for a Recraft output.
async function fakeBg() {
  return await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 30, g: 30, b: 30 }
    }
  })
    .png()
    .toBuffer();
}

test('compose returns a 1200x630 PNG buffer for surface=idea', async () => {
  const png = await compose({
    bgBuffer: await fakeBg(),
    title: 'Composed Idea Title',
    surface: 'idea',
    accent: 'lime'
  });
  assert.ok(Buffer.isBuffer(png));
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.format, 'png');
});

test('compose returns a 1200x630 PNG buffer for surface=article', async () => {
  const png = await compose({
    bgBuffer: await fakeBg(),
    title: 'Composed Article Title',
    surface: 'article',
    accent: 'lavender',
    readMinutes: 8
  });
  assert.ok(Buffer.isBuffer(png));
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
});

test('compose throws on unknown surface', async () => {
  await assert.rejects(
    compose({
      bgBuffer: await fakeBg(),
      title: 'X',
      surface: 'nonexistent-surface',
      accent: 'lime'
    }),
    /unknown surface/i
  );
});

test('article composite places Recraft bg in the right 60% (left panel stays solid)', async () => {
  // Build a bright RED Recraft stand-in so we can sample the output and prove
  // (a) the right side is dominated by red, (b) the left side is dominated by
  // black (#050505 panel from config.bgFill).
  const redBg = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).png().toBuffer();

  const png = await compose({
    bgBuffer: redBg,
    title: 'Layout Test',
    surface: 'article',
    accent: 'lime',
    readMinutes: 5
  });

  const raw = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const channels = info.channels; // 3 or 4

  // Sample center-left pixel (x=240, y=315) — should be near-black.
  const leftIdx = (315 * info.width + 240) * channels;
  const leftRed = data[leftIdx];
  assert.ok(leftRed < 30, `left panel should be near-black, got R=${leftRed}`);

  // Sample center-right pixel (x=900, y=315) — should be dominantly red
  // (allowing for any chrome overlay; bottom 4px accent bar is far away).
  const rightIdx = (315 * info.width + 900) * channels;
  const rightRed = data[rightIdx];
  assert.ok(rightRed > 200, `right area should show red Recraft bg, got R=${rightRed}`);
});

test('compose returns 1200x630 PNG for surface=newsletter (with edition + publishedAt)', async () => {
  const png = await compose({
    bgBuffer: await fakeBg(),
    title: 'Sample Newsletter Title',
    surface: 'newsletter',
    accent: 'mint',
    edition: 'am',
    publishedAt: '2026-05-01'
  });
  assert.ok(Buffer.isBuffer(png));
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
});

test('newsletter composite places Recraft bg in top 60% (bottom 40% stays solid)', async () => {
  // Bright RED Recraft stand-in. Top 60% should be dominantly red, bottom
  // 40% should be near-black from the #050505 fill.
  const redBg = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).png().toBuffer();

  const png = await compose({
    bgBuffer: redBg,
    title: 'Newsletter Layout Test',
    surface: 'newsletter',
    accent: 'lavender',
    edition: 'pm',
    publishedAt: '2026-05-02'
  });

  const raw = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const channels = info.channels;

  // Sample top-center pixel (x=600, y=120) — should be dominantly red.
  // Avoid the postmark area (top:56, right:56, 120px circle ≈ x=1024-1144, y=56-176).
  const topIdx = (120 * info.width + 600) * channels;
  const topRed = data[topIdx];
  assert.ok(topRed > 200, `top area should show red Recraft bg, got R=${topRed}`);

  // Sample bottom-center pixel (x=600, y=500) — should be near-black.
  // Avoid the bottom 4px accent bar (y=626-630).
  const bottomIdx = (500 * info.width + 600) * channels;
  const bottomRed = data[bottomIdx];
  assert.ok(bottomRed < 30, `bottom panel should be near-black, got R=${bottomRed}`);
});
