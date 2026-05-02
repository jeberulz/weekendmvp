const ENDPOINT = 'https://external.api.recraft.ai/v1/images/generations';

export async function generate({
  prompt,
  apiKey = process.env.RECRAFT_API_KEY,
  styleId = process.env.RECRAFT_STYLE_ID,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!apiKey) {
    throw new Error('RECRAFT_API_KEY not set — see IMAGES.md setup section');
  }
  const body = {
    prompt,
    n: 1,
    model: 'recraftv3',
    response_format: 'b64_json',
    size: '1707x1024'
  };
  if (styleId) {
    body.style_id = styleId;
  } else {
    body.style = 'realistic_image';
  }
  const r = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Recraft error ${r.status}: ${txt.slice(0, 300)}`);
  }
  const json = await r.json();
  return Buffer.from(json.data[0].b64_json, 'base64');
}
