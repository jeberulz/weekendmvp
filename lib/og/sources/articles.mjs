import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_MANIFEST = join(process.cwd(), 'articles/manifest.json');
const DEFAULT_ACCENT = 'lime';
const DEFAULT_READ_MINUTES = 5;

export async function listArticles({ manifestPath = DEFAULT_MANIFEST } = {}) {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.articles)) {
    throw new Error(`manifest at ${manifestPath} has no "articles" array`);
  }
  return manifest.articles.map((article) => {
    const og = article.og ?? {};
    const subject = og.subject ?? article.description ?? article.title;
    const accent = og.accent ?? DEFAULT_ACCENT;
    const readMinutes = article.readMinutes ?? DEFAULT_READ_MINUTES;
    return {
      slug: article.slug,
      title: article.title,
      subject,
      accent,
      readMinutes,
      surface: 'article',
      outputPath: `image/og/article/${article.slug}.png`,
      status: og.status
    };
  });
}
