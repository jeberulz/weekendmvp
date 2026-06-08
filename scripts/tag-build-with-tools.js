#!/usr/bin/env node
/**
 * Backfill `tools` tags on ideas/manifest.json for the build-with pages that
 * had no tool data (lovable, replit, v0, windsurf, no-code).
 *
 * Tagging is heuristic, by idea category, and reflects what each tool is
 * actually good at building:
 *
 *   - windsurf / replit  general AI dev environments → every category
 *   - lovable            full-stack web app builder  → all but developer-tools
 *   - v0                 frontend / UI generator     → all but automation + developer-tools
 *   - no-code            visual builders             → all but developer-tools + ai-tools
 *
 * The existing tags (cursor, claude, bolt) are never touched. This script is
 * ADD-ONLY and idempotent — re-running it never removes a tag, so manual tag
 * edits made later are preserved.
 *
 *   node scripts/tag-build-with-tools.js          # report what would change
 *   node scripts/tag-build-with-tools.js --write  # apply to manifest.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'ideas/manifest.json');

// tool → categories it should be tagged on. `exclude` lists categories to skip;
// everything else in the manifest is fair game.
const TOOL_RULES = {
  windsurf: { exclude: [] },
  replit: { exclude: [] },
  lovable: { exclude: ['developer-tools'] },
  v0: { exclude: ['automation', 'developer-tools'] },
  'no-code': { exclude: ['developer-tools', 'ai-tools'] },
};

function main() {
  const write = process.argv.includes('--write');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const added = {};
  for (const tool of Object.keys(TOOL_RULES)) added[tool] = 0;

  for (const idea of manifest.ideas) {
    if (!Array.isArray(idea.tools)) idea.tools = [];
    for (const [tool, rule] of Object.entries(TOOL_RULES)) {
      if (rule.exclude.includes(idea.category)) continue;
      if (idea.tools.includes(tool)) continue;
      idea.tools.push(tool);
      added[tool] += 1;
    }
  }

  const totalAdded = Object.values(added).reduce((a, b) => a + b, 0);

  console.log('Tag backfill summary (tags added):');
  for (const [tool, count] of Object.entries(added)) {
    const total = manifest.ideas.filter((i) => i.tools.includes(tool)).length;
    console.log(`  ${tool.padEnd(10)} +${count}  (now ${total} ideas)`);
  }

  if (!write) {
    console.log(`\nDry run — pass --write to apply (${totalAdded} tags would be added).`);
    return;
  }

  if (totalAdded === 0) {
    console.log('\nNothing to add — manifest already up to date.');
    return;
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`\n✓ Wrote ${path.relative(ROOT, manifestPath)} (+${totalAdded} tags).`);
}

main();
