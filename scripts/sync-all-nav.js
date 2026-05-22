#!/usr/bin/env node
/**
 * Run all nav sync/check scripts in dependency order.
 *
 *   node scripts/sync-all-nav.js --write   # apply partials to HTML
 *   STRICT=1 node scripts/sync-all-nav.js  # CI drift check (npm run check:all-nav)
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const write = process.argv.includes('--write');

const scripts = [
  'sync-nav.js',
  'sync-idea-nav.js',
  'sync-reading-nav.js',
  'sync-starter-kit-nav.js',
];

for (const script of scripts) {
  const args = [path.join(__dirname, script)];
  if (write) args.push('--write');
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(write ? 'All nav sync complete.' : 'All nav checks passed.');
