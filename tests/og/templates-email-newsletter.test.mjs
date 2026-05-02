import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as emailTemplate from '../../lib/og/templates/email-newsletter.mjs';

test('email-newsletter template exports a config object with 600x400 full-bleed JPG', () => {
  assert.ok(emailTemplate.config, 'config export missing');
  assert.equal(emailTemplate.config.width, 600);
  assert.equal(emailTemplate.config.height, 400);
  assert.deepEqual(emailTemplate.config.bgRect, { x: 0, y: 0, width: 600, height: 400 });
  assert.equal(emailTemplate.config.bgFill, '#050505');
  assert.equal(emailTemplate.config.format, 'jpeg');
  assert.equal(emailTemplate.config.jpegQuality, 85);
});

test('email-newsletter template has NO buildElement export (image-only surface)', () => {
  // The compose module uses the absence of buildElement as the signal that
  // this is an image-only surface — no Satori chrome rendered.
  assert.equal(emailTemplate.buildElement, undefined);
});
