/**
 * Cross-page near-duplication via word shingles.
 *
 * Each page's prose becomes a set of overlapping k-word shingles. The index
 * maps shingle -> pages, so one pass finds, for every page, the other page
 * it shares the most shingles with. A high share means copied or templated
 * text.
 */

export function shingles(text, k) {
  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
  const out = new Set();
  for (let i = 0; i + k <= words.length; i++) {
    out.add(words.slice(i, i + k).join(" "));
  }
  return out;
}

/** pages: [{ slug, prose }] -> { index: Map<shingle, Set<slug>>, bySlug } */
export function buildShingleIndex(pages, k) {
  const index = new Map();
  const bySlug = new Map();
  for (const page of pages) {
    const set = shingles(page.prose, k);
    bySlug.set(page.slug, set);
    for (const s of set) {
      if (!index.has(s)) index.set(s, new Set());
      index.get(s).add(page.slug);
    }
  }
  return { index, bySlug };
}

/**
 * Share of this page's shingles found in the single most similar other
 * page. `set` defaults to the page's indexed shingles.
 */
export function checkDuplication(slug, { index, bySlug }, set = bySlug.get(slug)) {
  if (!set || set.size === 0) {
    return { maxPairShare: 0, maxPairSlug: null };
  }
  const overlap = new Map();
  for (const s of set) {
    const owners = index.get(s);
    if (!owners) continue;
    for (const other of owners) {
      if (other === slug) continue;
      overlap.set(other, (overlap.get(other) ?? 0) + 1);
    }
  }
  let maxPairSlug = null;
  let best = 0;
  for (const [other, n] of overlap) {
    if (n > best || (n === best && maxPairSlug !== null && other < maxPairSlug)) {
      best = n;
      maxPairSlug = other;
    }
  }
  return {
    maxPairShare: Math.round((best / set.size) * 1000) / 1000,
    maxPairSlug,
  };
}
