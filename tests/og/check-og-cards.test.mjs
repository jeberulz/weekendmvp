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

function setupDir({
  ideaPng = false,
  articlePng = false,
  newsletterPng = false,
  emailNewsletterJpg = false
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'og-check-'));
  mkdirSync(join(dir, 'ideas'), { recursive: true });
  mkdirSync(join(dir, 'articles'), { recursive: true });
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  mkdirSync(join(dir, 'image/og/idea'), { recursive: true });
  mkdirSync(join(dir, 'image/og/article'), { recursive: true });
  mkdirSync(join(dir, 'image/og/newsletter'), { recursive: true });
  mkdirSync(join(dir, 'image/email/newsletter'), { recursive: true });
  writeFileSync(
    join(dir, 'ideas/manifest.json'),
    JSON.stringify({ ideas: [{ slug: 'idea-one', title: 'Idea One' }] })
  );
  writeFileSync(
    join(dir, 'articles/manifest.json'),
    JSON.stringify({ articles: [{ slug: 'article-one', title: 'Article One' }] })
  );
  writeFileSync(
    join(dir, 'newsletter/manifest.json'),
    JSON.stringify({ newsletters: [{ slug: '2026-05-01-am', title: 'Newsletter One' }] })
  );
  if (ideaPng) writeFileSync(join(dir, 'image/og/idea/idea-one.png'), 'fake');
  if (articlePng) writeFileSync(join(dir, 'image/og/article/article-one.png'), 'fake');
  if (newsletterPng) writeFileSync(join(dir, 'image/og/newsletter/2026-05-01-am.png'), 'fake');
  if (emailNewsletterJpg) writeFileSync(join(dir, 'image/email/newsletter/2026-05-01-am.jpg'), 'fake');
  return dir;
}

test('exits 0 by default when PNGs/JPGs missing (warn-only)', () => {
  const dir = setupDir();
  const r = runIn(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout + r.stderr, /missing/i);
});

test('exits 1 with STRICT=1 when any output missing across 4 surfaces', () => {
  const dir = setupDir({ ideaPng: true, articlePng: true, newsletterPng: true, emailNewsletterJpg: false });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 1);
});

test('exits 0 with STRICT=1 when all outputs present across 4 surfaces', () => {
  const dir = setupDir({ ideaPng: true, articlePng: true, newsletterPng: true, emailNewsletterJpg: true });
  const r = runIn(dir, { STRICT: '1' });
  assert.equal(r.status, 0);
});

test('reports missing slugs broken down by all 4 surfaces', () => {
  const dir = setupDir();
  const r = runIn(dir);
  assert.match(r.stdout, /idea/);
  assert.match(r.stdout, /article/);
  assert.match(r.stdout, /\bnewsletter\b/);          // includes "newsletter" (OG)
  assert.match(r.stdout, /email-newsletter/);        // includes "email-newsletter"
});
