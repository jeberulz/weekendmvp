import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFonts } from '../../lib/og/fonts.mjs';

test('loadFonts returns Satori-compatible font array', async () => {
  const fonts = await loadFonts();
  assert.ok(Array.isArray(fonts), 'returns an array');
  assert.equal(fonts.length, 4, 'returns Geist regular+bold + GeistMono regular+bold');

  const geistRegular = fonts.find((f) => f.name === 'Geist' && f.weight === 400);
  const geistBold = fonts.find((f) => f.name === 'Geist' && f.weight === 700);
  const monoRegular = fonts.find((f) => f.name === 'GeistMono' && f.weight === 400);
  const monoBold = fonts.find((f) => f.name === 'GeistMono' && f.weight === 700);

  assert.ok(geistRegular, 'has Geist regular');
  assert.ok(geistBold, 'has Geist bold');
  assert.ok(monoRegular, 'has GeistMono regular');
  assert.ok(monoBold, 'has GeistMono bold');

  for (const f of fonts) {
    assert.equal(f.style, 'normal');
    assert.ok(Buffer.isBuffer(f.data) || f.data instanceof ArrayBuffer, 'data is a buffer');
    assert.ok(f.data.byteLength > 1000, 'font file is non-trivial');
  }
});
