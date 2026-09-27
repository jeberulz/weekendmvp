/**
 * Headless smoke: signed-in members skip Unlock Idea; anonymous keep it.
 *
 * Uses host `www.weekendmvp.app.localhost` so:
 * - middleware still treats `*.localhost` as a local platform host
 * - EmailGate's localhost bypass does NOT fire (hostname !== localhost)
 *
 * The member case injects `wmvp_signed_in=1` via evaluateOnNewDocument.
 * Middleware clears a forged request cookie when no JWT is present; real
 * signed-in users get the hint from syncSessionHintCookie after auth.
 *
 * Usage (dev server on :3000):
 *   node scripts/gate-browser-smoke.mjs
 */
import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";

const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome-stable";
const BASE = "http://www.weekendmvp.app.localhost:3000";
const URL = `${BASE}/ideas/phone-neck-score-app`;
const OUT = "/opt/cursor/artifacts";

mkdirSync(OUT, { recursive: true });

async function settle(page) {
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
}

async function dismissConsent(page) {
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const btn = buttons.find((b) => /accept all|reject/i.test(b.textContent || ""));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
}

async function snapshot(page) {
  return page.evaluate(() => ({
    hostname: location.hostname,
    storedEmail: localStorage.getItem("ideas_email"),
    lockedAttr: document.querySelector("[data-gate-content]")?.getAttribute("data-locked"),
    emailGate: !!document.querySelector("#email-gate"),
    unlockText: /Unlock Idea/i.test(document.body.innerText),
  }));
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

const results = [];

try {
  {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 1100 });
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle2" });
    await settle(page);
    await dismissConsent(page);
    const snap = await snapshot(page);
    await page.screenshot({ path: `${OUT}/gate-anonymous-locked.png` });
    results.push({
      case: "anonymous",
      pass: snap.emailGate === true && snap.unlockText === true && snap.storedEmail == null,
      snap,
    });
    await ctx.close();
  }

  {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 1100 });
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
      document.cookie = "wmvp_signed_in=1; path=/";
    });
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
    await settle(page);
    await dismissConsent(page);
    const snap = await snapshot(page);
    await page.screenshot({ path: `${OUT}/gate-member-unlocked.png` });
    results.push({
      case: "signed-in-hint",
      pass:
        snap.emailGate === false &&
        snap.unlockText === false &&
        snap.lockedAttr == null &&
        snap.storedEmail == null,
      snap,
    });
    await ctx.close();
  }
} finally {
  await browser.close();
}

const summary = {
  ok: results.every((r) => r.pass),
  url: URL,
  results,
  screenshots: [
    `${OUT}/gate-anonymous-locked.png`,
    `${OUT}/gate-member-unlocked.png`,
  ],
};
writeFileSync(`${OUT}/gate-browser-smoke.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
