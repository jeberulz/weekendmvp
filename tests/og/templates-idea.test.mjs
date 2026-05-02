import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildElement, ACCENTS, pickTitleFontSize } from '../../lib/og/templates/idea.mjs';

test('ACCENTS map contains all five brand accents', () => {
  for (const k of ['lime', 'mint', 'lavender', 'emerald', 'aubergine']) {
    assert.ok(ACCENTS[k], `missing ${k}`);
    assert.match(ACCENTS[k], /^#[0-9A-F]{6}$/i);
  }
});

test('pickTitleFontSize shrinks for long titles', () => {
  assert.equal(pickTitleFontSize('Short Title'), 64);
  assert.equal(pickTitleFontSize('A title that is somewhere in the middle range here'), 52);
  assert.equal(pickTitleFontSize('A really really really really long title that surpasses one hundred characters in total'), 40);
});

test('buildElement returns an element tree with title and 1200x630 frame', () => {
  const el = buildElement({
    title: 'Test Title',
    accent: 'lime'
  });
  assert.equal(el.type, 'div');
  assert.equal(el.props.style.width, 1200);
  assert.equal(el.props.style.height, 630);
  // Title text should appear somewhere in the tree.
  const json = JSON.stringify(el);
  assert.ok(json.includes('Test Title'), 'title not found in element tree');
  assert.ok(json.includes('#D4FF5B'), 'lime accent color not used');
  // Root must be transparent so sharp can composite over the Recraft bg.
  assert.equal(el.props.style.backgroundColor, undefined, 'root must be transparent');
  assert.equal(el.props.style.backgroundImage, undefined, 'root must not declare a backgroundImage');
});

test('buildElement defaults to lime when accent is unknown', () => {
  const el = buildElement({
    title: 'X',
    accent: 'unknown-accent'
  });
  assert.ok(JSON.stringify(el).includes('#D4FF5B'));
});
