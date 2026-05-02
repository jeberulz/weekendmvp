import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Resolve WOFF paths via Node's require.resolve so this works regardless of
// monorepo / pnpm hoisting. @fontsource/* v5+ ships WOFF files at
// files/{family}-latin-{weight}-normal.woff (WOFF1 — required by satori's
// bundled opentype.js which does not support WOFF2).
function resolveFontPath(family, weight) {
  return require.resolve(
    `@fontsource/${family}/files/${family}-latin-${weight}-normal.woff`
  );
}

let cache = null;

export async function loadFonts() {
  if (cache) return cache;
  const [geistRegular, geistBold, monoRegular, monoBold] = await Promise.all([
    readFile(resolveFontPath('geist-sans', 400)),
    readFile(resolveFontPath('geist-sans', 700)),
    readFile(resolveFontPath('geist-mono', 400)),
    readFile(resolveFontPath('geist-mono', 700))
  ]);
  cache = [
    { name: 'Geist',     data: geistRegular, weight: 400, style: 'normal' },
    { name: 'Geist',     data: geistBold,    weight: 700, style: 'normal' },
    { name: 'GeistMono', data: monoRegular,  weight: 400, style: 'normal' },
    { name: 'GeistMono', data: monoBold,     weight: 700, style: 'normal' }
  ];
  return cache;
}
