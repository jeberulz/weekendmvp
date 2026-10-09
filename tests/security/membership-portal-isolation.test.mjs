import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// WP64-S5 static pins. The Billing Portal opens only for the signed-in
// member's own customer, returns to our own origin, and never follows a
// browser-supplied customer or address. A plan switch names only a term and
// a cancel names nothing: the subscription comes from Convex and the Price
// from config.

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ROUTE = "app/api/platform/membership/portal/route.ts";
const PORTAL = "convex/platform/membership/portal.ts";

test("the route takes `{}`, `{ switchTo }` or `{ cancel: true }` and builds the customer and return address itself", async () => {
  const route = code(await read(ROUTE));
  assert.match(route, /const input = parsePortalRequest\(body\);\s*if \(!input\) return membershipError\("INVALID_REQUEST"\);/);
  // `{}`, or exactly one key: `cancel` holding true, or `switchTo` holding one of the two subscription terms.
  assert.match(route, /if \(keys\.length === 0\) return \{\};/);
  assert.match(route, /if \(keys\.length !== 1\) return null;/);
  assert.match(route, /if \(keys\[0\] === "cancel"\) return \(value as \{ cancel: unknown \}\)\.cancel === true \? \{ cancel: true \} : null;/);
  assert.match(route, /if \(keys\[0\] !== "switchTo"\) return null;/);
  assert.match(route, /MEMBERSHIP_SWITCH_TERMS\.find\(\(term\) => term === switchTo\)/);
  assert.match(route, /customer: found\.customerId,/);
  assert.match(route, /const returnUrl = `\$\{config\.appOrigin\}\$\{MEMBERSHIP_RETURN_PATH\}`;/);
  assert.match(route, /return_url: returnUrl,/);
  assert.doesNotMatch(route, /body\.\w+|input\.(customer|price|subscription|return)|searchParams|headers\.get\("(origin|referer)"\)/);
  // One place opens a portal session, with no configuration override from anywhere.
  assert.equal(route.match(/billingPortal\.sessions\.create\(/g)?.length, 1);
  assert.doesNotMatch(route, /configuration:|on_behalf_of|discounts|proration_behavior|promotion_code|retention/);
});

test("deep links are only Stripe's switch or cancel confirmation, for the member's own subscription", async () => {
  const route = code(await read(ROUTE));
  assert.equal(route.match(/flow_data/g)?.length, 1);
  assert.match(route, /\.\.\.\(flowData \? \{ flow_data: flowData \} : \{\}\),/);
  // Every `type:` in the route: the two flows, and the redirect each returns with.
  const types = [...route.matchAll(/type: "([a-z_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(types, ["subscription_update_confirm", "redirect", "subscription_cancel", "redirect"]);
  assert.match(route, /items: \[\{ id: items\[0\]\.id, price: config\.priceIds\[to\], quantity: 1 \}\]/);
  assert.match(route, /subscription_cancel: \{ subscription: subscription\.id \},/);
  assert.match(route, /after_completion: \{ type: "redirect", redirect: \{ return_url: returnUrl \} \}/);
  assert.match(route, /after_completion: \{ type: "redirect", redirect: \{ return_url: `\$\{returnUrl\}\?\$\{PLAN_RETURN_PARAM\}=\$\{PLAN_CANCELLED\}` \} \}/);
  // The subscription comes from Convex, and is this customer's, ours and in this mode before either page opens.
  const own = route.slice(route.indexOf("async function ownSubscription("), route.indexOf("const ending ="));
  assert.match(own, /await stripe\.subscriptions\.retrieve\(found\.subscriptionId\);/);
  assert.match(own, /customer !== found\.customerId \|\|/);
  assert.match(own, /subscription\.metadata\?\.purpose !== MEMBERSHIP_BILLING_PURPOSE \|\|/);
  assert.match(own, /subscription\.livemode !== config\.livemode/);
  assert.equal(route.match(/subscriptions\.retrieve\(/g)?.length, 1);
  const switchBody = route.slice(route.indexOf("async function switchFlow("), route.indexOf("async function cancelFlow("));
  const price = switchBody.indexOf("await assertPriceMatches(stripe, config, to);");
  const owned = switchBody.indexOf("await ownSubscription(stripe, config, found);");
  assert.ok(price > 0 && owned > price, "the Price is checked before the subscription is read");
  const cancelBody = route.slice(route.indexOf("async function cancelFlow("), route.indexOf("export async function POST"));
  assert.match(cancelBody, /const subscription = await ownSubscription\(stripe, config, found\);\s*if \(subscription === "refused"\) return "refused";/);
  assert.match(route, /if \(flow === "refused"\) return membershipError\("INVALID_REQUEST"\);/);
  // The route reads Stripe and opens the portal. It never changes a subscription or takes money itself.
  assert.doesNotMatch(route, /subscriptions\.(update|cancel|create|resume)|subscriptionSchedules|checkout\.sessions|paymentIntents|invoices\./);
});

test("a refused deep link falls back to the portal home for the same customer, and nothing else does", async () => {
  const route = code(await read(ROUTE));
  assert.match(
    route,
    /if \(!flow \|\| errorSummary\(error\)\.name !== "StripeInvalidRequestError"\) throw error;\s*console\.warn\("membership portal flow refused", errorSummary\(error\)\);\s*session = await openSession\(null\);/,
  );
});

test("the route returns only a Stripe portal URL in its own mode", async () => {
  const route = code(await read(ROUTE));
  assert.match(route, /session\.livemode !== config\.livemode \|\| !isStripeRedirect\(session\.url\)/);
  assert.match(route, /new URL\(session\.url\)\.hostname !== "billing\.stripe\.com"/);
  assert.match(route, /readMembershipBillingConfig\(process\.env\)/);
  const logs = route.match(/console\.\w+\([^;]*\);/g) ?? [];
  assert.equal(logs.length, 2);
  for (const line of logs) assert.match(line, /errorSummary\(error\)\);$/);
});

test("Convex reads the customer from the member's session, never from input", async () => {
  const portal = code(await read(PORTAL));
  assert.equal(portal.match(/requireCurrentPlatformUserForMutation\(ctx\)/g)?.length, 1);
  assert.match(portal, /args: \{ livemode: v\.boolean\(\) \}/);
  assert.doesNotMatch(portal, /args\.(ownerId|userId|customerId|email)/);
  assert.doesNotMatch(portal, /ctx\.db\.(insert|patch|replace|delete)\(/);
  assert.doesNotMatch(portal, /\b(query|mutation|action)\(\{/);
  assert.match(portal, /links\.every\(\(link\) => link\.ownerId === member\._id && link\.livemode === args\.livemode\)/);
  assert.match(portal, /return \{ customerId: newest\.stripeCustomerId, subscriptionId: newest\.stripeSubscriptionId \};/);
});

test("the bridge kind names no customer and no owner", async () => {
  const bridge = code(await read("lib/membership-bridge.ts"));
  assert.match(bridge, /\| \{ kind: "open_portal"; livemode: boolean \}/);
  assert.match(bridge, /if \(keys !== "kind,livemode" \|\| typeof candidate\.livemode !== "boolean"\)/);
  assert.doesNotMatch(bridge, /customer/i);
});
