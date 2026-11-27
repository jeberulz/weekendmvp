// The editor reads its access token in the browser and sends commits to GitHub.
// Limit that readable cookie to the editor. Logout also needs a server-only
// copy at the API, which shares the refresh cookie's narrower path.
export function scopeEditorCookies(headers: Headers) {
  const cookies = headers.getSetCookie();
  if (!cookies.length) return;
  headers.delete("set-cookie");
  for (const cookie of cookies) {
    const name = cookie.slice(0, cookie.indexOf("="));
    if (name !== "keystatic-gh-access-token" && name !== "keystatic-gh-refresh-token") {
      headers.append("set-cookie", cookie);
      continue;
    }
    const attributes = cookie.replace(/;\s*Path=[^;]*/ig, "").replace(/;\s*HttpOnly\b/ig, "");
    if (name === "keystatic-gh-access-token") {
      headers.append("set-cookie", attributes + "; Path=/admin/pages");
      headers.append("set-cookie", attributes + "; Path=/api/admin/page-ai; HttpOnly");
    }
    headers.append("set-cookie", attributes + "; Path=/api/keystatic; HttpOnly");
  }
}
