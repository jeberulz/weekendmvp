import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listCarouselHero, parseTable } from '../../lib/og/sources/carousel-hero.mjs';

const FIXTURE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/carousel-posts'
);

test('parseTable extracts key/value rows and stops at horizontal rule', () => {
  const md = [
    '| Field | Value |',
    '|-------|-------|',
    '| date | 2026-04-23 |',
    '| theme | Case Study |',
    '',
    '---',
    '',
    '# Slide 01',
    '| ignored | row |'
  ].join('\n');
  const out = parseTable(md);
  assert.deepEqual(out, { date: '2026-04-23', theme: 'Case Study' });
});

test('listCarouselHero returns one item per carousel post directory', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  assert.equal(items.length, 2);
});

test('listCarouselHero sets surface=carousel-hero and uses dirname as slug', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  const item = items.find((i) => i.slug === '2026-04-23_test-post');
  assert.ok(item, 'expected item with slug=2026-04-23_test-post');
  assert.equal(item.surface, 'carousel-hero');
  assert.equal(item.outputPath, 'image/social/carousel/2026-04-23_test-post.jpg');
});

test('listCarouselHero falls back to `${theme} — ${topic}` when slide_01_subject is missing', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  const fallback = items.find((i) => i.slug === '2026-04-23_test-post');
  assert.equal(
    fallback.subject,
    'Case Study / $1K Month — What $1K/mo looks like for AI Nutrition Planner for Trainers'
  );
});

test('listCarouselHero uses slide_01_subject verbatim when present', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  const explicit = items.find((i) => i.slug === '2026-04-22_with-subject');
  assert.equal(
    explicit.subject,
    'A pencil mid-stroke on a dark notebook page, single mint glow tracing the line'
  );
});

test('listCarouselHero reads accent from accent_primary; defaults to lime when missing', async () => {
  const items = await listCarouselHero({ rootDir: FIXTURE_ROOT });
  assert.equal(items.find((i) => i.slug === '2026-04-23_test-post').accent, 'lime');
  assert.equal(items.find((i) => i.slug === '2026-04-22_with-subject').accent, 'mint');
});
