const privacy = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export function privateJson(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { ...privacy, ...headers } });
}

export function privateNotFound() {
  return new Response(null, { status: 404, headers: privacy });
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (!origin || (site && site !== "same-origin")) return false;

  const url = new URL(request.url);
  // Next can build request.url with its listener hostname behind a proxy.
  // The browser sends Host for the address it actually fetched.
  const host = request.headers.get("host") ?? url.host;
  return origin === `${url.protocol}//${host}`;
}
