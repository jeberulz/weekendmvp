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

export function buildElement({ title, accent, bgDataUrl }) {
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
        backgroundColor: '#050505',
        color: '#FFFFFF',
        fontFamily: 'Geist',
        padding: 56
      }
    },
    // Background image (Recraft output)
    el('img', {
      src: bgDataUrl,
      width: 1200,
      height: 630,
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1200,
        height: 630,
        objectFit: 'cover'
      }
    }),
    // Dark gradient overlay for legibility (bottom-up)
    el('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1200,
        height: 630,
        background:
          'linear-gradient(180deg, rgba(5,5,5,0.20) 0%, rgba(5,5,5,0.55) 60%, rgba(5,5,5,0.85) 100%)'
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
      el(
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
      el('div', {
        style: {
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: accentHex
        }
      })
    ),
    // Spacer
    el('div', { style: { flex: 1 } }),
    // Title
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
          position: 'relative'
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
