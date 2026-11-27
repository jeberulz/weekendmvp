import { resolve } from "node:path";
import { makeRouteHandler } from "@keystatic/next/route-handler";
import { landingContentDirectory, landingEditorConfig } from "@/keystatic.config";
import { scopeEditorCookies } from "@/lib/landing/editor-cookies";
import { isPublicEditorOAuth } from "@/lib/landing/editor-policy";
import { configuredEditorMode, editorAccessAllowed } from "@/lib/landing/editor-server";

const privacyHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

async function dispatch(request: Request): Promise<Response> {
  const mode = configuredEditorMode();
  const url = new URL(request.url);
  if (!mode || (!isPublicEditorOAuth(mode, request.method, url) && !(await editorAccessAllowed()))) {
    return new Response(null, { status: 404, headers: privacyHeaders });
  }
  const handlers = makeRouteHandler({
    config: landingEditorConfig(mode),
    localBaseDirectory: resolve(landingContentDirectory),
  });
  const response = await handlers[request.method === "POST" ? "POST" : "GET"](request);
  scopeEditorCookies(response.headers);
  for (const [key, value] of Object.entries(privacyHeaders)) response.headers.set(key, value);
  return response;
}

export { dispatch as GET, dispatch as POST };
