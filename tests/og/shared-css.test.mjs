import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SHARED_CSS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../content/social/_layouts/_shared.css'
);

test('_shared.css contains the .slide-hero[data-has-hero] selector', async () => {
  const css = await readFile(SHARED_CSS, 'utf8');
  assert.match(
    css,
    /\.slide-hero\[data-has-hero\]/,
    'Surface D v2 selector missing — hero overlay rule was deleted or never added'
  );
});

test('_shared.css contains the bottom-anchored dark gradient overlay', async () => {
  const css = await readFile(SHARED_CSS, 'utf8');
  assert.match(css, /linear-gradient\(\s*180deg/, 'gradient direction missing');
  assert.match(
    css,
    /rgba\(\s*5,\s*5,\s*5,\s*0\.55\s*\)/,
    'gradient mid-stop colour rgba(5,5,5,0.55) missing'
  );
});

test('_shared.css declares background-image: url(\'hero.jpg\') for the hero rule', async () => {
  const css = await readFile(SHARED_CSS, 'utf8');
  assert.match(
    css,
    /background-image:\s*url\(\s*['"]hero\.jpg['"]\s*\)/,
    'hero.jpg URL reference missing — slide-1 background will not load'
  );
});
