import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listArticles } from '../../lib/og/sources/articles.mjs';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/articles-manifest-fixture.json'
);

test('listArticles returns one item per article', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  assert.equal(items.length, 3);
});

test('listArticles uses og.subject + og.accent when present', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'with-og');
  assert.equal(item.subject, 'An open notebook with one mint line');
  assert.equal(item.accent, 'mint');
  assert.equal(item.readMinutes, 8);
});

test('listArticles falls back to description when og.subject missing', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'no-og-has-description');
  assert.equal(item.subject, 'Falls back to this description.');
  assert.equal(item.accent, 'lime', 'defaults to lime when og.accent is absent');
});

test('listArticles falls back to title when description missing', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'no-og-no-description');
  assert.equal(item.subject, 'Bare Article Title Only');
  assert.equal(item.readMinutes, 5, 'defaults to 5 when readMinutes is absent');
});

test('listArticles sets surface and outputPath on every item', async () => {
  const items = await listArticles({ manifestPath: FIXTURE });
  for (const item of items) {
    assert.equal(item.surface, 'article');
    assert.equal(item.outputPath, `image/og/article/${item.slug}.png`);
    assert.ok(item.title);
  }
});
