import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";
import { readOnlyGitHubFixture } from "./github-fixture.mjs";

const mode = process.argv[2];
assert(["dev-local", "dev-github", "build", "prod-github", "prod-disabled"].includes(mode),
  "Expected dev-local, dev-github, build, prod-github or prod-disabled");

// The build embeds the Convex URL and public App slug. Use the same isolated
// ports in every invocation so the resulting artifact can exercise both starts.
const appPort = 44074;
const convexPort = 44075;
const origin = `http://127.0.0.1:${appPort}`;
const singleton = process.argv[3] ?? "guide-5-to-9-builder";
assert(singleton === "guide-5-to-9-builder" || (mode === "dev-local" && ["starter-5-to-9", "starter-kit", "shipable", "dare", "live-hub", "live-48-hours", "live-build-along", "home"].includes(singleton)),
  "The selected content singleton is supported in dev-local mode");
const fixtureFile = `content/landing-pages/${singleton}/index.json`;
const github = mode.includes("github") || mode === "build";
const iat = Math.floor(Date.now() / 1000);
function credential(subject) {
  const payload = Buffer.from(JSON.stringify({ sub: subject, iat, exp: iat + 3600 })).toString("base64url");
  return `eyJhbGciOiJub25lIn0.${payload}.${randomUUID()}`;
}
const operator = credential("test-operator");
const member = credential("test-member");
const inputFiles = await readdir(".");
assert(!inputFiles.some((name) => /^\.env(?:$|\.(?:local|production|development)(?:\.|$))/.test(name)),
  "Run in an isolated worktree without Next environment files.");
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_CONVEX_URL: `http://127.0.0.1:${convexPort}`,
  // Exercise the actual account requirement even with the general editorial demo enabled.
  EDITORIAL_FIXTURE_MODE: "local-demo",
  ...(github ? {
    NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG: "weekend-spike",
    KEYSTATIC_GITHUB_CLIENT_ID: "spike-client",
    KEYSTATIC_GITHUB_CLIENT_SECRET: "spike-secret",
    KEYSTATIC_SECRET: "synthetic-spike-secret-abcdefghijklmnopqrstuvwxyz",
  } : {}),
};

const sessionServer = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (req.method !== "POST" || req.url !== "/api/query" ||
      JSON.parse(body || "{}").path !== "editorial/reads:session") {
    res.writeHead(404).end();
    return;
  }
  const token = req.headers.authorization;
  const value = {
    signedIn: token === `Bearer ${operator}` || token === `Bearer ${member}`,
    editor: token === `Bearer ${operator}` ? { id: "test-operator" } : null,
  };
  res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "success", value }));
});

function cookies(token) {
  return { __convexAuthJWT: token, __convexAuthRefreshToken: "synthetic-refresh" };
}

async function checkStatus(path, expected, token, method = "GET") {
  const headers = { accept: "text/html", "no-cors": "1" };
  if (token) {
    headers.cookie = Object.entries(cookies(token)).map(([key, value]) => key + "=" + value).join("; ");
  }
  const response = await fetch(origin + path, { method, headers, redirect: "manual" });
  await response.body?.cancel();
  assert.equal(response.status, expected, method + " " + path);
  return response;
}

async function checkRefusals() {
  await checkStatus("/keystatic", 404, operator);
  await checkStatus(`/keystatic/singleton/${singleton}`, 404, operator);
  await checkStatus("/api/keystatic/github/oauth/callback", github ? 400 : 404);
  for (const token of [undefined, member]) {
    for (const path of ["/admin/pages", `/admin/pages/singleton/${singleton}`]) {
      const response = await checkStatus(path, 404, token);
      assert.match(response.headers.get("cache-control") || "", /no-store/);
      assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
    }
    await checkStatus("/api/keystatic/tree", 404, token);
    await checkStatus("/api/keystatic/update", 404, token, "POST");
    await checkStatus("/api/keystatic/github/login", 404, token, "POST");
  }
}

