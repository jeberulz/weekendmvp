import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildElement,
  ACCENTS,
  pickTitleFontSize,
  formatPostmarkDate,
  config
} from '../../lib/og/templates/newsletter.mjs';

test('ACCENTS mirrors the brand palette', () => {
  for (const k of ['lime', 'mint', 'lavender', 'emerald', 'aubergine']) {
    assert.ok(ACCENTS[k], `missing ${k}`);
    assert.match(ACCENTS[k], /^#[0-9A-F]{6}$/i);
  }
});

test('pickTitleFontSize uses postcard breakpoints (40/48/60)', () => {
  assert.equal(pickTitleFontSize('Short'), 60);
  assert.equal(pickTitleFontSize('A medium-length newsletter title here today'), 48);
  assert.equal(pickTitleFontSize('A really really really long newsletter title that surpasses seventy characters in total'), 40);
});

test('config has top-60% bgRect for horizontal split', () => {
  assert.equal(config.width, 1200);
  assert.equal(config.height, 630);
  assert.deepEqual(config.bgRect, { x: 0, y: 0, width: 1200, height: 378 });
  assert.equal(config.bgFill, '#050505');
});

test('formatPostmarkDate renders YYYY-MM-DD as MMM·DD·YY', () => {
  assert.equal(formatPostmarkDate('2026-05-01'), 'MAY · 01 · 26');
  assert.equal(formatPostmarkDate('2026-04-23'), 'APR · 23 · 26');
  assert.equal(formatPostmarkDate('2026-12-31'), 'DEC · 31 · 26');
});

test('formatPostmarkDate falls back gracefully on missing/invalid input', () => {
  assert.equal(formatPostmarkDate(undefined), '');
  assert.equal(formatPostmarkDate(''), '');
  assert.equal(formatPostmarkDate('not-a-date'), '');
});

test('buildElement returns 1200x630 element tree with postmark + meta + title', () => {
  const el = buildElement({
    title: 'This week in AI: 8 things you may have missed',
    accent: 'lavender',
    edition: 'pm',
    publishedAt: '2026-05-01'
  });
  assert.equal(el.type, 'div');
  assert.equal(el.props.style.width, 1200);
  assert.equal(el.props.style.height, 630);

  const json = JSON.stringify(el);
  assert.ok(json.includes('This week in AI'), 'title not found');
  assert.ok(json.includes('PM'), 'PM letters not in postmark');
  assert.ok(json.includes('PM EDITION'), 'PM EDITION label not in meta line');
  assert.ok(json.includes('FROM: WEEKEND MVP'), 'FROM line not present');
  assert.ok(json.includes('2026·05·01'), 'YYYY-MM-DD meta not rendered with middle dots');
  assert.ok(json.includes('MAY · 01 · 26'), 'postmark date not rendered with MMM·DD·YY');
  assert.ok(json.includes('#C5AEE8'), 'lavender accent not used');
  assert.ok(json.includes('GeistMono'), 'Geist Mono not used in chrome');
});

test('buildElement renders AM EDITION + mint accent for AM newsletters', () => {
  const el = buildElement({
    title: 'Idea of the Day: AI Resume Tailorer',
    accent: 'mint',
    edition: 'am',
    publishedAt: '2026-04-20'
  });
  const json = JSON.stringify(el);
  assert.ok(json.includes('AM EDITION'), 'AM EDITION not rendered');
  assert.ok(json.includes('"AM"') || json.includes('>AM<'), 'AM letters not in postmark center');
  assert.ok(json.includes('#8FF59B'), 'mint accent not used');
});

test('buildElement falls back gracefully when edition/publishedAt missing', () => {
  const el = buildElement({
    title: 'X',
    accent: 'lavender'
  });
  assert.equal(el.type, 'div');
  const json = JSON.stringify(el);
  assert.ok(json.includes('FROM: WEEKEND MVP'));
});
