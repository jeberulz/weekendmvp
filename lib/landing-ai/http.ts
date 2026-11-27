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
  return request.headers.get("origin") === new URL(request.url).origin;
}
