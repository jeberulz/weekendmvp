import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_ROOT = join(process.cwd(), 'content/social/posts');
const DEFAULT_ACCENT = 'lime';

// Parse the pipe-delimited markdown table at the top of carousel.md.
// Stops at the first non-table line OR the first horizontal rule (`---`).
// Skips the header row (| Field | Value |) and the divider (|---|---|).
// Exported for unit testing — listCarouselHero is the public API.
export function parseTable(text) {
  const out = {};
  const lines = text.split('\n');
  let inTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '---') break;
    if (line.startsWith('|')) {
      inTable = true;
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length < 2) continue;
      // Skip the header row and the markdown divider row.
      if (cells[0].toLowerCase() === 'field' && cells[1].toLowerCase() === 'value') continue;
      if (/^:?-+:?$/.test(cells[0])) continue;
      out[cells[0]] = cells.slice(1).join(' | ').trim();
      continue;
    }
    if (inTable && line.length > 0) break;
  }
  return out;
}

// Compose subject for the Recraft call. Priority:
//   1. slide_01_subject (author-written director's note)
//   2. `${theme} — ${topic}` (concatenated metadata)
//   3. slug (last resort)
function deriveSubject(meta, slug) {
  if (meta.slide_01_subject) return meta.slide_01_subject;
  if (meta.theme && meta.topic) return `${meta.theme} — ${meta.topic}`;
  return slug;
}

// Walk content/social/posts/* and emit one item per directory containing
// a parseable carousel.md. Missing/unparseable files are skipped silently.
export async function listCarouselHero({ rootDir = DEFAULT_ROOT } = {}) {
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const items = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const path = join(rootDir, slug, 'carousel.md');
    let raw;
    try {
      raw = await readFile(path, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    const meta = parseTable(raw);
    if (Object.keys(meta).length === 0) continue;
    const subject = deriveSubject(meta, slug);
    const title =
      meta.theme && meta.topic ? `${meta.theme} — ${meta.topic}` : slug;
    items.push({
      slug,
      title,
      subject,
      accent: meta.accent_primary ?? DEFAULT_ACCENT,
      surface: 'carousel-hero',
      outputPath: `image/social/carousel/${slug}.jpg`,
      status: undefined
    });
  }
  return items;
}
