import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// WP64-S4 static pins. The webhook verifies the raw body first, every Stripe
// write is idempotent, no route takes new money, and logs carry no detail.

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const WEBHOOK = "app/api/platform/membership/webhook/route.ts";
const RECONCILE = "app/api/platform/membership/reconcile/route.ts";
const EVENTS = "app/api/platform/membership/_events.ts";
const PROVIDER = "convex/platform/membership/provider.ts";
const SETTLEMENT = "convex/platform/membership/events.ts";

test("the webhook verifies the signature on the raw body before anything else reads it", async () => {
  const route = code(await read(WEBHOOK));
  assert.doesNotMatch(route, /request\.json\(|JSON\.parse\(/);
  const raw = route.indexOf("await request.text()");
  const verify = route.indexOf("stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret)");
  const mode = route.indexOf("event.livemode !== config.livemode");
  const fetch = route.indexOf("normalizeMembershipEvent(");
  const bridge = route.indexOf("convex.action(");
  assert.ok(raw > 0 && verify > raw && mode > verify && fetch > mode && bridge > fetch, "raw body, verify, mode, fetch, settle");
  assert.match(route, /if \(!signature\) return reply\("Invalid signature", 400\)/);
});

test("a settled event is acknowledged only after its follow-ups; a transient failure or anything thrown is a 500", async () => {
  const route = code(await read(WEBHOOK));
  const follow = route.indexOf("await performFollowUps(stripe, settled.actions)");
  const failed = route.indexOf("if (followed.failed.length > 0) {");
  const ok = route.indexOf('reply("OK", 200)');
  assert.ok(follow > 0 && failed > follow && ok > failed);
  assert.match(route, /if \(followed\.failed\.length > 0\) \{[\s\S]*?return reply\("Retry", 500\);/);
  assert.match(route, /catch \(error\) \{[\s\S]*?return reply\("Retry", 500\);/);
});

test("every Stripe write carries an idempotency key, and no route takes new money", async () => {
  const sources = await Promise.all([WEBHOOK, RECONCILE, EVENTS].map(async (file) => code(await read(file))));
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /charges\.create|paymentIntents\.(create|confirm|capture)|subscriptions\.create|sessions\.create|invoices\.(create|pay)|customers\.(create|update)/,
    );
  }
  const events = sources[2];
  const writes = [...events.matchAll(/stripe\.(refunds\.create|subscriptions\.cancel|subscriptions\.update|subscriptionSchedules\.release)\(/g)];
  assert.equal(writes.length, 4);
  for (const write of writes) {
    const call = events.slice(write.index, events.indexOf(";", write.index));
    assert.match(call, /idempotencyKey: `membership-[a-z-]+:\$\{[a-zA-Z.]+\}`/, write[1]);
  }
});

test("route logs carry the error class, Stripe code and follow-up summaries only", async () => {
  for (const file of [WEBHOOK, RECONCILE]) {
    const logs = code(await read(file)).match(/console\.\w+\([^;]*\);/g) ?? [];
    assert.ok(logs.length >= 1, file);
    for (const line of logs) {
      assert.doesNotMatch(line, /email|message|body|payload|signature|secret|metadata|customer|String\(error|,\s*error\s*\)/, `${file}: ${line}`);
      assert.match(line, /errorSummary\(error\)|followed\.(skipped|failed)|summary\)/, `${file}: ${line}`);
    }
  }
  const events = code(await read(EVENTS));
  const start = events.indexOf("export function errorSummary");
  assert.doesNotMatch(events.slice(start), /\.message/);
  // Follow-up reports hold the action type, the error class and Stripe's code. Never an id.
  assert.match(events, /report\.skipped\.push\(\{ type: action\.type, code: summary\.code \}\)/);
  assert.match(events, /report\.failed\.push\(\{ type: action\.type, \.\.\.summary \}\)/);
});

test("reconcile is never prerendered", async () => {
  const route = code(await read(RECONCILE));
  const dynamic = route.indexOf("await connection();");
  const secret = route.indexOf("process.env.CRON_SECRET");
  assert.ok(dynamic > 0 && secret > dynamic, "connection() must run before the route reads its env");
});

test("reconcile runs only with the cron secret, compared in constant time", async () => {
  const route = code(await read(RECONCILE));
  assert.match(route, /timingSafeEqual\(digest\(header \?\? ""\), digest\(`Bearer \$\{secret\}`\)\)/);
  const skip = route.indexOf('skipped: "not_configured"');
  const auth = route.indexOf("if (!bearerMatches(");
  const stripe = route.indexOf("createMembershipStripe(");
  assert.ok(skip > 0 && auth > skip && stripe > auth);
  const vercel = JSON.parse(await read("vercel.json"));
  assert.deepEqual(vercel.crons, [{ path: "/api/platform/membership/reconcile", schedule: "17 4 * * *" }]);
});

test("server-only bridge kinds must be fresh before Convex runs anything", async () => {
  const provider = code(await read(PROVIDER));
  const fresh = provider.indexOf("membershipBridgeFresh(payload.issuedAt, Date.now())");
  const first = provider.indexOf("ctx.runMutation(events.");
  assert.ok(fresh > 0 && first > fresh);
  const settlement = code(await read(SETTLEMENT));
  assert.doesNotMatch(settlement, /\b(query|mutation|action)\(\{/);
  assert.doesNotMatch(settlement, /email/);
});

test("the two S4 critical flows are registered", async () => {
  const workflow = await read(".agentic-workflow.yml");
  assert.match(workflow, /^ {2}- membership_checkout_webhook_entitlement_exactly_once$/m);
  assert.match(workflow, /^ {2}- founding_seat_cap_never_exceeded$/m);
});
