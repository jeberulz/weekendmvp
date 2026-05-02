// Per-template canvas config consumed by compose.mjs.
// Email newsletter heroes are 600x400 full-bleed JPGs with NO chrome —
// the compose module detects the absence of `buildElement` and skips
// Satori chrome rendering, returning the resized Recraft scene directly.
//
// JPEG instead of PNG because email clients (Gmail, Apple Mail, Outlook)
// prefer JPG for hero photography — smaller file size, broadly supported.
export const config = {
  width: 600,
  height: 400,
  bgRect: { x: 0, y: 0, width: 600, height: 400 },
  bgFill: '#050505',
  format: 'jpeg',
  jpegQuality: 85
};

// Intentionally no `buildElement` export — this is an image-only surface.
// See `lib/og/compose.mjs` for the no-chrome code path.
