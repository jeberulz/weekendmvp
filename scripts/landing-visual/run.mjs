import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { optimizeImage } from "next/dist/server/image-optimizer/transform.js";
import freezeDate from "./clock.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(scriptDir, "../..");
const app = path.resolve(process.env.LANDING_VISUAL_APP || project);
const baseline = path.join(project, "tests/landing-visual/baseline");
const actual = path.join(project, "tmp/landing-visual");
const source = "43721c0fb8a7bfd827a1a4ca80cf12ae82537ba0";
const guideSource = "692b7b3f5dd1109dd32c4902a6a658f82daee272";
const guideBaseline = path.join(project, "tests/landing-visual/guide-baseline");
const record = process.argv.includes("--record");
const git = (...args) => execFileSync("git", ["-C", app, ...args], { encoding: "utf8" }).trim();

const hub = "/live";
const free = "/live/48-hours";
const paid = "/live/build-along";
const guide = "/guides/5-to-9-builder";
const scenarios = [
  { phase: "ended", clock: "2026-11-27T12:00:00Z", paths: ["/", "/5-to-9-starter", guide, "/starter-kit", "/shipable", "/dare", hub, free, paid] },
  { phase: "pre-sale", clock: "2026-10-30T12:00:00Z", paths: [hub, free, paid] },
  { phase: "webinar-live", clock: "2026-10-31T16:30:00Z", paths: [hub, free] },
  { phase: "replay-early-bird", clock: "2026-11-02T12:00:00Z", paths: [hub, free, paid] },
  { phase: "standard", clock: "2026-11-10T12:00:00Z", paths: [hub, paid] },
  { phase: "workshop-live", clock: "2026-11-14T15:30:00Z", paths: [hub, paid] },
];

const routeFilter = process.argv.find(arg => arg.startsWith("--route="))?.slice(8);
if (routeFilter) assert.ok(scenarios.some(scenario => scenario.paths.includes(routeFilter)), "Unknown visual route");

async function checkInput() {
  await access(path.join(app, ".next/BUILD_ID"));
  await access(path.join(app, ".next/server/preview-props.json"));
  assert.equal(git("hash-object", "ideas/manifest.json"), "53a8348cdccfa223cb64cc2338445a76bd388170", "Unexpected idea manifest");
  if (record) {
    assert.equal(git("rev-parse", "HEAD"), routeFilter === guide ? guideSource : source, "Record from the pre-migration main revision");
    assert.equal(git("status", "--porcelain"), "", "Record from a clean checkout");
  }
  // Build without deployment variables. The test runner supplies a loopback
  // fixture only at runtime. Do not let Next discover credentials on disk.
  for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    await assert.rejects(access(path.join(app, file)), { code: "ENOENT" });
  }
}

function makeConvexFixture() {
  return createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/api/query") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks));
      } catch {
        res.writeHead(400).end();
        return;
      }
      const values = { "buildCta:buildCtaVisible": false, "editorial/public:listing": [], "editorial/public:visibility": "legacy" };
      if (body && Object.hasOwn(values, body.path)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "success", value: values[body.path], logLines: [] }));
        return;
      }
    }
    res.writeHead(404).end();
  });
}

async function startNext(clock, convexUrl, sold) {
  const port = Number(process.env.LANDING_VISUAL_PORT || 4184);
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [
    "--import", path.join(scriptDir, "clock.mjs"), path.join(app, "node_modules/next/dist/bin/next"),
    "start", "-H", "127.0.0.1", "-p", String(port),
  ], {
    cwd: app,
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, TZ: "UTC", NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_CONVEX_URL: convexUrl,
      LANDING_VISUAL_CLOCK: clock, LIVE_SEATS_SOLD: String(sold),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output = (output + chunk).slice(-8000); });
  const closed = once(child, "exit");
  try {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(output);
      if (/Ready in/.test(output)) {
        // Next prints its ready line before loading config and build artifacts.
        const ready = await fetch(origin + "/robots.txt", {
          method: "HEAD", signal: AbortSignal.timeout(3000),
        }).then(response => response.ok, () => false);
        if (ready) return { origin, stop: async () => { child.kill(); await closed; } };
      }
      await delay(100);
    }
    throw new Error(`Production server did not start. ${output}`);
  } catch (error) {
    child.kill();
    throw error;
  }
}

