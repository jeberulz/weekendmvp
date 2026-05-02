import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../../lib/og/providers/openai.mjs';

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

test('generate returns Buffer on success', async () => {
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: Buffer.from('png').toString('base64') }] })
  );
  const buf = await generate({
    prompt: 'subject',
    apiKey: 'k',
    fetchImpl
  });
  assert.ok(Buffer.isBuffer(buf));
});

test('generate sends gpt-image-1 model and medium quality', async () => {
  const fetchImpl = mockFetch(
    jsonResponse({ data: [{ b64_json: Buffer.from('p').toString('base64') }] })
  );
  await generate({ prompt: 'x', apiKey: 'k', fetchImpl });
  const body = JSON.parse(mockFetch.lastCall.init.body);
  assert.equal(body.model, 'gpt-image-1');
  assert.equal(body.quality, 'medium');
  assert.equal(body.size, '1536x1024');
});

test('generate throws on non-OK response', async () => {
  const fetchImpl = mockFetch(jsonResponse({ error: 'bad' }, 500));
  await assert.rejects(
    generate({ prompt: 'x', apiKey: 'k', fetchImpl }),
    /OpenAI error 500/
  );
});

test('generate throws when apiKey is missing', async () => {
  await assert.rejects(
    generate({ prompt: 'x' }),
    /OPENAI_API_KEY/
  );
});
