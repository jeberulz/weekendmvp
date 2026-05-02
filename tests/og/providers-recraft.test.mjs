import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../../lib/og/providers/recraft.mjs';

const FAKE_KEY = 'test-key';
const FAKE_STYLE = 'aaaa-bbbb';

function mockFetch(response) {
  return async (url, init) => {
    mockFetch.lastCall = { url, init };
    return response;
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

test('generate returns a Buffer on success', async () => {
  const fakePng = Buffer.from('fake-png-bytes');
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: fakePng.toString('base64') }] })
  );
  const buf = await generate({
    prompt: 'a glowing terminal',
    apiKey: FAKE_KEY,
    styleId: FAKE_STYLE,
    fetchImpl
  });
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.toString(), 'fake-png-bytes');
});

test('generate sends model + size + style_id when styleId provided', async () => {
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: Buffer.from('x').toString('base64') }] })
  );
  await generate({
    prompt: 'subject',
    apiKey: FAKE_KEY,
    styleId: FAKE_STYLE,
    fetchImpl
  });
  const body = JSON.parse(mockFetch.lastCall.init.body);
  assert.equal(body.model, 'recraftv3');
  assert.equal(body.size, '1707x1024');
  assert.equal(body.style_id, FAKE_STYLE);
  assert.equal(body.response_format, 'b64_json');
  assert.equal(mockFetch.lastCall.init.headers.Authorization, `Bearer ${FAKE_KEY}`);
});

test('generate falls back to style:realistic_image when no styleId', async () => {
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: Buffer.from('x').toString('base64') }] })
  );
  await generate({
    prompt: 'subject',
    apiKey: FAKE_KEY,
    fetchImpl
  });
  const body = JSON.parse(mockFetch.lastCall.init.body);
  assert.equal(body.style, 'realistic_image');
  assert.equal(body.style_id, undefined);
});

test('generate throws on non-OK response', async () => {
  const fetchImpl = mockFetch(jsonResponse({ error: 'rate limited' }, 429));
  await assert.rejects(
    generate({ prompt: 'x', apiKey: FAKE_KEY, fetchImpl }),
    /Recraft error 429/
  );
});

test('generate throws when apiKey is missing', async () => {
  await assert.rejects(
    generate({ prompt: 'x' }),
    /RECRAFT_API_KEY/
  );
});
