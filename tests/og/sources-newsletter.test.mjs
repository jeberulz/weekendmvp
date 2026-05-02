import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listNewsletter, deriveAccent } from '../../lib/og/sources/newsletter.mjs';

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/newsletter-manifest-fixture.json'
);

test('deriveAccent maps slug suffix to brand accent', () => {
  assert.equal(deriveAccent('2026-05-01-am'), 'mint');
  assert.equal(deriveAccent('2026-05-01-pm'), 'lavender');
  assert.equal(deriveAccent('weird-slug'), 'lime', 'fallback for unknown suffix');
});

test('listNewsletter returns one item per newsletter', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  assert.equal(items.length, 4);
});

test('listNewsletter uses og.subject when present, falls back through description→title', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  const am = items.find((i) => i.slug === '2026-05-01-am');
  const pm = items.find((i) => i.slug === '2026-05-01-pm');
  const bare = items.find((i) => i.slug === '2026-05-02-am');
  assert.equal(am.subject, "An AM-specific director's note");
  assert.equal(pm.subject, 'PM fallback description.');
  assert.equal(bare.subject, 'Bare AM Title Only');
});

test('listNewsletter auto-derives accent from slug (am→mint, pm→lavender)', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  assert.equal(items.find((i) => i.slug === '2026-05-01-am').accent, 'mint');
  assert.equal(items.find((i) => i.slug === '2026-05-01-pm').accent, 'lavender');
  assert.equal(items.find((i) => i.slug === '2026-05-02-am').accent, 'mint');
});

test('listNewsletter respects og.accent override when present', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  const overridden = items.find((i) => i.slug === '2026-05-03-pm');
  assert.equal(overridden.accent, 'lime', 'manifest override beats deriveAccent');
});

test('listNewsletter sets surface, edition, publishedAt, outputPath on every item', async () => {
  const items = await listNewsletter({ manifestPath: FIXTURE });
  for (const item of items) {
    assert.equal(item.surface, 'newsletter');
    assert.ok(item.edition === 'am' || item.edition === 'pm', `edition must be am or pm for ${item.slug}`);
    assert.equal(item.outputPath, `image/og/newsletter/${item.slug}.png`);
    assert.ok(item.title);
  }
  assert.equal(items.find((i) => i.slug === '2026-05-01-am').publishedAt, '2026-05-01');
});