async function checkEditor(browser) {
  await browser.setCookie(...Object.entries(cookies(operator)).map(([name, value]) => ({
    name, value, domain: "127.0.0.1", path: "/", httpOnly: true,
  })));
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(180000);
  const resourceViolations = [];
  await page.exposeFunction("recordEditorResourceViolation", (directive) => resourceViolations.push(directive));
  await page.evaluateOnNewDocument(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const localResource = event.blockedURI.startsWith(location.origin + "/") || ["inline", "eval"].includes(event.blockedURI);
      if (localResource && /^(script|style)-src/.test(event.effectiveDirective)) {
        window.recordEditorResourceViolation(event.effectiveDirective + " " + event.blockedURI);
      }
    });
  });
  const mutationRequests = [];
  const githubFixture = github ? readOnlyGitHubFixture(fixtureFile, await readFile(fixtureFile)) : undefined;
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["data:", "blob:"].includes(url.protocol) || url.hostname === "127.0.0.1") void request.continue();
    else if (githubFixture && ["api.github.com", "raw.githubusercontent.com"].includes(url.hostname)) {
      if (url.pathname === "/graphql" && /\bmutation\b/.test(request.postData() || url.searchParams.get("query") || "")) {
        mutationRequests.push(request.method());
      }
      void githubFixture(request);
    }
    else void request.abort();
  });
  page.on("pageerror", (error) => process.stderr.write(error.message + "\n"));
  await page.setViewport({ width: 1440, height: 1000 });
  const entry = await page.goto(origin + "/admin/pages", { waitUntil: "domcontentloaded" });
  assert.match(entry.headers()["content-security-policy"], /script-src 'self'/);
  assert.equal(entry.headers()["referrer-policy"], "no-referrer");
  if (mode === "prod-disabled") {
    await page.waitForFunction(() => /404|page could not be found|page not found/i.test(document.body.innerText));
    assert.equal(await page.$('a[href*="/api/keystatic/github/login"], input[aria-label="Search title"]'), null);
    await checkStatus("/api/keystatic/github/login", 404, operator);
    await checkStatus("/api/keystatic/update", 404, operator, "POST");
    return;
  }
  if (github) {
    await page.waitForSelector('a[href^="/api/keystatic/github/login"]', { visible: true });
    assert.equal(new URL(page.url()).pathname, "/admin/pages");
    const response = await checkStatus("/api/keystatic/github/login", 307);
    const destination = new URL(response.headers.get("location"));
    assert.equal(destination.origin, "https://github.com");
    assert.equal(destination.pathname, "/login/oauth/authorize");
    assert.equal(destination.searchParams.get("redirect_uri"), origin + "/api/keystatic/github/oauth/callback");
    const logout = await checkStatus("/api/keystatic/github/logout", 307, operator);
    assert.equal(new URL(logout.headers.get("location"), origin).pathname, "/admin/pages");
    await browser.setCookie({ name: "keystatic-gh-access-token", value: "synthetic-reader", domain: "127.0.0.1", path: "/admin/pages" });
    await page.goto(origin + "/admin/pages/branch/content%2Fsmoke/singleton/" + singleton, { waitUntil: "domcontentloaded" });
    const field = await page.waitForSelector('input[aria-labelledby][aria-required="true"]');
    assert.equal(await field.evaluate((input) => input.value), JSON.parse(await readFile(fixtureFile, "utf8")).seoTitle);
    await page.goto(origin + "/admin/pages/branch/main/singleton/" + singleton, { waitUntil: "domcontentloaded" });
    const mainField = await page.waitForSelector('input[aria-labelledby][aria-required="true"]');
    await mainField.focus();
    await mainField.evaluate((input) => input.select());
    await mainField.type("Unsaved main draft");
    await page.locator('::-p-aria(Save[role="button"])').click();
    await page.waitForFunction(() => document.body.innerText.includes("Save this change on a content/ branch."));
    assert.deepEqual(mutationRequests, [], "Main edit reached GitHub mutation transport");
    assert.deepEqual(resourceViolations, [], "CSP blocked editor resources");
    return;
  }

  const link = await page.waitForSelector(`a[href="/admin/pages/singleton/${singleton}"]`, { visible: true });
  await link.click();
  const field = await page.waitForSelector('input[aria-labelledby][aria-required="true"]');
  assert.equal(new URL(page.url()).pathname, `/admin/pages/singleton/${singleton}`);
  const original = await readFile(fixtureFile, "utf8");
  const baseline = JSON.parse(original);
  const editedTitle = "Smoke check " + randomUUID() + (singleton === "home" ? " {ideaCount}" : "");
  let previousTitle = baseline.seoTitle;
  let edited = { ...baseline, seoTitle: editedTitle };
  if (singleton === "live-48-hours") {
    previousTitle = baseline.hero.open.intro;
    edited = { ...baseline, hero: { ...baseline.hero, open: { ...baseline.hero.open, intro: editedTitle } } };
  }
  if (singleton === "live-build-along") {
    previousTitle = baseline.hero.eyebrow;
    edited = { ...baseline, hero: { ...baseline.hero, eyebrow: editedTitle } };
  }
  assert.equal(await field.evaluate((input) => input.value), previousTitle);
  try {
    await field.focus();
    await field.evaluate((input) => input.select());
    await field.type(editedTitle);
    const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/keystatic/update" && r.request().method() === "POST");
    await page.locator('::-p-aria(Save[role="button"])').click();
    assert.equal((await saved).status(), 200);
    assert.deepEqual(JSON.parse(await readFile(fixtureFile, "utf8")), edited);
    await page.reload({ waitUntil: "domcontentloaded" });
    const persisted = await page.waitForSelector('input[aria-labelledby][aria-required="true"]');
    assert.equal(await persisted.evaluate((input) => input.value), editedTitle);
    const editorHrefs = await page.evaluate(() => [...document.links].map((link) => link.pathname));
    assert(editorHrefs.includes("/admin/pages"));
    assert(editorHrefs.includes("/admin/pages/singleton/" + singleton));
    assert(editorHrefs.every((href) => !/^\/keystatic(?:\/|$)/.test(href)));
    assert.deepEqual(resourceViolations, [], "CSP blocked editor resources");
  } finally {
    const after = await readFile(fixtureFile, "utf8");
    if (after !== original) {
      assert.deepEqual(JSON.parse(after), edited, "Refusing to overwrite an unexpected edit");
      await writeFile(fixtureFile, original);
    }
  }
}

