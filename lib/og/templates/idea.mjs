// Brand accents from content/social/_brand/palette.md.
export const ACCENTS = {
  lime: '#D4FF5B',
  mint: '#8FF59B',
  lavender: '#C5AEE8',
  emerald: '#2F5F53',
  aubergine: '#1E1B38'
};

// Three breakpoints. Tuned so long idea titles ("Cross-timezone meeting
// scheduler with AI conflict resolution and team round-robin") still wrap
// to 3 lines max in the 1200×630 card.
export function pickTitleFontSize(title) {
  const len = title.length;
  if (len <= 32) return 64;
  if (len <= 70) return 52;
  return 40;
}

// Helper to build a Satori-compatible element. Satori reads `type`, `props`,
// and `props.children` exactly like React VDOM, but does not require React.
// Note: Satori treats `children: []` as multiple children and requires
// display:flex, so we omit the children prop entirely when there are none.
function el(type, props = {}, ...children) {
  if (children.length === 0) return { type, props };
  const c = children.length === 1 ? children[0] : children;
  return { type, props: { ...props, children: c } };
}

// Logo dimensions for the top-left mark. Logo SVG is 771x98 (ratio 7.86), so
// at 28px tall it lands at ~220px wide — readable but not dominant.
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round((771 / 98) * LOGO_HEIGHT);

export function buildElement({ title, accent, logoDataUrl }) {
  const accentHex = ACCENTS[accent] ?? ACCENTS.lime;
  const titleSize = pickTitleFontSize(title);

  return el(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        // Transparent root — sharp composites this chrome over the Recraft bg.
        // (See compose.mjs for the two-pass pipeline.)
        color: '#FFFFFF',
        fontFamily: 'Geist',
        padding: 56
      }
    },
    // Bottom-third tonal band. Anchors the title without muting the top 62%
    // of the Recraft brand image. Publication-poster pattern (Stripe / Vercel /
    // Apple keynote thumbnails).
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 1200,
        height: 240,
        background:
          'linear-gradient(180deg, rgba(5,5,5,0) 0%, rgba(5,5,5,0.55) 50%, rgba(5,5,5,0.85) 100%)'
      }
    }),
    // Top row: WMV mark + accent dot
    el(
      'div',
      {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          position: 'relative'
        }
      },
      logoDataUrl
        ? // Logo sits inside a small dark chip so it reads on any background.
          // Contained badge, not a stripe (per impeccable's absolute_bans).
          el(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 16,
                paddingRight: 16,
                backgroundColor: 'rgba(5, 5, 5, 0.62)',
                borderRadius: 999
              }
            },
            el('img', {
              src: logoDataUrl,
              width: LOGO_WIDTH,
              height: LOGO_HEIGHT,
              style: {
                width: LOGO_WIDTH,
                height: LOGO_HEIGHT
              }
            })
          )
        : el(
            'div',
            {
              style: {
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: -0.5,
                color: '#FFFFFF',
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 16,
                paddingRight: 16,
                backgroundColor: 'rgba(5, 5, 5, 0.62)',
                borderRadius: 999
              }
            },
            'WEEKEND MVP'
          ),
      // Accent dot also gets a small dark backing for contrast on bright bgs.
      el(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(5, 5, 5, 0.62)'
          }
        },
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
    // Spacer
    el('div', { style: { flex: 1 } }),
    // Title — sits in the bottom tonal band. text-shadow as belt-and-suspenders
    // for the rare bright Recraft output.
    el(
      'div',
      {
        style: {
          fontSize: titleSize,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -1.5,
          color: '#FFFFFF',
          maxWidth: 1000,
          position: 'relative',
          textShadow: '0 2px 8px rgba(0,0,0,0.55)'
        }
      },
      title
    ),
    // Bottom accent bar
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 1200,
        height: 6,
        backgroundColor: accentHex
      }
    })
  );
}
