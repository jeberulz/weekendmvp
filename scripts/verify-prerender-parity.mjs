#!/usr/bin/env node
/**
 * Pre/post-refactor prerender parity check.
 *
 * Usage:
 *   node scripts/verify-prerender-parity.mjs --record <path> [<path>...]
 *     Saves baseline snapshots to tmp/prerender-snapshots/<sanitized>.json
 *
 *   node scripts/verify-prerender-parity.mjs --diff <path> [<path>...]
 *     Re-fetches and diffs against the baseline. Exit 1 on regression.
 *
 * Structural signals captured (whitespace-normalized):
 *   - <title> text
 *   - first <h1> text
 *   - canonical link href
 *   - og:image content
 *   - meta description
 *   - meta robots
 *   - JSON-LD: every @graph member's @type + @id (or count when unlabeled)
 *   - presence of em-dash (—) or en-dash (–) anywhere in rendered HTML
 *
 * Requires a running Next.js dev or start server. Defaults to
 * http://localhost:4400 (override with --origin).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { argv, exit } from "node:process";

const args = argv.slice(2);
const mode = args.includes("--record")
  ? "record"
  : args.includes("--diff")
    ? "diff"
    : null;
if (!mode) {
  console.error(
    "Usage: verify-prerender-parity.mjs --record|--diff <path> [<path>...] [--origin <url>]",
  );
  exit(2);
}

const originIdx = args.indexOf("--origin");
const origin =
  originIdx >= 0 ? args[originIdx + 1] : "http://localhost:4400";

// Only --origin takes a value; --record and --diff are boolean flags.
const paths = args.filter(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--origin",
);

if (paths.length === 0) {
  console.error("No paths provided.");
  exit(2);
}

const SNAP_DIR = "tmp/prerender-snapshots";
await fs.mkdir(SNAP_DIR, { recursive: true });

function sanitize(p) {
  return p.replace(/[^a-z0-9-]+/gi, "_").replace(/^_+|_+$/g, "") || "root";
}

function norm(s) {
  return s.replace(/\s+/g, " ").trim();
}

function extract(html) {
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const canonicalMatch = html.match(
    /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/,
  );
  const ogImageMatch = html.match(
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/,
  );
  const descMatch = html.match(
    /<meta[^>]+name="description"[^>]+content="([^"]+)"/,
  );
  const robotsMatch = html.match(
    /<meta[^>]+name="robots"[^>]+content="([^"]+)"/,
  );

  // JSON-LD: collect every @type + @id pair across all script tags.
  const ldEntries = [];
  const ldRegex =
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      const visit = (node) => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        if ("@type" in node) {
          ldEntries.push({
            "@type": String(node["@type"]),
            ...(node["@id"] ? { "@id": String(node["@id"]) } : {}),
          });
        }
        if (Array.isArray(node["@graph"])) node["@graph"].forEach(visit);
      };
      visit(parsed);
    } catch {
      ldEntries.push({ "@type": "<unparseable>" });
    }
  }
  ldEntries.sort((a, b) => {
    const at = a["@type"].localeCompare(b["@type"]);
    if (at !== 0) return at;
    return (a["@id"] ?? "").localeCompare(b["@id"] ?? "");
  });

  // Strip the LD blocks before scanning the visible body for em-dashes —
  // schema JSON sometimes legitimately uses them in author descriptions.
  const visible = html
    .replace(ldRegex, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");
  const emDashCount = (visible.match(/—/g) ?? []).length;
  const enDashCount = (visible.match(/–/g) ?? []).length;

  return {
    title: titleMatch ? norm(titleMatch[1]) : null,
    h1: h1Match ? norm(h1Match[1].replace(/<[^>]+>/g, "")) : null,
    canonical: canonicalMatch ? canonicalMatch[1] : null,
    ogImage: ogImageMatch ? ogImageMatch[1] : null,
    description: descMatch ? norm(descMatch[1]) : null,
    robots: robotsMatch ? norm(robotsMatch[1]) : null,
    jsonLd: ldEntries,
    emDashCount,
    enDashCount,
    // Word-ish count for body sanity.
    visibleWordCount: visible
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean).length,
  };
}

async function fetchPage(p) {
  const url = `${origin}${p}`;
  const res = await fetch(url, { redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    // Follow one redirect (the .html → extensionless case).
    const loc = res.headers.get("location");
    if (loc) {
      const next = loc.startsWith("http") ? loc : `${origin}${loc}`;
      const res2 = await fetch(next);
      const text = await res2.text();
      return { status: res2.status, html: text, finalUrl: next };
    }
  }
  const html = await res.text();
  return { status: res.status, html, finalUrl: url };
}

function diff(a, b) {
  const issues = [];
  const fields = [
    "title",
    "h1",
    "canonical",
    "ogImage",
    "description",
    "robots",
  ];
  for (const f of fields) {
    if ((a[f] ?? null) !== (b[f] ?? null)) {
      issues.push(`${f}: "${a[f]}" → "${b[f]}"`);
    }
  }
  if (a.jsonLd.length !== b.jsonLd.length) {
    issues.push(
      `jsonLd member count: ${a.jsonLd.length} → ${b.jsonLd.length}`,
    );
  } else {
    for (let i = 0; i < a.jsonLd.length; i++) {
      const ai = JSON.stringify(a.jsonLd[i]);
      const bi = JSON.stringify(b.jsonLd[i]);
      if (ai !== bi) issues.push(`jsonLd[${i}]: ${ai} → ${bi}`);
    }
  }
  // Preserve-mode: refactor must not INCREASE dash count from baseline.
  // Pre-existing dashes in legacy copy are not regressions; new ones are.
  if (b.emDashCount > a.emDashCount) {
    issues.push(
      `em-dash regression: ${a.emDashCount} → ${b.emDashCount} (skill 9.G — no new em-dashes during refactor)`,
    );
  }
  if (b.enDashCount > a.enDashCount) {
    issues.push(
      `en-dash regression: ${a.enDashCount} → ${b.enDashCount} (skill 9.G)`,
    );
  }
  // Word count drift signal — don't fail on small variance, flag big swings.
  const drift = Math.abs(a.visibleWordCount - b.visibleWordCount);
  const pct = drift / Math.max(1, a.visibleWordCount);
  if (pct > 0.1) {
    issues.push(
      `word count drift: ${a.visibleWordCount} → ${b.visibleWordCount} (${(pct * 100).toFixed(1)}%)`,
    );
  }
  return issues;
}

let failures = 0;
for (const p of paths) {
  const file = path.join(SNAP_DIR, `${sanitize(p)}.json`);
  const { status, html, finalUrl } = await fetchPage(p);
  if (status !== 200) {
    console.error(`✗ ${p} → ${status} (${finalUrl})`);
    failures++;
    continue;
  }
  const signal = extract(html);

  if (mode === "record") {
    await fs.writeFile(file, JSON.stringify(signal, null, 2));
    console.log(`✓ recorded ${p}`);
    if (signal.emDashCount > 0) {
      console.warn(
        `  ⚠ baseline already contains ${signal.emDashCount} em-dash(es). Fix before recording.`,
      );
    }
    continue;
  }

  // diff mode
  let baseline;
  try {
    baseline = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    console.error(`✗ ${p}: no baseline (run --record first)`);
    failures++;
    continue;
  }
  const issues = diff(baseline, signal);
  if (issues.length === 0) {
    console.log(`✓ ${p}`);
  } else {
    console.error(`✗ ${p}`);
    for (const issue of issues) console.error(`    ${issue}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} route(s) regressed.`);
  exit(1);
}
console.log(`\nAll ${paths.length} route(s) clean.`);
