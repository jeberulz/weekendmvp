import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { compose } from '../../lib/og/compose.mjs';

// Build a tiny in-memory "Recraft output": a 100x100 dark grey PNG
async function fakeBg() {
  return await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 20, g: 20, b: 20 }
    }
  })
    .png()
    .toBuffer();
}

test('compose returns a 1200x630 PNG buffer', async () => {
  const bg = await fakeBg();
  const png = await compose({
    bgBuffer: bg,
    title: 'Composed Test Title',
    surface: 'idea',
    accent: 'lime'
  });
  assert.ok(Buffer.isBuffer(png));
  // Inspect the PNG header dimensions.
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(meta.format, 'png');
});

test('compose throws on unknown surface', async () => {
  const bg = await fakeBg();
  await assert.rejects(
    compose({
      bgBuffer: bg,
      title: 'X',
      surface: 'nonexistent-surface',
      accent: 'lime'
    }),
    /unknown surface/i
  );
});
