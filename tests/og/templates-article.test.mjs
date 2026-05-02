import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildElement,
  ACCENTS,
  pickTitleFontSize,
  config
} from '../../lib/og/templates/article.mjs';

test('ACCENTS map mirrors the brand palette', () => {
  for (const k of ['lime', 'mint', 'lavender', 'emerald', 'aubergine']) {
    assert.ok(ACCENTS[k], `missing ${k}`);
    assert.match(ACCENTS[k], /^#[0-9A-F]{6}$/i);
  }
});

test('pickTitleFontSize uses narrow-panel breakpoints (44/52/64)', () => {
  // Article panel is only 480px wide, so titles wrap sooner than ideas.
  assert.equal(pickTitleFontSize('Short'), 64);
  assert.equal(pickTitleFontSize('A medium-length article title here'), 52);
  assert.equal(pickTitleFontSize('A really really really long article title that surpasses seventy characters in total'), 44);
});

test('config has the right-60% bgRect and 1200x630 frame', () => {
  assert.equal(config.width, 1200);
  assert.equal(config.height, 630);
  assert.deepEqual(config.bgRect, { x: 480, y: 0, width: 720, height: 630 });
  assert.equal(config.bgFill, '#050505');
});

test('buildElement returns 1200x630 element tree with title + ARTICLE label + read time', () => {
  const el = buildElement({
    title: 'A Test Article Title',
    accent: 'lavender',
    readMinutes: 6
  });
  assert.equal(el.type, 'div');
  assert.equal(el.props.style.width, 1200);
  assert.equal(el.props.style.height, 630);

  const json = JSON.stringify(el);
  assert.ok(json.includes('A Test Article Title'), 'title not found');
  assert.ok(json.includes('ARTICLE'), 'ARTICLE label not found');
  assert.ok(json.includes('6 MIN READ'), 'read-time chip not found');
  assert.ok(json.includes('#C5AEE8'), 'lavender accent not used');
  assert.ok(json.includes('GeistMono'), 'Geist Mono not used (label/chip should use it)');
});

test('buildElement defaults to lime + 5 MIN READ when accent unknown / readMinutes missing', () => {
  const el = buildElement({
    title: 'X',
    accent: 'unknown',
    readMinutes: undefined
  });
  const json = JSON.stringify(el);
  assert.ok(json.includes('#D4FF5B'), 'lime fallback not applied');
  assert.ok(json.includes('5 MIN READ'), 'read-time fallback (5) not applied');
});
