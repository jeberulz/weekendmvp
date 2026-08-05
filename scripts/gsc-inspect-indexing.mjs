#!/usr/bin/env node
/**
 * Diagnose GSC sitemap + URL indexing for www Weekend MVP.
 *
 * Lists the submitted sitemap status, then runs URL Inspection on a small
 * sample of money pages. Use this when the Sitemaps UI shows
 * "N submitted / 0 indexed" — that metric often lags (or stays 0 on a brand-new
 * URL-prefix property) even when individual URLs are indexed or discovered.
 *
 * Requires the same SA key as gsc-submit-sitemap.mjs:
 *   ~/.config/gsc/service-account.json
 *
 * Usage:
 *   npm run gsc:inspect-indexing
 *   node scripts/gsc-inspect-indexing.mjs --urls=https://www.weekendmvp.app/build-with/claude,...
 *
 * See docs/runbooks/gsc-www-prefix.md
 */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SITE = process.env.GSC_SITE_URL || "https://www.weekendmvp.app/";
const SITEMAP =
  process.env.GSC_SITEMAP_URL || "https://www.weekendmvp.app/sitemap.xml";
const KEY_FILE =
  process.env.GSC_KEY_FILE ||
  join(homedir(), ".config", "gsc", "service-account.json");
const SCOPE = "https://www.googleapis.com/auth/webmasters";

const DEFAULT_URLS = [
  "https://www.weekendmvp.app/",
  "https://www.weekendmvp.app/build-with/claude",
  "https://www.weekendmvp.app/build-with/lovable",
  "https://www.weekendmvp.app/build-with/claude-code",
  "https://www.weekendmvp.app/startup-ideas",
  "https://www.weekendmvp.app/ideas/waitlist-manager",
];

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: key.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const sig = signer
    .sign(key.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const assertion = `${unsigned}.${sig}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetch(key.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

function enc(siteUrl) {
  return encodeURIComponent(siteUrl);
}

function parseUrls(argv) {
  const flag = argv.find((a) => a.startsWith("--urls="));
  if (!flag) return DEFAULT_URLS;
  return flag
    .slice("--urls=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function listSitemap(token) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${enc(SITE)}/sitemaps/${enc(SITEMAP)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function inspectUrl(token, inspectionUrl) {
  const res = await fetch(
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inspectionUrl,
        siteUrl: SITE,
        languageCode: "en-US",
      }),
    },
  );
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function summarizeInspection(json) {
  const result = json?.inspectionResult ?? {};
  const index = result.indexStatusResult ?? {};
  return {
    verdict: index.verdict,
    coverageState: index.coverageState,
    robotsTxtState: index.robotsTxtState,
    indexingState: index.indexingState,
    lastCrawlTime: index.lastCrawlTime,
    pageFetchState: index.pageFetchState,
    referringUrls: (index.referringUrls ?? []).slice(0, 3),
  };
}

async function main() {
  const urls = parseUrls(process.argv.slice(2));
  const key = JSON.parse(readFileSync(KEY_FILE, "utf8"));
  console.log(`SA:    ${key.client_email}`);
  console.log(`Site:  ${SITE}`);
  console.log(`Map:   ${SITEMAP}`);
  console.log("");

  const token = await getAccessToken(key);

  const sitemap = await listSitemap(token);
  console.log("=== Sitemap status ===");
  if (sitemap.status !== 200) {
    console.log(`HTTP ${sitemap.status}`, JSON.stringify(sitemap.json, null, 2));
  } else {
    const s = sitemap.json;
    console.log(
      JSON.stringify(
        {
          path: s.path,
          lastSubmitted: s.lastSubmitted,
          isPending: s.isPending,
          lastDownloaded: s.lastDownloaded,
          errors: s.errors,
          warnings: s.warnings,
          contents: s.contents,
        },
        null,
        2,
      ),
    );
    console.log(
      "\nNote: Sitemaps UI “indexed” can stay 0 for days on a new www URL-prefix",
    );
    console.log(
      "property even when URL Inspection shows Indexed / Discovered. Prefer",
    );
    console.log("URL Inspection (below) and the Domain property for coverage.");
  }

  console.log("\n=== URL Inspection sample ===");
  for (const inspectionUrl of urls) {
    const { status, json } = await inspectUrl(token, inspectionUrl);
    if (status !== 200) {
      console.log(`\n${inspectionUrl}`);
      console.log(`  HTTP ${status}`, JSON.stringify(json));
      continue;
    }
    console.log(`\n${inspectionUrl}`);
    console.log(`  ${JSON.stringify(summarizeInspection(json))}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
