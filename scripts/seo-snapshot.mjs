#!/usr/bin/env node
/**
 * WP56 SEO snapshot — proves a visual restyle left the crawlable surface alone.
 *
 *   node scripts/seo-snapshot.mjs capture --base http://localhost:3456 --out tmp/seo-before.json
 *   node scripts/seo-snapshot.mjs diff tmp/seo-before.json tmp/seo-after.json
 *
 * Per URL it records status, <title>, meta description, canonical, robots,
 * every JSON-LD block, the H1 text and the sorted set of internal link
 * targets. `diff` fails on any change, with two allowances:
 *   - an H1 may grow an appended tail when the old H1 text is still its prefix
 *     and the tail is exactly the italic (<em>/<i>) element that ends the H1,
 *     with nothing but whitespace after it (WP56 ruling);
 *   - a page may gain internal links (the restyle adds navigation); gains are
 *     listed but only fail with --strict-links. Lost links always fail, and
 *     so does a page that appears in only one snapshot.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import * as cheerio from "cheerio";

const EXTRA_PATHS = [
  "/",
  "/startup-ideas",
  "/articles",
  "/newsletter",
  "/about",
  "/john-iseghohi",
  "/privacy-policy",
  "/login",
  "/signup",
  "/links",
  "/this-page-does-not-exist-wp56",
];

/** Sitemap prefixes in scope; idea, article and newsletter details are sampled. */
const HUB_PREFIXES = ["/ideas-for/", "/build-with/", "/solve/"];
const SAMPLED = { "/ideas/": 0, "/articles/": 2, "/newsletter/": 2 };

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function pathsFromSitemap(base, collectionSlugs) {
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  const all = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const picked = new Set(EXTRA_PATHS);
  for (const p of all) {
    if (HUB_PREFIXES.some((pre) => p.startsWith(pre))) picked.add(p);
    if (p.startsWith("/ideas/") && collectionSlugs.has(p.slice(7))) picked.add(p);
  }
  for (const [pre, n] of Object.entries(SAMPLED)) {
    all
      .filter((p) => p.startsWith(pre) && p.length > pre.length && !collectionSlugs.has(p.slice(7)))
      .slice(0, pre === "/ideas/" ? 5 : n)
      .forEach((p) => picked.add(p));
  }
  return [...picked].sort();
}

async function collectionSlugs() {
  const src = await readFile(new URL("../lib/idea-collection-slugs.ts", import.meta.url), "utf8").catch(() => "");
  const block = src.match(/IDEA_COLLECTION_SLUGS[^=]*=\s*\[([\s\S]*?)\]/);
  return new Set(block ? [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : []);
}

const norm = (text) => text.replace(/\s+/g, " ").trim();

/**
 * Text of the italic element that ends this H1: the last <em>/<i> with no
 * non-whitespace content after it anywhere inside the heading. "" otherwise,
 * so plain text appended after an existing italic phrase is not mistaken for
 * an italic tail.
 */
function trailingItalic($, h1) {
  const em = $(h1).find("em, i").last();
  if (em.length === 0) return "";
  for (let node = em[0]; node && node !== h1; node = node.parent) {
    for (let next = node.next; next; next = next.next) {
      if (norm($(next).text()) !== "") return "";
    }
  }
  return norm(em.text());
}

function extract(html, base) {
  const $ = cheerio.load(html);
  const host = new URL(base).host;
  const links = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const u = new URL(href, base);
      if (u.host === host || u.host.endsWith("weekendmvp.app")) links.add(u.pathname);
    } catch {
      /* ignore malformed */
    }
  });
  const jsonLd = $('script[type="application/ld+json"]')
    .map((_, el) => {
      const raw = $(el).text();
      try {
        return JSON.stringify(JSON.parse(raw));
      } catch {
        return raw.trim();
      }
    })
    .get()
    .sort();
  return {
    title: $("title").first().text().trim(),
    description: $('meta[name="description"]').attr("content") ?? null,
    canonical: $('link[rel="canonical"]').attr("href") ?? null,
    robots: $('meta[name="robots"]').attr("content") ?? null,
    h1: $("h1")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get(),
    h1Italic: $("h1")
      .map((_, el) => trailingItalic($, el))
      .get(),
    jsonLd,
    links: [...links].sort(),
  };
}

