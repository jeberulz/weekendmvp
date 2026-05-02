import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(process.cwd(), 'scripts/check-og-cards.js');

function runIn(dir, env = {}) {
  return spawnSync('node', [SCRIPT], {
    cwd: dir,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function setupDir({ withPng = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'og-check-'));
  mkdirSync(join(dir, 'ideas'), { recursive: true });
  mkdirSync(join(dir, 'image/og/idea'), { recursive: true });
  writeFileSync(
    join(dir, 'ideas/manifest.json'),
    JSON.stringify({ ideas: [{ slug: 'one', title: 'One' }] })
  );
  if (withPng) writeFileSync(join(dir, 'image/og/idea/one.png'), 'fake');
  return dir;
}

test('exits 0 by default when PNG missing (warn-only)', () => {
  const dir = setupDir({ withPng: false });
  const r = runIn(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout + r.stderr, /missing/i);
});

test('exits 1 when STRICT=1 and PNG missing', () => {
  const dir = setupDir({ withPng: false });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 1);
});

test('exits 0 when all PNGs present even under STRICT=1', () => {
  const dir = setupDir({ withPng: true });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 0);
});
