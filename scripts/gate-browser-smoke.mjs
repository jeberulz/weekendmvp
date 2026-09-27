/**
 * Disposable local browser smoke for the public idea email gate.
 *
 * Proves a real Convex Auth session (issued via the WP44 local fixture and
 * redeemed on `/email-signin`) causes middleware to set `wmvp_signed_in` and
 * unlock research; anonymous visitors still see Unlock Idea; signing out
 * clears the hint and re-locks unless `ideas_email` independently grants access.
 *
 * Prerequisites (WP44 disposable stack — never a cloud deployment):
 *   CONVEX_AGENT_MODE=anonymous npx convex dev \
 *     --local-cloud-port 3310 --local-site-port 3311 \
 *     --typecheck disable --codegen disable --tail-logs disable
 *   npm run dev -- --port 3188
 *   CHROME_PATH=/path/to/chrome   # documented in .env.example
 *
 * Usage:
 *   npm run test:gate-browser-smoke
 *   node scripts/gate-browser-smoke.mjs --confirm-disposable=wp44 \
 *     [--frontend-port=3188|3189] [--out-dir=/tmp/gate-smoke]
 *
 * Uses host `www.weekendmvp.app.localhost` so EmailGate's localhost bypass
 * does not fire, while middleware still treats `*.localhost` as local.
 */
