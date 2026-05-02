// Same brand accents as the idea template.
export const ACCENTS = {
  lime: '#D4FF5B',
  mint: '#8FF59B',
  lavender: '#C5AEE8',
  emerald: '#2F5F53',
  aubergine: '#1E1B38'
};

// Article panel is 480px wide (left 40% of the 1200px frame), so titles wrap
// sooner than idea cards. Three breakpoints tuned for that narrower column.
export function pickTitleFontSize(title) {
  const len = title.length;
  if (len <= 30) return 64;
  if (len <= 70) return 52;
  return 44;
}

// Per-template canvas config consumed by compose.mjs.
// Article cards split the frame: solid #050505 left 40% (480px) for typography,
// Recraft scene fills the right 60% (720px) via sharp composite.
export const config = {
  width: 1200,
  height: 630,
  bgRect: { x: 480, y: 0, width: 720, height: 630 },
  bgFill: '#050505'
};

// Article surface dimensions.
const PANEL_WIDTH = 480;
const PANEL_PADDING = 56;

// Logo dimensions (matches idea template — Geist logo is 771x98).
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round((771 / 98) * LOGO_HEIGHT);

// Helper to build a Satori-compatible element. Same el() shape used by the
// idea template — Satori reads {type, props} like React VDOM but does not
// require React. Empty children arrays are omitted because Satori treats them
// as multi-child and demands display:flex.
function el(type, props = {}, ...children) {
  if (children.length === 0) return { type, props };
  const c = children.length === 1 ? children[0] : children;
  return { type, props: { ...props, children: c } };
}

export function buildElement({ title, accent, readMinutes, logoDataUrl }) {
  const accentHex = ACCENTS[accent] ?? ACCENTS.lime;
  const titleSize = pickTitleFontSize(title);
  const minutes = typeof readMinutes === 'number' && readMinutes > 0 ? readMinutes : 5;

  return el(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        // Transparent root — sharp composites this chrome over the surface
        // canvas (which already has the Recraft bg placed in the right 60%).
        color: '#FFFFFF',
        fontFamily: 'Geist'
      }
    },
    // LEFT panel: solid #050505, holds all typography
    el(
      'div',
      {
        style: {
          width: PANEL_WIDTH,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#050505',
          padding: PANEL_PADDING
        }
      },
      // Top: WMV logo
      logoDataUrl
        ? el('img', {
            src: logoDataUrl,
            width: LOGO_WIDTH,
            height: LOGO_HEIGHT,
            style: { width: LOGO_WIDTH, height: LOGO_HEIGHT }
          })
        : el(
            'div',
            {
              style: {
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: -0.5,
                color: '#FFFFFF'
              }
            },
            'WEEKEND MVP'
          ),
      // ARTICLE label (Geist Mono, accent-colored)
      el(
        'div',
        {
          style: {
            marginTop: 18,
            fontFamily: 'GeistMono',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 2,
            color: accentHex,
            textTransform: 'uppercase'
          }
        },
        'ARTICLE'
      ),
      // Spacer pushes title toward middle/bottom
      el('div', { style: { flex: 1 } }),
      // Title
      el(
        'div',
        {
          style: {
            fontSize: titleSize,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1.0,
            color: '#FFFFFF',
            display: 'flex'
          }
        },
        title
      ),
      // Spacer between title and read-time chip
      el('div', { style: { height: 24 } }),
      // Bottom row: read-time chip + accent dot
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }
        },
        el(
          'div',
          {
            style: {
              fontFamily: 'GeistMono',
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: 1.5,
              color: '#A1A1AA'
            }
          },
          `${minutes} MIN READ`
        ),
        el('div', {
          style: {
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: accentHex
          }
        })
      )
    ),
    // Bottom accent bar — spans full 1200px width (positioned absolute so it
    // crosses the panel/scene boundary).
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 1200,
        height: 4,
        backgroundColor: accentHex
      }
    })
  );
}
