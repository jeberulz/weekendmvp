import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listIdeas } from '../../lib/og/sources/ideas.mjs';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/manifest-fixture.json'
);

test('listIdeas returns one item per idea', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  assert.equal(items.length, 3);
});

test('listIdeas uses og.subject when present', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'with-og');
  assert.equal(item.subject, 'A glowing terminal at 2am');
  assert.equal(item.accent, 'lavender');
});

test('listIdeas falls back to description when og.subject is missing', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'no-og-has-description');
  assert.equal(item.subject, 'Falls back to this description.');
  assert.equal(item.accent, 'lime', 'defaults to lime when og.accent is absent');
});

test('listIdeas falls back to title when description is also missing', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  const item = items.find((i) => i.slug === 'no-og-no-description');
  assert.equal(item.subject, 'Bare Idea Title Only');
});

test('listIdeas sets surface and outputPath on every item', async () => {
  const items = await listIdeas({ manifestPath: FIXTURE });
  for (const item of items) {
    assert.equal(item.surface, 'idea');
    assert.equal(item.outputPath, `image/og/idea/${item.slug}.png`);
    assert.ok(item.title);
  }
});
