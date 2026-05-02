import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, updateManifestStatus } from '../../scripts/generate-og-cards.mjs';

test('parseArgs handles --dry-run', () => {
  const opts = parseArgs(['--dry-run']);
  assert.equal(opts.dryRun, true);
  assert.equal(opts.force, false);
  assert.equal(opts.slug, null);
  assert.equal(opts.nonBlocking, false);
});

test('parseArgs handles --force --slug X --non-blocking together', () => {
  const opts = parseArgs(['--force', '--slug', 'my-slug', '--non-blocking']);
  assert.equal(opts.force, true);
  assert.equal(opts.slug, 'my-slug');
  assert.equal(opts.nonBlocking, true);
});

test('updateManifestStatus writes og.status without losing other fields', async () => {
  const dir = await mkdir(join(tmpdir(), `og-test-${Date.now()}`), { recursive: true });
  const path = join(dir ?? tmpdir(), 'manifest.json');
  await writeFile(
    path,
    JSON.stringify({
      ideas: [
        { slug: 'foo', title: 'Foo', description: 'desc', og: { subject: 's' } },
        { slug: 'bar', title: 'Bar' }
      ]
    }, null, 2)
  );

  await updateManifestStatus(path, 'foo', 'ready');
  await updateManifestStatus(path, 'bar', 'failed');

  const json = JSON.parse(await readFile(path, 'utf8'));
  const foo = json.ideas.find((i) => i.slug === 'foo');
  const bar = json.ideas.find((i) => i.slug === 'bar');

  assert.equal(foo.og.status, 'ready');
  assert.equal(foo.og.subject, 's', 'preserves existing og fields');
  assert.equal(foo.title, 'Foo', 'preserves non-og fields');
  assert.equal(bar.og.status, 'failed', 'creates og block when missing');
  assert.equal(bar.title, 'Bar');

  await rm(path.replace('/manifest.json', ''), { recursive: true, force: true });
});
