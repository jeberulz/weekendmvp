/**
 * Helpers shared by the two newsletter → MDX producers:
 *
 *   scripts/extract-newsletter-to-mdx.mjs  (one-time: legacy HTML → MDX)
 *   scripts/publish-newsletter.mjs         (ongoing: author .md → MDX)
 *
 * Both must emit byte-compatible output for the same issue, so the URL
 * sanitizer and the CTA-JSX renderer live here.
 */

/**
 * Map a legacy newsletter href onto the Next.js route shape:
 *  - absolute weekendmvp.app URLs → site-relative paths
 *  - page-relative "../x.html" → "/x"
 *  - strip ".html" extensions and trailing slashes
 *  - drop Beehiiv tracking params (utm_*) and merge tokens (e={{email}})
 *  - leave external URLs, mailto: and #fragments untouched
 */
export function sanitizeNewsletterUrl(href) {
  if (!href) return href;
  let h = String(href).trim();
  if (/^(mailto:|#)/.test(h)) return h;

  const own = h.match(/^https?:\/\/(?:www\.)?weekendmvp\.app(\/.*)?$/i);
  if (!own && /^(?:https?:)?\/\//i.test(h)) return h; // external — untouched

  h = own ? own[1] || "/" : h.replace(/^\.\.\//, "/").replace(/^\.\//, "/");
  if (!h.startsWith("/")) h = `/${h}`;

  const hashIdx = h.indexOf("#");
  const hash = hashIdx === -1 ? "" : h.slice(hashIdx);
  if (hashIdx !== -1) h = h.slice(0, hashIdx);

  const qIdx = h.indexOf("?");
  const query = qIdx === -1 ? "" : h.slice(qIdx + 1);
  let p = (qIdx === -1 ? h : h.slice(0, qIdx)).replace(/\.html$/i, "");
  if (p === "" || p === "/index") p = "/";
  if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);

  const params = query
    .split("&")
    .filter((kv) => kv && !/^(utm_[a-z]+|e)=/i.test(kv));
  return p + (params.length ? `?${params.join("&")}` : "") + hash;
}

/**
 * A standalone CTA button (legacy `<div class="text-center"><a>…</a></div>`,
 * author markdown `[label →](url)`) becomes an explicit MDX JSX element the
 * issue page resolves to the legacy white pill button.
 */
export function ctaJsx(href, label) {
  const text = String(label).trim();
  // JSX-significant characters in the label go through a string expression.
  const child = /[<>{}]/.test(text) ? `{${JSON.stringify(text)}}` : text;
  return `<Cta href="${href}">${child}</Cta>`;
}

/** "2026-05-22" + "am|pm" → the issue slug used everywhere. */
export function issueSlug(date, slot) {
  return `${date}-${slot}`;
}

/** Build the sanitized public frontmatter block (string) for an issue MDX. */
export function buildIssueFrontmatter({
  slug,
  title,
  description,
  publishedAt,
  edition,
  ctaUrl,
}) {
  const line = (key, value) =>
    value === undefined || value === null
      ? null
      : `${key}: ${JSON.stringify(value)}`;
  return [
    "---",
    line("slug", slug),
    line("title", title),
    line("description", description),
    line("publishedAt", publishedAt),
    line("edition", edition),
    ctaUrl ? line("ctaUrl", ctaUrl) : null,
    "---",
  ]
    .filter(Boolean)
    .join("\n");
}
