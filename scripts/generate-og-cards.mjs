#!/usr/bin/env node
/**
 * Generate per-page OG share cards across all surfaces.
 *
 * Usage:
 *   node scripts/generate-og-cards.mjs                   # all surfaces, missing only
 *   node scripts/generate-og-cards.mjs --force           # regenerate all
 *   node scripts/generate-og-cards.mjs --slug X          # one slug (any surface)
 *   node scripts/generate-og-cards.mjs --surface article # filter to one surface
 *   node scripts/generate-og-cards.mjs --dry-run         # log only
 *   node scripts/generate-og-cards.mjs --raw             # also write {slug}-raw.png
 *   node scripts/generate-og-cards.mjs --non-blocking    # exit 0 even on failures
 *
 * Env (loaded from .env.local or process env):
 *   RECRAFT_API_KEY=
 *   RECRAFT_STYLE_ID=  (optional, hugely recommended)
 *   OPENAI_API_KEY=    (fallback)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listIdeas } from '../lib/og/sources/ideas.mjs';
import { listArticles } from '../lib/og/sources/articles.mjs';
import { generate as generateRecraft } from '../lib/og/providers/recraft.mjs';
import { generate as generateOpenAI } from '../lib/og/providers/openai.mjs';
import { compose } from '../lib/og/compose.mjs';
import { STYLE_BLUEPRINT } from '../lib/og/style-blueprint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Surface → manifest path (relative to root). Each source returns items with
// item.surface set, so this is just a lookup table for status writeback.
const MANIFEST_PATHS = {
  idea: 'ideas/manifest.json',
  article: 'articles/manifest.json'
};

// Surface → manifest top-level array key (idea→ideas, article→articles).
const MANIFEST_KEYS = {
  idea: 'ideas',
  article: 'articles'
};

// Minimal .env.local loader (matches autocrew pattern; no dotenv dep)
function loadDotEnv() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export function parseArgs(argv) {
  const args = argv;
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    nonBlocking: args.includes('--non-blocking'),
    raw: args.includes('--raw'),
    slug: args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null,
    surface: args.includes('--surface') ? args[args.indexOf('--surface') + 1] : null
  };
}

// Routes status writes to the correct manifest based on item surface.
// `rootDir` is overridable for tests.
export async function updateManifestStatus(surface, slug, status, { rootDir = ROOT } = {}) {
  const relPath = MANIFEST_PATHS[surface];
  if (!relPath) return;
  const path = join(rootDir, relPath);
  if (!existsSync(path)) return;
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const list = json[MANIFEST_KEYS[surface]];
  if (!Array.isArray(list)) return;
  const entry = list.find((i) => i.slug === slug);
  if (!entry) return;
  entry.og = entry.og ?? {};
  entry.og.status = status;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
}

// Collect items from every available source. Each surface is loaded
// gracefully — a missing manifest skips that surface without erroring.
async function loadAllItems() {
  const items = [];
  const tryLoad = async (loader) => {
    try {
      const list = await loader();
      items.push(...list);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // missing manifest is OK — surface just contributes zero items
    }
  };
  await tryLoad(listIdeas);
  await tryLoad(listArticles);
  return items;
}

async function generateOne({ subject }) {
  const prompt = `${STYLE_BLUEPRINT}\n\nSubject: ${subject}`;
  try {
    return { buffer: await generateRecraft({ prompt }), provider: 'recraft' };
  } catch (err) {
    console.warn(`      ⚠ Recraft failed: ${err.message}`);
    console.warn(`      → falling back to gpt-image-1`);
    return { buffer: await generateOpenAI({ prompt }), provider: 'openai-gpt-image-1' };
  }
}

async function main() {
  loadDotEnv();
  const opts = parseArgs(process.argv.slice(2));

  let items = await loadAllItems();
  if (opts.surface) items = items.filter((i) => i.surface === opts.surface);
  if (opts.slug) items = items.filter((i) => i.slug === opts.slug);

  if (items.length === 0) {
    console.log('No items to process.');
    return;
  }

  let generated = 0, skipped = 0, failed = 0;
  const failedKeys = [];

  for (const item of items) {
    const outPath = join(ROOT, item.outputPath);
    mkdirSync(dirname(outPath), { recursive: true });

    if (existsSync(outPath) && !opts.force) {
      console.log(`SKIP  ${item.surface}/${item.slug}`);
      skipped++;
      continue;
    }

    if (opts.dryRun) {
      console.log(`DRY   ${item.surface}/${item.slug}`);
      console.log(`      subject: ${item.subject}`);
      console.log(`      → ${item.outputPath}\n`);
      continue;
    }

    console.log(`GEN   ${item.surface}/${item.slug}`);
    console.log(`      subject: ${item.subject}`);

    try {
      const { buffer: bg, provider } = await generateOne({ subject: item.subject });
      if (opts.raw) {
        const rawPath = outPath.replace(/\.png$/, '-raw.png');
        writeFileSync(rawPath, bg);
        console.log(`      ✎ raw → ${rawPath.replace(ROOT + '/', '')}`);
      }
      const png = await compose({
        bgBuffer: bg,
        title: item.title,
        surface: item.surface,
        accent: item.accent,
        readMinutes: item.readMinutes
      });
      writeFileSync(outPath, png);
      await updateManifestStatus(item.surface, item.slug, 'ready');
      console.log(`      ✓ ${provider} → ${item.outputPath}\n`);
      generated++;
    } catch (err) {
      console.error(`      ✗ ${item.surface}/${item.slug}: ${err.message}`);
      await updateManifestStatus(item.surface, item.slug, 'failed');
      failedKeys.push(`${item.surface}/${item.slug}`);
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${generated}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failedKeys.length > 0) {
    console.log(`Failed: ${failedKeys.join(', ')}`);
  }
  if (failed > 0 && !opts.nonBlocking) {
    process.exit(1);
  }
}

// Only run when invoked as a script (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
