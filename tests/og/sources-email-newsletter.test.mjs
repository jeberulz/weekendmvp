import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listEmailNewsletter } from '../../lib/og/sources/email-newsletter.mjs';

// Reuses the existing newsletter fixture so both surfaces share data.
const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/newsletter-manifest-fixture.json'
);

test('listEmailNewsletter returns one item per newsletter', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  assert.equal(items.length, 4); // matches fixture
});

test('listEmailNewsletter sets surface=email-newsletter on every item', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  for (const item of items) {
    assert.equal(item.surface, 'email-newsletter');
  }
});

test('listEmailNewsletter outputPath uses image/email/newsletter/{slug}.jpg', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  const am = items.find((i) => i.slug === '2026-05-01-am');
  assert.equal(am.outputPath, 'image/email/newsletter/2026-05-01-am.jpg');
});

test('listEmailNewsletter reuses og.subject from the same manifest entry as the OG card', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  const am = items.find((i) => i.slug === '2026-05-01-am');
  // From fixture: og.subject = "An AM-specific director's note"
  assert.equal(am.subject, "An AM-specific director's note");
});

test('listEmailNewsletter reads status from og.emailStatus (NOT og.status)', async () => {
  // Build a temp fixture with both fields set differently, verify which one is read.
  const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(join(tmpdir(), 'email-newsletter-src-'));
  const path = join(dir, 'newsletter.json');
  await writeFile(
    path,
    JSON.stringify({
      newsletters: [
        {
          slug: '2026-05-01-pm',
          title: 'X',
          edition: 'pm',
          og: { subject: 's', status: 'ready', emailStatus: 'failed' }
        }
      ]
    })
  );
  const items = await listEmailNewsletter({ manifestPath: path });
  assert.equal(items[0].status, 'failed', 'should read og.emailStatus, not og.status');
  await rm(dir, { recursive: true, force: true });
});

test('listEmailNewsletter auto-derives accent from slug suffix (am→mint, pm→lavender)', async () => {
  const items = await listEmailNewsletter({ manifestPath: FIXTURE });
  assert.equal(items.find((i) => i.slug === '2026-05-01-am').accent, 'mint');
  assert.equal(items.find((i) => i.slug === '2026-05-01-pm').accent, 'lavender');
});
