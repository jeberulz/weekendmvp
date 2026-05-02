// Per-template canvas config consumed by compose.mjs.
// Carousel slide-1 heroes are 1080x1350 full-bleed JPGs with NO chrome —
// the compose module detects the absence of `buildElement` and skips Satori,
// returning the resized Recraft scene directly. JPEG quality 88 (slightly
// higher than email's 85) because these render at full size on
// LinkedIn/Instagram, not as inbox thumbnails.
export const config = {
  width: 1080,
  height: 1350,
  bgRect: { x: 0, y: 0, width: 1080, height: 1350 },
  bgFill: '#050505',
  format: 'jpeg',
  jpegQuality: 88
};

// Intentionally no `buildElement` export — see Surface C / email-newsletter
// for the precedent. compose.mjs falls through to the no-chrome code path.
