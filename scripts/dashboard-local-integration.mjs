/** Disposable local backend + Next development or local production build.
 * This does not test a production deployment and never sends an email. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

let stage = "local preflight";
async function main() {
  assert(process.argv.includes("--confirm-disposable=wp44"));
  const frontendPort = process.argv.find(arg => arg.startsWith("--frontend-port="))?.split("=")[1] ?? "3188";
  assert(["3188", "3189"].includes(frontendPort), "Only disposable frontend ports are allowed");
  const frontend = `http://localhost:${frontendPort}`;
  const canonicalOrigin = process.argv.find(arg => arg.startsWith("--canonical-origin="))?.slice("--canonical-origin=".length) ?? "https://www.weekendmvp.app";
  assert(["https://www.weekendmvp.app", "http://localhost:3188", "http://localhost:3189"].includes(canonicalOrigin));
  const config = JSON.parse(await readFile(".convex/local/default/config.json", "utf8"));
  assert.equal(config.ports?.cloud, 3310);
  assert.equal(config.ports?.site, 3311);
  const admin = new ConvexHttpClient("http://127.0.0.1:3310", { logger: false });
  admin.setAdminAuth(config.adminKey);
  const client = new ConvexHttpClient("http://127.0.0.1:3310", { logger: false });
  const email = `wp44-check-${randomBytes(6).toString("hex")}@example.test`;
  const code = randomBytes(32).toString("hex");
  stage = "create local verification fixture";
  await admin.mutation(makeFunctionReference("auth:store"), { args: {
    type: "createVerificationCode", provider: "email", email, code,
    expirationTime: Date.now() + 60_000, allowExtraProviders: false,
  } });
  stage = "redeem through public auth action";
  const result = await client.action(makeFunctionReference("auth:signIn"), { provider: "email", params: { email, code } });
  assert(result.tokens?.token && result.tokens?.refreshToken);
  client.setAuth(result.tokens.token);
  stage = "verify live membership";
  assert.equal(await client.mutation(makeFunctionReference("platform/dashboard:requireMember"), {}), null);
  const cookie = `__convexAuthJWT=${result.tokens.token}; __convexAuthRefreshToken=${result.tokens.refreshToken}`;
  const request = (cookies) => fetch(`${frontend}/api/ideas/prompts?slug=adspark`, {
    headers: cookies ? { cookie: cookies } : {}, redirect: "manual", signal: AbortSignal.timeout(20_000),
  });
  const statuses = {};
  stage = "anonymous HTTP rejection";
  statuses.anonymous = (await request()).status;
  assert.equal(statuses.anonymous, 401);
  stage = "valid member HTTP content";
  const valid = await request(cookie);
  statuses.valid = valid.status;
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "private, max-age=300");
  assert((await valid.json()).prompts.length > 0);
  const savedUrl = `${frontend}/api/platform/saved?slug=adspark`;
  const writeSave = (saved, expectedVersion) => fetch(savedUrl, {
    method: "POST", headers: { cookie, origin: frontend, "content-type": "application/json" },
    body: JSON.stringify({ slug: "adspark", saved, expectedVersion }), signal: AbortSignal.timeout(20_000),
  });
  stage = "versioned Save HTTP commit";
  const stateResponse = await fetch(savedUrl, { headers: { cookie } });
  assert.equal(stateResponse.headers.get("cache-control"), "private, no-store");
  const initial = await stateResponse.json();
  assert.equal(initial.version, 0);
  // A no-op Unsave must still fence an older in-flight Save.
  const unsave = await writeSave(false, 0);
  assert.equal(unsave.status, 200);
  assert.equal(unsave.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await unsave.json(), { saved: false, version: 1 });
  stage = "stale Save HTTP conflict";
  const lateSave = await writeSave(true, 0);
  statuses.staleSave = lateSave.status;
  assert.equal(lateSave.status, 409);
  assert.deepEqual(await lateSave.json(), { code: "SAVE_CONFLICT", saved: false, version: 1 });
  stage = "latest Save intent retries against current version";
  const retry = await writeSave(true, 1);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { saved: true, version: 2 });
  const persisted = await (await fetch(savedUrl, { headers: { cookie } })).json();
  assert.deepEqual(persisted, { signedIn: true, saved: true, version: 2 });
  stage = "forged signed-cookie rejection";
  // Both iat and exp are required by the installed middleware freshness check.
  // Use a real refresh credential and assert no refreshed JWT is issued, so
  // a failed dummy refresh cannot make this assertion pass.
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const forgedToken = (iat, exp) => `${header}.${Buffer.from(JSON.stringify({ iat, exp, sub: "invented" })).toString("base64url")}.invented`;
  const forged = forgedToken(now, now + 3600);
  const forgedCookie = token => `__convexAuthJWT=${token}; __convexAuthRefreshToken=${result.tokens.refreshToken}`;
  const backendRejection = await fetch("http://127.0.0.1:3310/api/mutation", {
    method: "POST", headers: { authorization: `Bearer ${forged}`, "content-type": "application/json" },
    body: JSON.stringify({ path: "platform/dashboard:requireMember", args: {}, format: "json" }),
  });
  assert.equal(backendRejection.status, 401);
  statuses.forgedBackend = backendRejection.status;
  const forgedResponse = await request(forgedCookie(forged));
  statuses.forged = forgedResponse.status;
  assert.equal(statuses.forged, 401);
  assert(!forgedResponse.headers.getSetCookie().some(value => value.startsWith("__convexAuthJWT=")), "Fresh forged JWT must reach the route without refresh");
  stage = "refresh positive control";
  // The same forged identity with an expired timestamp MUST issue a fresh
  // signed cookie using the genuine credential. Replay it as a browser would.
  const refreshed = await request(forgedCookie(forgedToken(now - 3600, now - 1)));
  assert.equal(refreshed.status, 200, "Refreshed JWT must reach the first API request");
  statuses.refreshFirstRequest = refreshed.status;
  const refreshedCookies = refreshed.headers.getSetCookie().map(value => value.split(";")[0]);
  assert(refreshedCookies.some(value => /^__convexAuthJWT=.+/.test(value)), "Positive control must issue a signed JWT");
  statuses.refreshControl = (await request(refreshedCookies.join("; "))).status;
  assert.equal(statuses.refreshControl, 200);
  stage = "real logout";
  await client.action(makeFunctionReference("auth:signOut"), {});
  stage = "revoked signed-token membership rejection";
  await assert.rejects(client.mutation(makeFunctionReference("platform/dashboard:requireMember"), {}), (error) => error.data?.code === "UNAUTHENTICATED");
  stage = "revoked signed-cookie HTTP rejection";
  statuses.revoked = (await request(cookie)).status;
  assert.equal(statuses.revoked, 401);
  stage = "public canonical and structured-data smoke";
  const publicIdea = await fetch(`${frontend}/ideas/adspark`, { signal: AbortSignal.timeout(20_000) });
  assert.equal(publicIdea.status, 200);
  const html = await publicIdea.text();
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1];
  assert.equal(canonical, `${canonicalOrigin}/ideas/adspark`);
  assert.match(html, /type="application\/ld\+json"/);
  stage = "public sitemap and private route smoke";
  const sitemap = await fetch(`${frontend}/sitemap.xml`, { signal: AbortSignal.timeout(20_000) });
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  assert(xml.includes("/ideas/adspark</loc>"));
  assert(!xml.includes("/dashboard"));
  const privatePage = await fetch(`${frontend}/dashboard`, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
  assert([307, 308].includes(privatePage.status));
  assert.match(privatePage.headers.get("location") ?? "", /\/(?:signin|login)(?:\?|$)/);
  const summary = {
    environment: frontendPort === "3189" ? "local production build" : "local development server",
    productionDeployment: false,
    backend: "http://127.0.0.1:3310", frontend, canonicalOrigin,
    forgedJwtFreshIat: true, forgedCookieUsesGenuineRefresh: true, refreshPositiveControl: true,
    realAuthRedemption: true, externalDelivery: false, realLogout: true,
    privateCacheHeaders: true, publicCanonicalAndJsonLd: true, privateRoutesExcludedFromSitemap: true,
    statuses, passed: true,
  };
  await writeFile(".convex/local/integration-results.json", JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

main().catch(() => {
  process.stderr.write(`Disposable integration failed at: ${stage}. No credential values printed.\n`);
  process.exitCode = 1;
});
