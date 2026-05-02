// Same brand accents as the idea/article templates.
export const ACCENTS = {
  lime: '#D4FF5B',
  mint: '#8FF59B',
  lavender: '#C5AEE8',
  emerald: '#2F5F53',
  aubergine: '#1E1B38'
};

// Bottom panel right column has ~700px usable (after left meta column).
export function pickTitleFontSize(title) {
  const len = title.length;
  if (len <= 30) return 60;
  if (len <= 70) return 48;
  return 40;
}

// Per-template canvas config consumed by compose.mjs.
// Newsletter cards split horizontally: top 60% (378px) Recraft scene,
// bottom 40% (252px) solid #050505 panel for typography.
export const config = {
  width: 1200,
  height: 630,
  bgRect: { x: 0, y: 0, width: 1200, height: 378 },
  bgFill: '#050505'
};

// Helper to build a Satori-compatible element. Same shape as other templates.
// Empty children arrays are omitted because Satori treats them as multi-child
// and demands display:flex.
function el(type, props = {}, ...children) {
  if (children.length === 0) return { type, props };
  const c = children.length === 1 ? children[0] : children;
  return { type, props: { ...props, children: c } };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Renders YYYY-MM-DD as "MMM · DD · YY" for the postmark center.
export function formatPostmarkDate(iso) {
  if (typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const [, year, monthNum, day] = m;
  const month = MONTHS[parseInt(monthNum, 10) - 1];
  if (!month) return '';
  const yy = year.slice(2);
  return `${month} · ${day} · ${yy}`;
}

// Renders YYYY-MM-DD as "YYYY·MM·DD" for the bottom-panel meta line.
function formatMetaDate(iso) {
  if (typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[1]}·${m[2]}·${m[3]}`;
}

const POSTMARK_DIAMETER = 120;
const POSTMARK_INNER_DIAMETER = 90;
const PANEL_HEIGHT = 252;
const PANEL_PADDING = 56;
const META_COLUMN_WIDTH = 400;
const ACCENT_BAR_HEIGHT = 4;

const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round((771 / 98) * LOGO_HEIGHT);

export function buildElement({ title, accent, edition, publishedAt, logoDataUrl }) {
  const accentHex = ACCENTS[accent] ?? ACCENTS.lime;
  const titleSize = pickTitleFontSize(title);
  const editionLabel = edition === 'am' ? 'AM' : edition === 'pm' ? 'PM' : '';
  const editionLine = editionLabel ? `${editionLabel} EDITION` : '';
  const postmarkDate = formatPostmarkDate(publishedAt);
  const metaDate = formatMetaDate(publishedAt);
  const metaSecondLine = [metaDate, editionLine].filter(Boolean).join(' · ');

  return el(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        color: '#FFFFFF',
        fontFamily: 'Geist'
      }
    },
    // Postmark circle — top-right of the Recraft area
    el(
      'div',
      {
        style: {
          position: 'absolute',
          top: 56,
          right: 56,
          width: POSTMARK_DIAMETER,
          height: POSTMARK_DIAMETER,
          borderRadius: POSTMARK_DIAMETER / 2,
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor: accentHex,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      },
      el(
        'div',
        {
          style: {
            width: POSTMARK_INNER_DIAMETER,
            height: POSTMARK_INNER_DIAMETER,
            borderRadius: POSTMARK_INNER_DIAMETER / 2,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: accentHex,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }
        },
        el(
          'div',
          {
            style: {
              fontFamily: 'GeistMono',
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: 1,
              color: accentHex,
              lineHeight: 1
            }
          },
          editionLabel || '·'
        ),
        el(
          'div',
          {
            style: {
              marginTop: 6,
              fontFamily: 'GeistMono',
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: 1.5,
              color: accentHex
            }
          },
          postmarkDate
        )
      )
    ),
    // Spacer to push the bottom panel to the bottom 40%
    el('div', { style: { flex: 1 } }),
    // Bottom panel: meta column + title column
    el(
      'div',
      {
        style: {
          width: 1200,
          height: PANEL_HEIGHT,
          display: 'flex',
          flexDirection: 'row',
          padding: PANEL_PADDING
        }
      },
      // Left column: WMV mark + 2-line meta in Geist Mono
      el(
        'div',
        {
          style: {
            width: META_COLUMN_WIDTH,
            display: 'flex',
            flexDirection: 'column'
          }
        },
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
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: -0.4,
                  color: '#FFFFFF'
                }
              },
              'WEEKEND MVP'
            ),
        el(
          'div',
          {
            style: {
              marginTop: 18,
              fontFamily: 'GeistMono',
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: 1.5,
              color: '#A1A1AA',
              display: 'flex',
              flexDirection: 'column'
            }
          },
          el('div', { style: { color: '#A1A1AA' } }, 'FROM: WEEKEND MVP'),
          el('div', { style: { marginTop: 4, color: accentHex } }, metaSecondLine)
        )
      ),
      // Right column: title (Geist Bold, autoshrunk)
      el(
        'div',
        {
          style: {
            flex: 1,
            display: 'flex',
            alignItems: 'center'
          }
        },
        el(
          'div',
          {
            style: {
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.0,
              color: '#FFFFFF',
              display: 'flex'
            }
          },
          title
        )
      )
    ),
    // Bottom 4px accent bar
    el('div', {
      style: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 1200,
        height: ACCENT_BAR_HEIGHT,
        backgroundColor: accentHex
      }
    })
  );
}
