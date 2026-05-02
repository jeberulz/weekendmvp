import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, updateManifestStatus } from '../../scripts/generate-og-cards.mjs';

test('parseArgs handles --dry-run', () => {
  const opts = parseArgs(['--dry-run']);
  assert.equal(opts.dryRun, true);
  assert.equal(opts.force, false);
  assert.equal(opts.slug, null);
  assert.equal(opts.surface, null);
  assert.equal(opts.nonBlocking, false);
});

test('parseArgs handles --force --slug X --non-blocking together', () => {
  const opts = parseArgs(['--force', '--slug', 'my-slug', '--non-blocking']);
  assert.equal(opts.force, true);
  assert.equal(opts.slug, 'my-slug');
  assert.equal(opts.nonBlocking, true);
  assert.equal(opts.surface, null);
});

test('parseArgs handles --raw', () => {
  const opts = parseArgs(['--raw']);
  assert.equal(opts.raw, true);
  assert.equal(parseArgs([]).raw, false);
});

test('parseArgs handles --surface article', () => {
  const opts = parseArgs(['--surface', 'article']);
  assert.equal(opts.surface, 'article');
});

test('parseArgs handles --surface idea', () => {
  const opts = parseArgs(['--surface', 'idea']);
  assert.equal(opts.surface, 'idea');
});

test('updateManifestStatus writes to ideas/manifest.json for surface=idea', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'ideas'), { recursive: true });
  const path = join(dir, 'ideas/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      ideas: [{ slug: 'foo', title: 'Foo', og: { subject: 's' } }]
    }, null, 2)
  );

  await updateManifestStatus('idea', 'foo', 'ready', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const foo = json.ideas.find((i) => i.slug === 'foo');
  assert.equal(foo.og.status, 'ready');
  assert.equal(foo.og.subject, 's', 'preserves existing og fields');
  assert.equal(foo.title, 'Foo', 'preserves non-og fields');

  await rm(dir, { recursive: true, force: true });
});

test('updateManifestStatus writes to articles/manifest.json for surface=article', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'articles'), { recursive: true });
  const path = join(dir, 'articles/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      articles: [{ slug: 'bar', title: 'Bar' }]
    }, null, 2)
  );

  await updateManifestStatus('article', 'bar', 'failed', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const bar = json.articles.find((i) => i.slug === 'bar');
  assert.equal(bar.og.status, 'failed', 'creates og block when missing');
  assert.equal(bar.title, 'Bar', 'preserves non-og fields');

  await rm(dir, { recursive: true, force: true });
});