async function capture(browser, { origin, route, width, clock, gate, phase }) {
  const context = await browser.createBrowserContext();
  const imageErrors = [];
  try {
    const page = await context.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.emulateTimezone("Europe/London");
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.evaluateOnNewDocument(freezeDate, clock);
    await page.evaluateOnNewDocument((returning) => {
      localStorage.setItem("analytics_consent", JSON.stringify({ value: false, timestamp: Date.now() }));
      if (returning) localStorage.setItem("weekendmvp_subscribed", "true");
    }, gate === "returning");
    page.on("response", response => {
      if (response.status() >= 400) process.stderr.write(`${response.status()} ${response.url()}\n`);
    });
    await page.setRequestInterception(true);
    page.on("request", async request => {
      const url = new URL(request.url());
      // On next start, the optimiser's internal source request omits Host.
      // Middleware returns a 404. Production's Vercel optimiser serves WebP.
      const art = url.searchParams.get("url") || "";
      if (url.origin === origin && url.pathname === "/_next/image" && /^\/image\/og\/idea\/[a-z0-9-]+\.png$/.test(art)) {
        try {
          const buffer = await readFile(path.join(app, "public", art));
          const body = await optimizeImage({
            buffer, contentType: "image/webp", width: Number(url.searchParams.get("w")),
            quality: Number(url.searchParams.get("q")),
          });
          await request.respond({ status: 200, contentType: "image/webp", body });
        } catch (error) {
          imageErrors.push(error);
          await request.abort();
        }
        return;
      }
      const allowed = ["data:", "blob:"].includes(url.protocol) ||
        (url.origin === origin && request.method() === "GET" && !url.pathname.startsWith("/api/") && !url.searchParams.has("_rsc"));
      void (allowed ? request.continue() : request.abort());
    });
    const res = await page.goto(origin + route, { waitUntil: "load", timeout: 60000 });
    assert.equal(res.status(), 200, route);
    assert.equal(new URL(page.url()).pathname, route);
    await page.waitForSelector("h1", { visible: true });
    const title = await page.$eval("h1", element => element.innerText);
    assert.doesNotMatch(title, /404|not found|application error|page couldn.t load/i, route);
    if (route === free) {
      const markers = {
        "pre-sale": "Build a real app live",
        "webinar-live": "live.",
        "replay-early-bird": "the replay is in your email",
        "ended": "Next free webinar coming soon",
      };
      assert.ok((await page.$eval("main", el => el.innerText)).includes(markers[phase]), phase);
    }
    if (route === paid) {
      assert.match(title, phase === "ended" ? /has ended/i : /Build it Saturday/i);
    }
    if (gate) await page.waitForSelector(`[data-guide="${gate}"]`);
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}" });
    const missing = await page.evaluate(async () => {
      const broken = [];
      for (const image of document.images) image.loading = "eager";
      await Promise.all([...document.images].filter(image => image.currentSrc || image.src).map(async image => {
        try { await image.decode(); } catch { broken.push(image.currentSrc || image.src); }
      }));
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return broken;
    });
    assert.deepEqual(imageErrors, []);
    assert.deepEqual(missing, [], "Every captured image must decode");
    return Buffer.from(await page.screenshot({ fullPage: true, type: "png" }));
  } finally {
    await context.close();
  }
}

