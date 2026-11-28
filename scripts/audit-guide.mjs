#!/usr/bin/env node
/**
 * Guide auditor (WP103-S2). Checks a guide's spec and copy deck against the shared rules in
 * lib/guides/audit.ts. With --live it also loads a running URL in a headless browser and checks
 * the unlock behaviour in lib/guides/audit-live.ts.
 *
 * Imports TypeScript modules, so run it with `node --experimental-strip-types`
 * (npm run audit:guide). Exit 0 on pass, 1 on any error finding, 2 on a usage error,
 * 3 when --live cannot find Playwright.
 *
 * Usage:
 *   npm run audit:guide -- --slug=5-to-9-builder
 *   npm run audit:guide -- --slug=5-to-9-builder --json
 *   npm run audit:guide -- --slug=5-to-9-builder --now=2026-11-10   (judge offer status as of that date)
 *   npm run audit:guide -- --slug=5-to-9-builder --offers-on         (judge it as if every offer switch were on)
 *   npm run audit:guide -- --slug=5-to-9-builder --live --url=http://localhost:3000/guides/5-to-9-builder
 *   npm run audit:guide -- --slug=... --live --url=... --email=you@example.com   (submits that address)
 *   npm run audit:guide -- --slug=... --live --url=... --proxy=http://host:port  (browser goes through a proxy)
 *
 * --live never submits a subscription unless --email is passed. Without it, the unlocked state is
 * checked by setting the stored "already subscribed" flag in the browser, which subscribes nobody.
 * Use an address you control with --email: the page's form really subscribes it.
 * --proxy is an explicit flag, the script reads no environment variables. With a proxy that
 * intercepts HTTPS, the browser is told to accept the proxy's certificate.
 * Playwright is not a repo dependency. --live loads it from wherever Node can resolve it.
 */

