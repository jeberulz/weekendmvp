import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLE_BLUEPRINT } from '../../lib/og/style-blueprint.mjs';

test('STYLE_BLUEPRINT is a non-empty string', () => {
  assert.equal(typeof STYLE_BLUEPRINT, 'string');
  assert.ok(STYLE_BLUEPRINT.length > 200, 'blueprint should be substantial');
});

test('STYLE_BLUEPRINT contains terminal-photographic markers', () => {
  // These strings anchor the brand. Changing them is a deliberate brand decision,
  // not an incidental edit.
  assert.match(STYLE_BLUEPRINT, /#050505/);
  assert.match(STYLE_BLUEPRINT, /cinematic|photograph/i);
  assert.match(STYLE_BLUEPRINT, /accent/i);
  assert.match(STYLE_BLUEPRINT, /No\s+(people|faces)/i);
  assert.match(STYLE_BLUEPRINT, /No\s+(visible\s+)?text/i);
});

test('STYLE_BLUEPRINT mentions all three accent colors', () => {
  assert.match(STYLE_BLUEPRINT, /#D4FF5B/i); // lime
  assert.match(STYLE_BLUEPRINT, /#C5AEE8/i); // lavender
  assert.match(STYLE_BLUEPRINT, /#8FF59B/i); // mint
});