// Chrome rasterises a handful of pixels on rounded mobile controls
// differently between runs on the same main commit. Each mask contains only
// pixels that changed across those reference renders. Body and text stay exact.
async function matchesMobileNavRounding(name, left, right) {
  const phase = /^live-build-along-(ended|pre-sale|replay-early-bird|standard|workshop-live)-375\.png$/.exec(name)?.[1];
  let label;
  if (phase) label = phase === "ended" || phase === "pre-sale" ? phase : "sold-out";
  if (!label || left.info.width !== 375 || left.info.height !== right.info.height) return false;
  const maxChannelDelta = { ended: 3, "pre-sale": 2, "sold-out": 5 }[label];
  const mask = await sharp(path.join(project, "tests/landing-visual/antialias", label + ".png"))
    .greyscale().raw().toBuffer();
  const headerBytes = mask.length * 4;
  if (!left.data.subarray(headerBytes).equals(right.data.subarray(headerBytes))) return false;
  for (let i = 0; i < headerBytes; i++) {
    const delta = Math.abs(left.data[i] - right.data[i]);
    if (delta && (mask[Math.floor(i / 4)] === 0 || delta > maxChannelDelta)) return false;
  }
  return true;
}

async function match(name, screenshot) {
  const updatedGuide = name.startsWith("guides-5-to-9-builder-") && (!record || routeFilter === guide);
  const referencePath = path.join(updatedGuide ? guideBaseline : baseline, name);
  if (record) {
    await sharp(screenshot).png({ compressionLevel: 9 }).toFile(referencePath);
    return;
  }
  const expected = await readFile(referencePath);
  const pixels = image => sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [left, right] = await Promise.all([pixels(expected), pixels(screenshot)]);
  if (left.info.width === right.info.width && left.info.height === right.info.height) {
    if (left.data.equals(right.data)) return;
    if (await matchesMobileNavRounding(name, left, right)) {
      process.stdout.write(`Observed reference antialias variation in ${name}\n`);
      return;
    }
  }
  await mkdir(actual, { recursive: true });
  const output = path.join(actual, name);
  await writeFile(output, screenshot);
  throw new Error(`Pixel difference for ${name}. Actual screenshot: ${output}`);
}

await checkInput();
await mkdir(record && routeFilter === guide ? guideBaseline : baseline, { recursive: true });
const fixture = makeConvexFixture();
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
let browser;
const failed = [];
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || puppeteer.executablePath("chrome"),
    headless: true,
    args: ["--lang=en-GB", "--force-color-profile=srgb", "--disable-lcd-text", "--disable-gpu", "--run-all-compositor-stages-before-draw"],
  });
  process.stdout.write(`Visual gate with ${await browser.version()}\n`);
  for (const { phase, clock, paths } of scenarios) {
    const selected = paths.filter(route => !routeFilter || route === routeFilter);
    if (!selected.length) continue;
    const sold = ["replay-early-bird", "standard", "workshop-live"].includes(phase) ? 20 : 2;
    const server = await startNext(clock, `http://127.0.0.1:${fixture.address().port}`, sold);
    try {
      for (const route of selected) {
        for (const gate of route === guide ? ["locked", "returning"] : [undefined]) {
          for (const width of [375, 1440]) {
            const slug = route.slice(1).replaceAll("/", "-") || "home";
            const name = [slug, route.startsWith("/live") ? phase : gate, width].filter(Boolean).join("-") + ".png";
            const screenshot = await capture(browser, { ...server, route, width, clock, gate, phase });
            try {
              await match(name, screenshot);
            } catch (error) {
              if (record) throw error;
              failed.push(name);
              process.stderr.write(`${error.message}\n`);
              continue;
            }
            process.stdout.write(`${record ? "Captured" : "Matched"} ${name}\n`);
          }
        }
      }
    } finally {
      await server.stop();
    }
  }
} finally {
  if (browser) await browser.close();
  fixture.close();
}

assert.equal(failed.length, 0, `Visual differences: ${failed.join(", ")}`);
