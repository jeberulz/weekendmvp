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

test('updateManifestStatus writes to newsletter/manifest.json for surface=newsletter', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  const path = join(dir, 'newsletter/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      newsletters: [{ slug: '2026-05-01-am', title: 'AM', edition: 'am' }]
    }, null, 2)
  );

  await updateManifestStatus('newsletter', '2026-05-01-am', 'ready', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const entry = json.newsletters.find((i) => i.slug === '2026-05-01-am');
  assert.equal(entry.og.status, 'ready', 'creates og block when missing and sets status');
  assert.equal(entry.title, 'AM', 'preserves non-og fields');
  assert.equal(entry.edition, 'am', 'preserves edition');

  await rm(dir, { recursive: true, force: true });
});

test('parseArgs handles --surface newsletter', () => {
  const opts = parseArgs(['--surface', 'newsletter']);
  assert.equal(opts.surface, 'newsletter');
});

test('updateManifestStatus writes to og.emailStatus for surface=email-newsletter', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  const path = join(dir, 'newsletter/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      newsletters: [{ slug: '2026-05-01-am', title: 'AM', edition: 'am' }]
    }, null, 2)
  );

  await updateManifestStatus('email-newsletter', '2026-05-01-am', 'ready', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const entry = json.newsletters.find((i) => i.slug === '2026-05-01-am');
  assert.equal(entry.og.emailStatus, 'ready', 'writes to emailStatus, not status');
  assert.equal(entry.og.status, undefined, 'does not touch og.status');

  await rm(dir, { recursive: true, force: true });
});

test('updateManifestStatus surface=newsletter and surface=email-newsletter share manifest but use different fields', async () => {
  const dir = mkdtempSync(join(tmpdir(), `og-test-${Date.now()}-`));
  mkdirSync(join(dir, 'newsletter'), { recursive: true });
  const path = join(dir, 'newsletter/manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      newsletters: [{ slug: '2026-05-01-pm', title: 'PM', edition: 'pm', og: { subject: 's' } }]
    }, null, 2)
  );

  await updateManifestStatus('newsletter', '2026-05-01-pm', 'ready', { rootDir: dir });
  await updateManifestStatus('email-newsletter', '2026-05-01-pm', 'failed', { rootDir: dir });

  const json = JSON.parse(await readFile(path, 'utf8'));
  const entry = json.newsletters.find((i) => i.slug === '2026-05-01-pm');
  assert.equal(entry.og.status, 'ready', 'OG card status preserved');
  assert.equal(entry.og.emailStatus, 'failed', 'email status independent');
  assert.equal(entry.og.subject, 's', 'existing fields preserved');

  await rm(dir, { recursive: true, force: true });
});

test('parseArgs handles --surface email-newsletter', () => {
  const opts = parseArgs(['--surface', 'email-newsletter']);
  assert.equal(opts.surface, 'email-newsletter');
});
