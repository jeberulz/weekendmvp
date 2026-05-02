import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as carouselHeroTemplate from '../../lib/og/templates/carousel-hero.mjs';

test('carousel-hero template exports a config object with 1080x1350 full-bleed JPEG', () => {
  assert.ok(carouselHeroTemplate.config, 'config export missing');
  assert.equal(carouselHeroTemplate.config.width, 1080);
  assert.equal(carouselHeroTemplate.config.height, 1350);
  assert.deepEqual(carouselHeroTemplate.config.bgRect, { x: 0, y: 0, width: 1080, height: 1350 });
  assert.equal(carouselHeroTemplate.config.bgFill, '#050505');
  assert.equal(carouselHeroTemplate.config.format, 'jpeg');
  assert.equal(carouselHeroTemplate.config.jpegQuality, 88);
});

test('carousel-hero template has NO buildElement export (image-only surface)', () => {
  // The compose module uses the absence of buildElement as the signal that
  // this is an image-only surface — no Satori chrome rendered.
  assert.equal(carouselHeroTemplate.buildElement, undefined);
});
