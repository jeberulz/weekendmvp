#!/usr/bin/env node
/**
 * Backfill queue for THIN pages flagged _needsBackfill in ideas/manifest.json.
 * Cross-references ideas/_audit.json to show current status, missing sections,
 * word count, and whether the manifest entry carries Ideabrowser provenance.
 *
 * Usage:
 *   node scripts/backfill-queue.js                 # print queue table
 *   node scripts/backfill-queue.js --next          # print next candidate slug only (for scripting)
 *   node scripts/backfill-queue.js --promote <slug>  # strip _needsBackfill from manifest entry (use after an audit PASS)
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'ideas', 'manifest.json');
const auditPath = path.join(root, 'ideas', '_audit.json');

const args = process.argv.slice(2);
const nextOnly = args.includes('--next');
const promoteIdx = args.indexOf('--promote');
const promoteSlug = promoteIdx !== -1 ? args[promoteIdx + 1] : null;

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getAuditForSlug(auditReport, slug) {
  return (auditReport.ideas || []).find(i => i.slug === slug);
}

function printQueue(manifest, audit) {
  const candidates = manifest.ideas.filter(i => i._needsBackfill);
  if (!candidates.length) {
    console.log('Backfill queue is empty. All linked ideas have cleared the THIN tier.');
    return;
  }

  console.log(`Backfill queue: ${candidates.length} idea(s) flagged _needsBackfill\n`);
  console.log('slug'.padEnd(44) + 'bytes'.padStart(7) + 'words'.padStart(7) + '  sections'.padStart(11) + '  source');
  console.log('-'.repeat(96));

  const rows = candidates.map(i => {
    const a = getAuditForSlug(audit, i.slug) || {};
    return {
      slug: i.slug,
      bytes: a.bytes || 0,
      words: a.wordCount || 0,
      secs: a.sections ? Object.values(a.sections).filter(Boolean).length : 0,
      missing: a.missingSections || [],
      source: i.source || '—',
    };
  });

  rows.sort((a, b) => b.bytes - a.bytes || a.slug.localeCompare(b.slug));

  for (const r of rows) {
    console.log(
      r.slug.padEnd(44) +
      String(r.bytes).padStart(7) +
      String(r.words).padStart(7) +
      `  ${r.secs}/7       `.padStart(11) +
      `  ${r.source}`
    );
  }

  const next = rows[0];
  console.log(`\nNext candidate: ${next.slug}`);
  if (next.missing.length) console.log(`  Missing sections: ${next.missing.join(', ')}`);
  if (next.source && next.source.startsWith('ideabrowser:')) {
    console.log(`  Mode A lookup: idea_id ${next.source.replace('ideabrowser:', '')}`);
  } else {
    console.log(`  No Ideabrowser id on record. Use mcp__ideabrowser__browse_ideas to search by title, or pass --from-draft if creating a draft folder.`);
  }
  console.log(`\nTo run the gate after republish: node scripts/audit-ideas.js --file ${next.slug} --strict`);
  console.log(`To promote after PASS: node scripts/backfill-queue.js --promote ${next.slug}`);
}

function printNext(manifest) {
  const candidates = manifest.ideas.filter(i => i._needsBackfill);
  if (!candidates.length) process.exit(0);
  console.log(candidates[0].slug);
}

function promote(manifest, slug) {
  const idea = manifest.ideas.find(i => i.slug === slug);
  if (!idea) {
    console.error(`No manifest entry for slug: ${slug}`);
    process.exit(1);
  }
  if (!idea._needsBackfill) {
    console.log(`${slug} is already promoted (no _needsBackfill flag).`);
    return;
  }
  delete idea._needsBackfill;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Promoted ${slug} — removed _needsBackfill from manifest.json.`);
  const remaining = manifest.ideas.filter(i => i._needsBackfill).length;
  console.log(`Backfill queue remaining: ${remaining}`);
}

try {
  const manifest = loadJSON(manifestPath);
  if (promoteSlug) {
    promote(manifest, promoteSlug);
  } else if (nextOnly) {
    printNext(manifest);
  } else {
    if (!fs.existsSync(auditPath)) {
      console.error('ideas/_audit.json not found — run `node scripts/audit-ideas.js` first.');
      process.exit(1);
    }
    const audit = loadJSON(auditPath);
    printQueue(manifest, audit);
  }
} catch (err) {
  console.error('backfill-queue.js failed:', err);
  process.exit(1);
}