async function capture() {
  const base = arg("base", "http://localhost:3456");
  const out = arg("out", "tmp/seo-snapshot.json");
  const slugs = await collectionSlugs();
  const paths = await pathsFromSitemap(base, slugs);
  const result = {};
  for (const path of paths) {
    const res = await fetch(`${base}${path}`, { redirect: "manual" });
    const html = res.status === 200 || res.status === 404 ? await res.text() : "";
    result[path] = { status: res.status, ...(html ? extract(html, base) : {}) };
    process.stdout.write(`${res.status} ${path}\n`);
  }
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(result, null, 2));
  console.log(`\n${paths.length} pages → ${out}`);
}

/** Unchanged, or the old text plus a tail that is exactly the H1's trailing italic element. */
export { extract };

export function sameH1(before = [], after = [], afterItalic = []) {
  if (before.length !== after.length) return false;
  return before.every((b, i) => {
    if (after[i] === b) return true;
    if (!after[i].startsWith(`${b} `)) return false;
    const tail = after[i].slice(b.length + 1).trim();
    return tail.length > 0 && (afterItalic[i] ?? "") === tail;
  });
}

async function diff() {
  const [, , , a, b] = process.argv;
  const before = JSON.parse(await readFile(a, "utf8"));
  const after = JSON.parse(await readFile(b, "utf8"));
  const strictLinks = process.argv.includes("--strict-links");
  const problems = [];
  const notes = [];
  for (const path of Object.keys(after)) {
    if (!before[path]) problems.push(`${path}: missing from before (new page in the snapshot)`);
  }
  for (const [path, was] of Object.entries(before)) {
    const now = after[path];
    if (!now) {
      problems.push(`${path}: missing from after`);
      continue;
    }
    for (const key of ["status", "title", "description", "canonical", "robots"]) {
      if (was[key] !== now[key]) problems.push(`${path}: ${key} ${JSON.stringify(was[key])} → ${JSON.stringify(now[key])}`);
    }
    if (JSON.stringify(was.jsonLd) !== JSON.stringify(now.jsonLd)) problems.push(`${path}: JSON-LD changed`);
    if (!sameH1(was.h1, now.h1, now.h1Italic)) problems.push(`${path}: h1 ${JSON.stringify(was.h1)} → ${JSON.stringify(now.h1)}`);
    const lost = (was.links ?? []).filter((l) => !(now.links ?? []).includes(l));
    if (lost.length) problems.push(`${path}: lost ${lost.length} internal link(s): ${lost.slice(0, 8).join(", ")}`);
    const gained = (now.links ?? []).filter((l) => !(was.links ?? []).includes(l));
    if (gained.length) {
      const line = `${path}: gained ${gained.length} internal link(s): ${gained.slice(0, 8).join(", ")}`;
      (strictLinks ? problems : notes).push(line);
    }
  }
  if (notes.length) console.log(`Link additions (allowed; --strict-links to fail):\n${notes.join("\n")}\n`);
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`\n${problems.length} SEO difference(s).`);
    process.exit(1);
  }
  console.log(`SEO snapshot unchanged across ${Object.keys(before).length} pages.`);
}

const mode = process.argv[2];
if (mode === "capture") await capture();
else if (mode === "diff") await diff();
else if (import.meta.url === `file://${process.argv[1]}`) {
  console.error("usage: seo-snapshot.mjs capture --base URL --out FILE | diff BEFORE AFTER [--strict-links]");
  process.exit(2);
}
