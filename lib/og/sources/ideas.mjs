import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_MANIFEST = join(process.cwd(), 'ideas/manifest.json');
const DEFAULT_ACCENT = 'lime';

export async function listIdeas({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.ideas)) {
    throw new Error(`manifest at ${manifestPath} has no "ideas" array`);
  }
  return manifest.ideas.map((idea) => {
    const og = idea.og ?? {};
    const subject = og.subject ?? idea.description ?? idea.title;
    const accent = og.accent ?? DEFAULT_ACCENT;
    return {
      slug: idea.slug,
      title: idea.title,
      subject,
      accent,
      surface: 'idea',
      outputPath: `image/og/idea/${idea.slug}.png`,
      status: og.status
    };
  });
}
