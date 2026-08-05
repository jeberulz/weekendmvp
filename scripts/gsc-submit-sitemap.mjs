#!/usr/bin/env node
/**
 * Submit https://www.weekendmvp.app/sitemap.xml via Search Console Sitemaps API.
 *
 * Requires:
 *   - URL-prefix property https://www.weekendmvp.app/ verified in GSC
 *   - Service account Owner on that property
 *   - GSC_KEY_FILE pointing at the SA JSON (default ~/.config/gsc/service-account.json)
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
  join(homedir(), ".config/gsc/service-account.json");
const SCOPE = "https://www.googleapis.com/auth/webmasters";

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

async function gsc(token, method, path) {
  const url = `https://www.googleapis.com/webmasters/v3${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function enc(siteUrl) {
  return encodeURIComponent(siteUrl);
}

async function main() {
  const key = JSON.parse(readFileSync(KEY_FILE, "utf8"));
  console.log(`SA:   ${key.client_email}`);
  console.log(`Site: ${SITE}`);
  console.log(`Map:  ${SITEMAP}`);

  const token = await getAccessToken(key);

  const got = await gsc(token, "GET", `/sites/${enc(SITE)}`);
  console.log("\n=== site.get ===");
  console.log(got.status, JSON.stringify(got.json, null, 2));
  if (got.status !== 200) {
    console.error(
      "\nProperty missing or inaccessible. Complete docs/runbooks/gsc-www-prefix.md owner steps.",
    );
    process.exit(1);
  }
  const level = got.json?.permissionLevel;
  if (level === "siteUnverifiedUser") {
    console.error(
      "\nProperty is unverified for this SA. Verify in GSC UI and grant Owner to the SA.",
    );
    process.exit(1);
  }

  const listed = await gsc(token, "GET", `/sites/${enc(SITE)}/sitemaps`);
  console.log("\n=== sitemaps.list (before) ===");
  console.log(listed.status, JSON.stringify(listed.json, null, 2));
  if (listed.status === 403) {
    console.error(
      "\nSitemaps API forbidden. Grant Owner on the www URL-prefix property to the SA.",
    );
    process.exit(1);
  }

  const put = await gsc(
    token,
    "PUT",
    `/sites/${enc(SITE)}/sitemaps/${enc(SITEMAP)}`,
  );
  console.log("\n=== sitemaps.submit ===");
  console.log(put.status, JSON.stringify(put.json, null, 2) || "(empty)");
  if (put.status >= 400) {
    process.exit(1);
  }

  const after = await gsc(token, "GET", `/sites/${enc(SITE)}/sitemaps`);
  console.log("\n=== sitemaps.list (after) ===");
  console.log(after.status, JSON.stringify(after.json, null, 2));
  console.log("\nOK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
