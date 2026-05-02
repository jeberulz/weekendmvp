import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFonts } from '../../lib/og/fonts.mjs';

test('loadFonts returns Satori-compatible font array', async () => {
  const fonts = await loadFonts();
  assert.ok(Array.isArray(fonts), 'returns an array');
  assert.equal(fonts.length, 2, 'returns regular + bold');

  const regular = fonts.find((f) => f.weight === 400);
  const bold = fonts.find((f) => f.weight === 700);

  assert.ok(regular, 'has regular weight');
  assert.ok(bold, 'has bold weight');

  for (const f of fonts) {
    assert.equal(f.name, 'Geist');
    assert.equal(f.style, 'normal');
    assert.ok(Buffer.isBuffer(f.data) || f.data instanceof ArrayBuffer, 'data is a buffer');
    assert.ok(f.data.byteLength > 1000, 'font file is non-trivial');
  }
});
