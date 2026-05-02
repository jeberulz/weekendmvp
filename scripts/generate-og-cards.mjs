#!/usr/bin/env node
/**
 * Generate per-page OG share cards.
 *
 * Usage:
 *   node scripts/generate-og-cards.mjs               # generate any missing
 *   node scripts/generate-og-cards.mjs --force       # regenerate all
 *   node scripts/generate-og-cards.mjs --slug X      # one specific slug
 *   node scripts/generate-og-cards.mjs --dry-run     # log only, no API calls
 *   node scripts/generate-og-cards.mjs --non-blocking  # exit 0 even on failures
 *
 * Env (read from .env.local or process env):
 *   RECRAFT_API_KEY=
 *   RECRAFT_STYLE_ID=  (optional, hugely recommended)
 *   OPENAI_API_KEY=    (fallback)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listIdeas } from '../lib/og/sources/ideas.mjs';
import { generate as generateRecraft } from '../lib/og/providers/recraft.mjs';
import { generate as generateOpenAI } from '../lib/og/providers/openai.mjs';
import { compose } from '../lib/og/compose.mjs';
import { STYLE_BLUEPRINT } from '../lib/og/style-blueprint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST = join(ROOT, 'ideas/manifest.json');

// Minimal .env.local loader (matches the autocrew pattern; no dotenv dep)
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
    slug: args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null
  };
}

export async function updateManifestStatus(manifestPath, slug, status) {
  const json = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = json.ideas.find((i) => i.slug === slug);
  if (!entry) return;
  entry.og = entry.og ?? {};
  entry.og.status = status;
  writeFileSync(manifestPath, JSON.stringify(json, null, 2) + '\n');
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

  const items = (await listIdeas()).filter((i) => !opts.slug || i.slug === opts.slug);

  if (items.length === 0) {
    console.log('No items to process.');
    return;
  }

  let generated = 0, skipped = 0, failed = 0;
  const failedSlugs = [];

  for (const item of items) {
    const outPath = join(ROOT, item.outputPath);
    mkdirSync(dirname(outPath), { recursive: true });

    if (existsSync(outPath) && !opts.force) {
      console.log(`SKIP  ${item.slug}`);
      skipped++;
      continue;
    }

    if (opts.dryRun) {
      console.log(`DRY   ${item.slug}`);
      console.log(`      subject: ${item.subject}`);
      console.log(`      → ${item.outputPath}\n`);
      continue;
    }

    console.log(`GEN   ${item.slug}`);
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
        accent: item.accent
      });
      writeFileSync(outPath, png);
      await updateManifestStatus(MANIFEST, item.slug, 'ready');
      console.log(`      ✓ ${provider} → ${item.outputPath}\n`);
      generated++;
    } catch (err) {
      console.error(`      ✗ ${item.slug}: ${err.message}`);
      await updateManifestStatus(MANIFEST, item.slug, 'failed');
      failedSlugs.push(item.slug);
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${generated}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failedSlugs.length > 0) {
    console.log(`Failed slugs: ${failedSlugs.join(', ')}`);
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
