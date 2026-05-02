const ENDPOINT = 'https://api.openai.com/v1/images/generations';

export async function generate({
  prompt,
  apiKey = process.env.OPENAI_API_KEY,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set — see IMAGES.md setup section');
  }
  const r = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1536x1024',
      quality: 'medium',
      output_format: 'png',
      moderation: 'auto'
    })
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${txt.slice(0, 300)}`);
  }
  const json = await r.json();
  return Buffer.from(json.data[0].b64_json, 'base64');
}