await new Promise((resolve, reject) => {
  sessionServer.once("error", reject).listen(convexPort, "127.0.0.1", resolve);
});
let next;
let browser;
try {
  const args = mode === "build" ? ["build"] :
    [mode.startsWith("dev") ? "dev" : "start", "--hostname", "127.0.0.1", "--port", String(appPort)];
  next = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { env, stdio: "inherit" });
  if (mode === "build") {
    const [code] = await once(next, "exit");
    assert.equal(code, 0, "next build");
  } else {
    const deadline = Date.now() + 120000;
    while (true) {
      assert.equal(next.exitCode, null, "Next exited during startup");
      assert(Date.now() < deadline, "Next startup timed out");
      try {
        const response = await fetch(origin + "/favicon.ico");
        await response.body?.cancel();
        break;
      } catch { await delay(500); }
    }
    await checkRefusals();
    const executablePath = [
      process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome", "/usr/bin/chromium",
    ].find((p) => p && existsSync(p));
    assert(executablePath, "Set CHROME_PATH to Chrome or Chromium");
    browser = await puppeteer.launch({ executablePath, headless: true, args: ["--disable-background-networking"] });
    await checkEditor(browser);
  }
  process.stdout.write(`PASS ${mode}\n`);
} finally {
  await browser?.close();
  if (next && next.exitCode === null && next.signalCode === null) {
    const stopped = once(next, "exit");
    next.kill("SIGTERM");
    await stopped;
  }
  sessionServer.closeAllConnections();
  await new Promise((resolve) => sessionServer.close(resolve));
}
