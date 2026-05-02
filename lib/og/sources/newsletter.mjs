import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_MANIFEST = join(process.cwd(), 'newsletter/manifest.json');
const DEFAULT_ACCENT = 'lime';

// Maps slug suffix to brand accent. Newsletter slugs end in `-am` or `-pm`.
// Mint = morning, lavender = evening. Unknown suffix falls back to lime.
export function deriveAccent(slug) {
  if (slug.endsWith('-am')) return 'mint';
  if (slug.endsWith('-pm')) return 'lavender';
  return DEFAULT_ACCENT;
}

function deriveEdition(slug, fallback) {
  if (slug.endsWith('-am')) return 'am';
  if (slug.endsWith('-pm')) return 'pm';
  return fallback;
}

export async function listNewsletter({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.newsletters)) {
    throw new Error(`manifest at ${manifestPath} has no "newsletters" array`);
  }
  return manifest.newsletters.map((entry) => {
    const og = entry.og ?? {};
    const subject = og.subject ?? entry.description ?? entry.title;
    const accent = og.accent ?? deriveAccent(entry.slug);
    const edition = deriveEdition(entry.slug, entry.edition);
    return {
      slug: entry.slug,
      title: entry.title,
      subject,
      accent,
      edition,
      publishedAt: entry.publishedAt,
      surface: 'newsletter',
      outputPath: `image/og/newsletter/${entry.slug}.png`,
      status: og.status
    };
  });
}