import assert from "node:assert/strict";
import { accessSync, constants, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import puppeteer from "puppeteer-core";

const SESSION_HINT = "wmvp_signed_in";
const IDEA_SLUG = "phone-neck-score-app";

function parseArgs(argv) {
  const options = new Map();
  for (const arg of argv) {
    const at = arg.indexOf("=");
    if (at === -1) options.set(arg, "true");
    else options.set(arg.slice(0, at), arg.slice(at + 1));
  }
  return options;
}

function resolveChromePath() {
  const fromEnv = process.env.CHROME_PATH?.trim();
  const candidates = [
    fromEnv,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* try next */
    }
  }

  process.stderr.write(
    [
      "gate-browser-smoke: no Chrome/Chromium binary found.",
      "Set CHROME_PATH to an executable Chrome or Chromium binary.",
      "Documented in .env.example (CHROME_PATH=).",
      "Examples:",
      "  Linux:  CHROME_PATH=/usr/bin/google-chrome-stable",
      "  macOS:  CHROME_PATH=\"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\"",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

async function settle(page, ms = 2500) {
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, ms));
}

async function dismissConsent(page) {
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const btn = buttons.find((b) => /accept all|reject/i.test(b.textContent || ""));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
}

async function gateSnapshot(page) {
  return page.evaluate((hintName) => {
    const hint = document.cookie
      .split(";")
      .some((part) => part.trim() === `${hintName}=1`);
    return {
      hostname: location.hostname,
      hint,
      storedEmail: localStorage.getItem("ideas_email"),
      lockedAttr: document.querySelector("[data-gate-content]")?.getAttribute("data-locked"),
      emailGate: !!document.querySelector("#email-gate"),
      unlockText: /Unlock Idea/i.test(document.body.innerText),
    };
  }, SESSION_HINT);
}

async function createConfirmationFixture({ email, origin }) {
  const config = JSON.parse(
    await readFile(".convex/local/default/config.json", "utf8"),
  );
  assert.equal(config.ports?.cloud, 3310, "Disposable Convex cloud port must be 3310");
  assert.equal(config.ports?.site, 3311, "Disposable Convex site port must be 3311");

  const code = randomBytes(32).toString("hex");
  const admin = new ConvexHttpClient("http://127.0.0.1:3310", { logger: false });
  admin.setAdminAuth(config.adminKey);
  await admin.mutation(makeFunctionReference("auth:store"), {
    args: {
      type: "createVerificationCode",
      provider: "email",
      email,
      code,
      expirationTime: Date.now() + 15 * 60 * 1000,
      allowExtraProviders: false,
    },
  });

  const url = new URL("/email-signin", origin);
  url.searchParams.set("token", code);
  url.searchParams.set("email", email);
  url.searchParams.set("returnTo", "/dashboard");
  return { email, confirmationUrl: url.toString() };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assert.equal(
    options.get("--confirm-disposable"),
    "wp44",
    "Pass --confirm-disposable=wp44 (disposable local stack only)",
  );

  const frontendPort = options.get("--frontend-port") ?? "3188";
  assert(
    ["3188", "3189"].includes(frontendPort),
    "Only disposable frontend ports 3188/3189 are allowed",
  );

  // Same host for sign-in cookies and idea-page checks. `*.localhost` keeps
  // middleware local while avoiding EmailGate's plain-localhost bypass.
  const host = "www.weekendmvp.app.localhost";
  const origin = `http://${host}:${frontendPort}`;
  const ideaUrl = `${origin}/ideas/${IDEA_SLUG}`;

  const outDir = options.get("--out-dir")
    ? path.resolve(options.get("--out-dir"))
    : mkdtempSync(path.join(tmpdir(), "gate-browser-smoke-"));
  mkdirSync(outDir, { recursive: true });

  const chromePath = resolveChromePath();

  // Preflight frontend (Node may not resolve `*.localhost`; Chrome does).
  const probe = await fetch(
    `http://127.0.0.1:${frontendPort}/ideas/${IDEA_SLUG}`,
    {
      headers: { Host: `${host}:${frontendPort}` },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    },
  ).catch((error) => {
    throw new Error(
      `Frontend not reachable at ${ideaUrl}. Start disposable Next on port ${frontendPort}. (${error.message})`,
    );
  });
  assert.equal(probe.status, 200, `Expected 200 from ${ideaUrl}, got ${probe.status}`);

  const email = `wp44-gate-${randomBytes(4).toString("hex")}@example.test`;
  const fixture = await createConfirmationFixture({ email, origin });

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const results = [];

  try {
    // --- Anonymous: Unlock Idea visible ---
    {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1280, height: 1100 });
      await page.goto(ideaUrl, { waitUntil: "networkidle2", timeout: 60_000 });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle2" });
      await settle(page);
      await dismissConsent(page);
      const snap = await gateSnapshot(page);
      await page.screenshot({ path: path.join(outDir, "gate-anonymous-locked.png") });
      results.push({
        case: "anonymous",
        pass:
          snap.emailGate === true &&
          snap.unlockText === true &&
          snap.hint === false &&
          snap.storedEmail == null,
        snap,
      });
      await ctx.close();
    }

    // --- Real member: redeem /email-signin, hint issued, research unlocked ---
    {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport({ width: 1280, height: 1100 });
      await page.goto(fixture.confirmationUrl, {
        waitUntil: "networkidle2",
        timeout: 60_000,
      });
      await settle(page, 1500);

      const confirm = await page.waitForSelector("button", { timeout: 15_000 });
      const confirmLabel = await page.evaluate(
        (el) => el?.textContent?.trim() ?? "",
        confirm,
      );
      assert.match(confirmLabel, /Yes, sign me in/i, "Expected confirm button on /email-signin");
      await confirm.click();
      await page.waitForFunction(
        () => location.pathname.startsWith("/dashboard"),
        { timeout: 30_000 },
      );
      await settle(page, 1500);

      const cookiesAfterSignIn = await page.cookies();
      const hasJwt = cookiesAfterSignIn.some(
        (c) =>
          (c.name === "__convexAuthJWT" || c.name === "__Host-__convexAuthJWT") &&
          c.value.length > 0,
      );
      const hasHintCookie = cookiesAfterSignIn.some(
        (c) => c.name === SESSION_HINT && c.value === "1",
      );
      assert.equal(hasJwt, true, "Sign-in must set a Convex Auth JWT cookie");
      assert.equal(
        hasHintCookie,
        true,
        "Middleware must issue wmvp_signed_in=1 after a real session",
      );

      await page.goto(ideaUrl, { waitUntil: "networkidle2", timeout: 60_000 });
      await settle(page);
      await dismissConsent(page);
      const snap = await gateSnapshot(page);
      await page.screenshot({ path: path.join(outDir, "gate-member-unlocked.png") });
      results.push({
        case: "signed-in-member",
        pass:
          snap.emailGate === false &&
          snap.unlockText === false &&
          snap.lockedAttr == null &&
          snap.hint === true &&
          snap.storedEmail == null,
        snap,
        hasJwt,
        hasHintCookie,
      });

      // --- Signed out / revoked: clear session, hint cleared, gate locks ---
      await page.goto(`${origin}/dashboard`, {
        waitUntil: "networkidle2",
        timeout: 60_000,
      });
      await settle(page, 1500);

      // Open the sidebar Account menu, then Sign out (real auth path).
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll("button")];
        const account = buttons.find((b) => {
          const label = (b.getAttribute("aria-label") || b.textContent || "").trim();
          return label === "Account" || /^Account/.test(label);
        });
        account?.click();
      });
      await new Promise((r) => setTimeout(r, 500));
      const signedOutViaUi = await page.evaluate(() => {
        const items = [...document.querySelectorAll("[role='menuitem'], button")];
        const btn = items.find((b) => /Sign out/i.test((b.textContent || "").trim()));
        if (!btn) return false;
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return true;
      });
      if (signedOutViaUi) {
        await page
          .waitForFunction(() => /\/(login|signin)/.test(location.pathname), {
            timeout: 30_000,
          })
          .catch(() => {});
      } else {
        // Fallback: revoke via Convex with the browser JWT, then reload so
        // middleware clears the readable hint (same as a revoked session).
        const jwt = cookiesAfterSignIn.find(
          (c) =>
            c.name === "__convexAuthJWT" || c.name === "__Host-__convexAuthJWT",
        )?.value;
        if (jwt) {
          const client = new ConvexHttpClient("http://127.0.0.1:3310", {
            logger: false,
          });
          client.setAuth(jwt);
          await client.action(makeFunctionReference("auth:signOut"), {});
        }
        await page.goto(`${origin}/login`, { waitUntil: "networkidle2" });
      }
      await settle(page, 1000);

      // Clear any leftover ideas_email so only session state is under test.
      await page.evaluate(() => localStorage.removeItem("ideas_email"));
      await page.goto(ideaUrl, { waitUntil: "networkidle2", timeout: 60_000 });
      await settle(page);
      await dismissConsent(page);
      const afterSignOut = await gateSnapshot(page);
      await page.screenshot({
        path: path.join(outDir, "gate-after-signout-locked.png"),
      });
      results.push({
        case: "signed-out",
        pass:
          afterSignOut.emailGate === true &&
          afterSignOut.unlockText === true &&
          afterSignOut.hint === false &&
          afterSignOut.storedEmail == null,
        snap: afterSignOut,
        signedOutViaUi,
      });

      // ideas_email still unlocks after sign-out (independent grant).
      await page.evaluate(() => {
        localStorage.setItem("ideas_email", "reader@example.test");
      });
      await page.reload({ waitUntil: "networkidle2" });
      await settle(page);
      await dismissConsent(page);
      const withIdeasEmail = await gateSnapshot(page);
      await page.screenshot({
        path: path.join(outDir, "gate-signedout-ideas-email-unlocked.png"),
      });
      results.push({
        case: "signed-out-with-ideas-email",
        pass:
          withIdeasEmail.emailGate === false &&
          withIdeasEmail.unlockText === false &&
          withIdeasEmail.lockedAttr == null &&
          withIdeasEmail.storedEmail === "reader@example.test",
        snap: withIdeasEmail,
      });

      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  const summary = {
    ok: results.every((r) => r.pass),
    origin,
    ideaUrl,
    outDir,
    chromePath,
    productionDeployment: false,
    externalDelivery: false,
    realAuthRedemption: true,
    results,
  };
  writeFileSync(path.join(outDir, "gate-browser-smoke.json"), JSON.stringify(summary, null, 2) + "\n");
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  if (!summary.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(
    `gate-browser-smoke failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
