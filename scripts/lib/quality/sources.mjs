/**
 * Source hygiene for the ## Sources list: distinct domains, duplicate URLs,
 * placeholder hosts, homepage-only links, and Ideabrowser self-citation.
 *
 * Site-relative cross-links are ignored. A homepage link
 * ("https://grandviewresearch.com/") cannot back a specific number, and an
 * Ideabrowser link is our upstream data vendor, not a primary source.
 */

const LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g;

function normaliseUrl(url) {
  return url.toString().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
}

export function checkSources(sourcesContent, { placeholderHosts }) {
  // Site-relative links ("/ideas/other-idea") are cross-links, not citations.
  const links = [...(sourcesContent ?? "").matchAll(LINK_RE)]
    .map((m) => ({ text: m[1], href: m[2] }))
    .filter((link) => !link.href.startsWith("/") && !link.href.startsWith("#"));

  const invalid = [];
  const placeholder = [];
  const homepageOnly = [];
  const hosts = new Set();
  const seen = new Map();
  let ideabrowser = 0;

  for (const link of links) {
    let url;
    try {
      url = new URL(link.href);
    } catch {
      invalid.push(link.href);
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      invalid.push(link.href);
      continue;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    hosts.add(host);

    if (placeholderHosts.some((p) => host === p || host.endsWith(`.${p}`))) {
      placeholder.push(link.href);
    }
    if ((url.pathname === "/" || url.pathname === "") && !url.search) {
      homepageOnly.push(link.href);
    }
    if (host.includes("ideabrowser")) ideabrowser += 1;

    const key = normaliseUrl(url);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  const valid = links.length - invalid.length;
  const share = (n) => (valid > 0 ? Math.round((n / valid) * 100) / 100 : 0);

  return {
    linkCount: links.length,
    distinctDomains: hosts.size,
    duplicates: [...seen.entries()].filter(([, n]) => n > 1).map(([u]) => u),
    invalid,
    placeholder,
    homepageOnly,
    homepageOnlyShare: share(homepageOnly.length),
    ideabrowserShare: share(ideabrowser),
  };
}