import fs from "node:fs";
import { createRequire, register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage(message) {
  if (message) console.error(`audit-guide: ${message}\n`);
  console.error(
    "usage: npm run audit:guide -- --slug=<slug> [--json] [--live --url=<page url> [--email=<address>] [--proxy=<url>]]",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = { json: false, live: false };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = () => inline ?? argv[++i];
    if (flag === "--json") args.json = true;
    else if (flag === "--live") args.live = true;
    else if (flag === "--slug") args.slug = value();
    else if (flag === "--url") args.url = value();
    else if (flag === "--email") args.email = value();
    else if (flag === "--now") args.now = value();
    else if (flag === "--offers-on") args.offersOn = true;
    else if (flag === "--proxy") args.proxy = value();
    else if (flag === "--help" || flag === "-h") usage();
    else usage(`unknown argument: ${argv[i]}`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.slug || !/^[a-z0-9-]+$/.test(args.slug)) usage("--slug is required and must be lowercase words and hyphens");
if (args.live && !args.url) usage("--live needs --url (the page to load)");
if (args.email && !args.live) usage("--email only applies with --live");
let now = Date.now();
if (args.now !== undefined) {
  now = Date.parse(`${args.now}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.now) || Number.isNaN(now)) usage("--now must be a date like 2026-11-10");
}
if (args.proxy && !args.live) usage("--proxy only applies with --live");

const guideDir = path.join(ROOT, "app", "(marketing)", "guides", args.slug);
if (!fs.existsSync(path.join(guideDir, "guide.spec.ts"))) usage(`no guide.spec.ts in ${path.relative(ROOT, guideDir)}`);

// Lets plain Node resolve the `@/` alias, so the audit can load lib/live/config.ts for prices and offer status.
register(pathToFileURL(path.join(ROOT, "scripts", "lib", "alias-hooks.mjs")), { data: { root: ROOT } });

const load = (file) => import(pathToFileURL(file).href);
const { auditGuide } = await load(path.join(ROOT, "lib", "guides", "audit.ts"));
const { resolvePrice, effectiveStatus, isOfferEnabled } = await load(path.join(ROOT, "lib", "guides", "offer-live.ts"));
const { appRouteExists } = await load(path.join(ROOT, "lib", "guides", "routes.ts"));
const { evaluateLive } = await load(path.join(ROOT, "lib", "guides", "audit-live.ts"));
const migrated = args.slug === "5-to-9-builder";
let guideSpec;
let guideCopy;
let cardCopy;
if (migrated) {
  const { readBuilderGuide } = await load(path.join(ROOT, "lib", "landing", "read-builder-guide.ts"));
  const { spec, deck, cards } = await readBuilderGuide(ROOT);
  guideSpec = spec;
  guideCopy = deck;
  cardCopy = Object.values(cards).flatMap((copy) => Object.values(copy));
} else {
  ({ guideSpec } = await load(path.join(guideDir, "guide.spec.ts")));
  ({ guideCopy } = await load(path.join(guideDir, "guideCopy.ts")));
}

const sources = fs
  .readdirSync(guideDir)
  .filter((file) => /\.(?:ts|tsx)$/.test(file))
  .map((file) => ({ file: path.relative(ROOT, path.join(guideDir, file)), text: fs.readFileSync(path.join(guideDir, file), "utf8") }));

// A guide's research record and its sealed Source Critic review live in guides/records/. With a record the audit
// requires a sealed PASS and checks the copy against the claims. Without one, claims are not checked.
const recordFile = path.join(ROOT, "guides", "records", `${args.slug}.json`);
const reviewFile = path.join(ROOT, "guides", "records", `${args.slug}.source-review.json`);
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const research = fs.existsSync(recordFile)
  ? { record: readJson(recordFile), review: fs.existsSync(reviewFile) ? readJson(reviewFile) : null, now }
  : undefined;

const result = auditGuide({
  research,
  spec: guideSpec,
  allowReorderedSections: migrated,
  cardCopy,
  deck: guideCopy,
  fileExists: (publicPath) => fs.existsSync(path.join(ROOT, "public", publicPath)),
  sources,
  now,
  resolvePrice,
  effectiveStatus,
  routeExists: (urlPath) => appRouteExists(path.join(ROOT, "app"), urlPath),
  // --offers-on judges the guide as if every offer switch were on, to check before flipping one in lib/live/config.ts.
  isOfferEnabled: args.offersOn ? () => true : isOfferEnabled,
});
const findings = [...result.findings];
if (!research) {
  findings.push({
    rule: "research-none",
    severity: "info",
    message: `no research record at guides/records/${args.slug}.json, so this guide's claims are not checked against sources`,
  });
}

async function collectSnapshot(chromium, spec, { url, email, proxy }) {
  const viaProxy = Boolean(proxy);
  const browser = await chromium.launch(viaProxy ? { proxy: { server: proxy } } : {});
  // Behind an intercepting proxy the browser needs this to accept the proxy's certificate.
  const contextOptions = { ignoreHTTPSErrors: viaProxy };
  const pageErrors = [];
  const flagSubscribed = () => localStorage.setItem("weekendmvp_subscribed", "true");

  const state = (page) =>
    page.evaluate(() => {
      const visible = (el) => el.offsetParent !== null;
      return {
        mode: document.querySelector(".builder-guide")?.getAttribute("data-guide") ?? null,
        visibleSections: [...document.querySelectorAll("section.guide-section")].filter(visible).map((s) => s.id).filter(Boolean),
        text: document.body.innerText,
        imageAlts: [...document.images].map((img) => img.alt),
      };
    });

  try {
    // A fresh visitor.
    const fresh = await browser.newContext({ ...contextOptions, viewport: { width: 1280, height: 900 } });
    const page = await fresh.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const locked = await state(page);

    let unlocked;
    let returning;
    let subscribe = null;
    if (email && spec.gate.mode !== "none") {
      const gate = page.locator("#gate");
      await gate.locator("input[type=email]").first().fill(email);
      const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/api/subscribe"), { timeout: 20000 }).catch(() => null);
      await gate.getByRole("button", { name: /unlock/i }).first().click();
      const done = await response;
      subscribe = { status: done ? done.status() : null };
      await page
        .waitForFunction(() => ["confirmed", "pending"].includes(document.querySelector(".builder-guide")?.getAttribute("data-guide") ?? ""), null, { timeout: 20000 })
        .catch(() => {});
      unlocked = await state(page);
      await page.reload({ waitUntil: "networkidle" });
      returning = await state(page);
    } else {
      const known = await browser.newContext({ ...contextOptions, viewport: { width: 1280, height: 900 } });
      await known.addInitScript(flagSubscribed);
      const knownPage = await known.newPage();
      knownPage.on("pageerror", (error) => pageErrors.push(error.message));
      await knownPage.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      unlocked = await state(knownPage);
      await knownPage.reload({ waitUntil: "networkidle" });
      returning = await state(knownPage);
    }

    // Phone width, on the unlocked page so the whole body is measured. Subscribes nobody.
    const phone = await browser.newContext({ ...contextOptions, viewport: { width: 390, height: 844 } });
    await phone.addInitScript(flagSubscribed);
    const phonePage = await phone.newPage();
    await phonePage.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    const mobileSidewaysScroll = await phonePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    return { url, pageErrors, locked, unlocked, returning, mobileSidewaysScroll, subscribe };
  } finally {
    await browser.close();
  }
}

if (args.live && result.spec) {
  const require = createRequire(import.meta.url);
  let chromium = null;
  try {
    chromium = require("playwright").chromium;
  } catch {
    // Not installed under that name, try the test package.
  }
  if (!chromium) {
    try {
      chromium = require("@playwright/test").chromium;
    } catch {
      // Neither is installed. Reported below.
    }
  }
  if (!chromium) {
    console.error("audit-guide: --live needs Playwright, and Node could not resolve `playwright` or `@playwright/test` from here.");
    process.exit(3);
  }
  const snapshot = await collectSnapshot(chromium, result.spec, { url: args.url, email: args.email, proxy: args.proxy });
  findings.push(...evaluateLive(result.spec, snapshot));
}

const errors = findings.filter((finding) => finding.severity === "error");

if (args.json) {
  console.log(JSON.stringify({ slug: args.slug, live: args.live, ok: errors.length === 0, findings }, null, 2));
} else {
  for (const finding of findings) {
    const where = finding.path ? ` (${finding.path})` : "";
    console.log(`${finding.severity.padEnd(5)}  ${finding.rule}${where}: ${finding.message}`);
  }
  const warns = findings.filter((f) => f.severity === "warn").length;
  console.log(
    errors.length === 0
      ? `PASS ${args.slug}${args.live ? " (static + live)" : " (static)"}: 0 errors, ${warns} warnings`
      : `FAIL ${args.slug}: ${errors.length} errors, ${warns} warnings`,
  );
}
process.exit(errors.length === 0 ? 0 : 1);
