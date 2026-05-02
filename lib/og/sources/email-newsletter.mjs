import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deriveAccent } from './newsletter.mjs';

const DEFAULT_MANIFEST = join(process.cwd(), 'newsletter/manifest.json');
const DEFAULT_ACCENT = 'lime';

// Reads the same newsletter/manifest.json that listNewsletter reads, but
// produces items for the `email-newsletter` surface — different outputPath
// (JPG instead of PNG, image/email/newsletter/ instead of image/og/newsletter/)
// and reads status from og.emailStatus (NOT og.status, which belongs to the
// OG card surface). Reuses og.subject so the email scene visually matches
// the OG card scene.
export async function listEmailNewsletter({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.newsletters)) {
    throw new Error(`manifest at ${manifestPath} has no "newsletters" array`);
  }
  return manifest.newsletters.map((entry) => {
    const og = entry.og ?? {};
    const subject = og.subject ?? entry.description ?? entry.title;
    const accent = og.accent ?? deriveAccent(entry.slug);
    return {
      slug: entry.slug,
      title: entry.title,
      subject,
      accent,
      surface: 'email-newsletter',
      outputPath: `image/email/newsletter/${entry.slug}.jpg`,
      status: og.emailStatus
    };
  });
}
