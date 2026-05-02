import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Resolve WOFF paths via Node's require.resolve so this works regardless of
// monorepo / pnpm hoisting. @fontsource/geist-sans v5+ ships WOFF files at
// files/geist-sans-latin-{weight}-normal.woff (WOFF1 — required by satori's
// bundled opentype.js which does not support WOFF2).
function resolveFontPath(weight) {
  return require.resolve(
    `@fontsource/geist-sans/files/geist-sans-latin-${weight}-normal.woff`
  );
}

let cache = null;

export async function loadFonts() {
  if (cache) return cache;
  const [regular, bold] = await Promise.all([
    readFile(resolveFontPath(400)),
    readFile(resolveFontPath(700))
  ]);
  cache = [
    { name: 'Geist', data: regular, weight: 400, style: 'normal' },
    { name: 'Geist', data: bold, weight: 700, style: 'normal' }
  ];
  return cache;
}
