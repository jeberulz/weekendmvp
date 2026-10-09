/// <reference types="vite/client" />

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  IDEMPOTENCY_KEY_PATTERN,
  MEMBERSHIP_CHECKOUT_PATH,
  MEMBERSHIP_ERROR_CODES,
  MEMBERSHIP_PORTAL_PATH,
  MEMBERSHIP_TERMS,
  isStripeRedirect,
  readMembershipRedirect,
} from "../../app/api/platform/membership/_contract";
import { NO_BILLING } from "../../convex/platform/membership/state";
import { MEMBERSHIP_TERM_VALUES } from "../../convex/platform/membership/validators";
import {
  MEMBERSHIP_LEGAL_LINKS,
  PLAN_LIMITS,
  QUIET_PERIOD_MS,
  REFUND_LINE,
  TAX_LINE,
  TERM_COPY,
  upgradeLabel,
} from "../../convex/platform/plans";
import { CheckoutReturn } from "../../components/platform/billing/CheckoutReturn";
import { describePlan } from "../../components/platform/billing/CurrentPlan";
import {
  CONFIRM_SLOW_AFTER_MS,
  checkoutMessage,
  checkoutReturnStatus,
  clearPendingCheckout,
  completionEvents,
  newIdempotencyKey,
  readPendingCheckout,
  rememberPendingCheckout,
  requestCheckout,
  requestPortal,
  type Entitlements,
} from "../../components/platform/plan/checkout";
import { MembershipLadder } from "../../components/platform/plan/MembershipLadder";
import { PlanComparison } from "../../components/platform/plan/PlanComparison";
import { TermPicker, type Seats } from "../../components/platform/plan/TermPicker";
import checkoutSource from "../../components/platform/plan/checkout.ts?raw";
import hookSource from "../../components/platform/plan/useMembershipCheckout.ts?raw";
import returnSource from "../../components/platform/billing/CheckoutReturn.tsx?raw";
import { trackDashboardEvent } from "../../lib/track";

// WP64-S6. Plan and billing, the ladder and the return state, rendered from
// what the server reports. Checkout itself is S3: here the browser side is
// tested against the route contract with a fake fetch.

const convex = vi.hoisted(() => ({ queries: new Map<string, unknown>(), search: "" }));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (query: FunctionReference<"query">, args?: unknown) =>
      args === "skip" ? undefined : convex.queries.get(getFunctionName(query)),
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  };
});
vi.mock("../../components/platform/client-gates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../components/platform/client-gates")>()),
  WhenConvexReady: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../components/platform/plan/flag", () => ({
  BUILDERS_HUB_UI: true,
  UPGRADE_HREF: "/dashboard/billing#builders-hub",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(convex.search),
}));
vi.mock("next/font/google", () => ({
  Newsreader: () => ({ className: "font-serif", variable: "--font-serif", style: { fontFamily: "serif" } }),
}));

const SEATS: Seats = { open: true, seatsTotal: 50, seatsLeft: 34, seatsHeld: 0, nextSeatAmountMinor: 34_900, eligibleFrom: 0 };
const DAY = 24 * 60 * 60 * 1000;
const NOON = Date.UTC(2026, 10, 4, 12);

function entitlements(plan: "free" | "builders_hub", billing: Partial<Entitlements["billing"]> = {}, joinedAt = 0): Entitlements {
  return {
    plan,
    limits: PLAN_LIMITS[plan],
    usage: { activeWeekendPlans: 0, activeWeekendPlansCapped: false },
    joinedAt,
    billing: { ...NO_BILLING, ...billing },
  };
}

function withData(mine: Entitlements | undefined, seats: Seats | undefined = SEATS) {
  convex.queries.set("platform/entitlements:mine", mine);
  convex.queries.set("platform/membership/queries:ladder", seats);
}

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

afterEach(() => {
  convex.queries.clear();
  convex.search = "";
});

describe("WP64-S6 route contract", () => {
  test("terms match the schema and the copy", () => {
    expect([...MEMBERSHIP_TERMS]).toEqual([...MEMBERSHIP_TERM_VALUES]);
    expect(Object.keys(TERM_COPY)).toEqual([...MEMBERSHIP_TERMS]);
  });

  test("only an https Stripe Checkout or Billing Portal URL is followed", () => {
    expect(isStripeRedirect("https://checkout.stripe.com/c/pay/cs_test_1")).toBe(true);
    expect(isStripeRedirect("https://billing.stripe.com/p/session/test_1")).toBe(true);
    for (const bad of [
      "http://checkout.stripe.com/c/pay/cs_test_1",
      "https://checkout.stripe.com.evil.test/c/pay",
      "https://evil.test/?u=https://checkout.stripe.com",
      "https://user:pass@checkout.stripe.com/c/pay",
      "https://user@checkout.stripe.com/c/pay",
      "https://evilcheckout.stripe.com/c/pay",
      "https://sub.checkout.stripe.com/c/pay",
      "https://checkout.stripe.com:8443/c/pay",
      "https://stripe.com/",
      "javascript:alert(1)",
      "/dashboard/billing",
      "",
      42,
      null,
    ]) {
      expect(isStripeRedirect(bad), String(bad)).toBe(false);
    }
  });

  test("route answers are read strictly, and a missing route reads as not open yet", () => {
    const url = "https://checkout.stripe.com/c/pay/cs_test_1";
    expect(readMembershipRedirect(200, { ok: true, url })).toEqual({ ok: true, url });
    expect(readMembershipRedirect(200, { ok: true, url: "https://evil.test" })).toEqual({ ok: false, code: "UNKNOWN" });
    expect(readMembershipRedirect(200, { url })).toEqual({ ok: false, code: "UNKNOWN" });
    expect(readMembershipRedirect(404, null)).toEqual({ ok: false, code: "BILLING_UNAVAILABLE" });
    expect(readMembershipRedirect(503, { ok: false, code: "BILLING_UNAVAILABLE" })).toEqual({ ok: false, code: "BILLING_UNAVAILABLE" });
    expect(readMembershipRedirect(409, { ok: false, code: "SOLD_OUT" })).toEqual({ ok: false, code: "SOLD_OUT" });
    expect(readMembershipRedirect(409, { ok: false, code: "NOT_YET_ELIGIBLE", opensAt: NOON })).toEqual({
      ok: false,
      code: "NOT_YET_ELIGIBLE",
      opensAt: NOON,
    });
    expect(readMembershipRedirect(409, { ok: false, code: "SOLD_OUT", opensAt: NOON })).toEqual({ ok: false, code: "SOLD_OUT" });
    expect(readMembershipRedirect(500, { ok: false, code: "SOMETHING_ELSE" })).toEqual({ ok: false, code: "UNKNOWN" });
  });

  test("checkout posts exactly { term, idempotencyKey } to the membership route", async () => {
    const calls: { path: string; init: RequestInit }[] = [];
    const fetchImpl = async (path: string, init: RequestInit) => {
      calls.push({ path, init });
      return Response.json({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    };
    const key = newIdempotencyKey();
    expect(await requestCheckout("annual", key, fetchImpl)).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(MEMBERSHIP_CHECKOUT_PATH);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("same-origin");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ term: "annual", idempotencyKey: key });
  });

  test("the portal posts an empty body to its own route", async () => {
    const calls: { path: string; body: unknown }[] = [];
    const fetchImpl = async (path: string, init: RequestInit) => {
      calls.push({ path, body: JSON.parse(String(init.body)) });
      return Response.json({ ok: true, url: "https://billing.stripe.com/p/session/test_1" });
    };
    expect((await requestPortal(fetchImpl)).ok).toBe(true);
    expect(calls).toEqual([{ path: MEMBERSHIP_PORTAL_PATH, body: {} }]);
  });

  test("network failures and broken bodies are refusals, never redirects", async () => {
    expect(await requestCheckout("monthly", newIdempotencyKey(), async () => Promise.reject(new Error("offline")))).toEqual({
      ok: false,
      code: "UNKNOWN",
    });
    expect(await requestCheckout("monthly", newIdempotencyKey(), async () => new Response("<html>", { status: 200 }))).toEqual({
      ok: false,
      code: "UNKNOWN",
    });
    expect(await requestCheckout("monthly", newIdempotencyKey(), async () => new Response("Not found", { status: 404 }))).toEqual({
      ok: false,
      code: "BILLING_UNAVAILABLE",
    });
  });

  test("idempotency keys are fresh and fit the route's pattern", () => {
    const keys = new Set(Array.from({ length: 20 }, newIdempotencyKey));
    expect(keys.size).toBe(20);
    for (const key of keys) expect(key).toMatch(IDEMPOTENCY_KEY_PATTERN);
  });

  test("every refusal is plain, and says nothing was charged", () => {
    for (const code of [...MEMBERSHIP_ERROR_CODES, "UNKNOWN"] as const) {
      const message = checkoutMessage(code);
      if (code !== "ALREADY_SUBSCRIBED") expect(message, code).toContain("Nothing was charged.");
      expect(message, code).not.toMatch(/stripe|error|code|_/i);
    }
    expect(checkoutMessage("NOT_YET_ELIGIBLE", NOON)).toContain("November 4, 2026");
    expect(checkoutMessage("BILLING_UNAVAILABLE")).toBe("Checkout isn’t open yet. Nothing was charged.");
  });
});

describe("WP64-S6 return state: the server confirms, the URL never does", () => {
  test("pending checkout is kept per tab, expires after a day and survives bad storage", () => {
    const store = fakeStorage();
    rememberPendingCheckout("lifetime", NOON, store);
    expect(readPendingCheckout(NOON + 1_000, store)).toEqual({ term: "lifetime", startedAt: NOON });
    expect(readPendingCheckout(NOON + DAY + 1, store)).toBeNull();
    clearPendingCheckout(store);
    expect(readPendingCheckout(NOON, store)).toBeNull();
    store.setItem("wmvp:membership-checkout", "{not json");
    expect(readPendingCheckout(NOON, store)).toBeNull();
    store.setItem("wmvp:membership-checkout", JSON.stringify({ term: "weekly", startedAt: NOON }));
    expect(readPendingCheckout(NOON, store)).toBeNull();
    const broken = { ...store, getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } } as Storage;
    expect(() => rememberPendingCheckout("monthly", NOON, broken)).not.toThrow();
    expect(readPendingCheckout(NOON, broken)).toBeNull();
  });

  test("confirming, slow, confirmed and cancelled", () => {
    const free = entitlements("free");
    const monthly = entitlements("builders_hub", { term: "monthly", status: "active" });
    const pendingAnnual = { term: "annual" as const, startedAt: NOON };
    expect(checkoutReturnStatus({ state: "return", entitlements: free, pending: null, slow: false })).toBe("confirming");
    expect(checkoutReturnStatus({ state: "return", entitlements: free, pending: null, slow: true })).toBe("slow");
    expect(checkoutReturnStatus({ state: "return", entitlements: monthly, pending: null, slow: false })).toBe("confirmed");
    // Bought annual: a monthly plan from before is not that purchase.
    expect(checkoutReturnStatus({ state: "return", entitlements: monthly, pending: pendingAnnual, slow: true })).toBe("slow");
    expect(checkoutReturnStatus({ state: "cancelled", entitlements: monthly, pending: null, slow: false })).toBe("cancelled");
    expect(CONFIRM_SLOW_AFTER_MS).toBe(90_000);
  });

  test("paid events fire only for this tab's checkout, and only once confirmed", () => {
    const lifetime = entitlements("builders_hub", { term: "lifetime", status: "active", foundingSeat: 20 });
    const pending = { term: "lifetime" as const, startedAt: NOON };
    expect(completionEvents(null, lifetime)).toEqual([]);
    expect(completionEvents(pending, entitlements("free"))).toEqual([]);
    expect(completionEvents({ term: "annual", startedAt: NOON }, lifetime)).toEqual([]);
    expect(completionEvents(pending, lifetime)).toEqual([
      { name: "checkout_completed", props: { term: "lifetime" } },
      { name: "founding_seat_taken", props: { tranche: "lifetime_t2" } },
    ]);
    expect(completionEvents({ term: "monthly", startedAt: NOON }, entitlements("builders_hub", { term: "monthly", status: "active" }))).toEqual([
      { name: "checkout_completed", props: { term: "monthly" } },
    ]);
  });

  test("the banner reads entitlements: confirming on free, confirmed on Builder's Hub, cancelled says nothing was charged", () => {
    convex.search = "checkout=return";
    const confirming = renderToStaticMarkup(<CheckoutReturn entitlements={entitlements("free")} />);
    expect(confirming).toContain('role="status"');
    expect(confirming).toContain("Confirming your payment.");
    const confirmed = renderToStaticMarkup(<CheckoutReturn entitlements={entitlements("builders_hub", { term: "annual", status: "active" })} />);
    expect(confirmed).toContain("Payment confirmed. Welcome to Builder’s Hub.");
    convex.search = "checkout=cancelled";
    expect(renderToStaticMarkup(<CheckoutReturn entitlements={entitlements("free")} />)).toContain(
      "Checkout was cancelled. Nothing was charged.",
    );
    convex.search = "checkout=paid";
    expect(renderToStaticMarkup(<CheckoutReturn entitlements={entitlements("free")} />)).toBe("");
    convex.search = "";
    expect(renderToStaticMarkup(<CheckoutReturn entitlements={entitlements("free")} />)).toBe("");
  });

  test("source pins: one status function, events after clearing, redirects only to Stripe", () => {
    expect(returnSource).toContain("checkoutReturnStatus({ state, entitlements, pending, slow })");
    const cleared = returnSource.indexOf("clearPendingCheckout();\n    for (const event of events)");
    expect(cleared).toBeGreaterThan(0);
    expect(returnSource).not.toMatch(/useMutation|useAction|fetch\(/);
    expect(hookSource.match(/window\.location\.assign\(result\.url\)/g)).toHaveLength(2);
    expect(hookSource.match(/!result\.ok \|\| !isStripeRedirect\(result\.url\)/g)).toHaveLength(2);
    const started = hookSource.indexOf('name: "checkout_started"');
    expect(started).toBeGreaterThan(hookSource.indexOf("if (!result.ok || !isStripeRedirect(result.url))"));
    expect(checkoutSource).toContain("postForRedirect(MEMBERSHIP_CHECKOUT_PATH, { term, idempotencyKey }, fetchImpl)");
  });
});

describe("WP64-S6 current plan", () => {
  test("each billing state says what the member has, when it renews or ends, and what to do", () => {
    expect(describePlan(entitlements("free"))).toEqual({
      title: "Free",
      detail: "Nothing to pay on the Free plan.",
      notice: null,
      manage: false,
    });
    expect(describePlan(entitlements("builders_hub", { term: "monthly", status: "active", renewsAt: NOON }))).toEqual({
      title: "Builder’s Hub, monthly",
      detail: "$29 a month. Renews on November 4, 2026.",
      notice: null,
      manage: true,
    });
    expect(describePlan(entitlements("builders_hub", { term: "annual", status: "active", endsAt: NOON }))).toMatchObject({
      title: "Builder’s Hub, annual",
      detail: "$199 a year. Set to end on November 4, 2026. You keep access until then.",
      manage: true,
    });
    expect(describePlan(entitlements("builders_hub", { term: "monthly", status: "past_due", renewsAt: NOON }))).toMatchObject({
      notice: "Your last payment didn’t go through. Update your payment method to keep Builder’s Hub.",
      manage: true,
    });
    expect(describePlan(entitlements("builders_hub", { term: "lifetime", status: "active", foundingSeat: 7 }))).toEqual({
      title: "Builder’s Hub, Founding Lifetime",
      detail: "Founding member, seat 7 of 50. Nothing more to pay.",
      notice: null,
      manage: false,
    });
    expect(describePlan(entitlements("builders_hub", { term: "comp", status: "active" }))).toMatchObject({
      title: "Builder’s Hub, complimentary",
      manage: false,
    });
    expect(describePlan(entitlements("free", { term: "monthly", status: "canceled", endsAt: NOON }))).toMatchObject({
      title: "Free",
      detail: "Your monthly plan ended on November 4, 2026.",
      manage: false,
    });
    expect(describePlan(entitlements("free", { term: "annual", status: "unpaid" }))).toMatchObject({
      notice: "Your annual plan is on hold because a payment didn’t go through. Update your payment method to restart it.",
      manage: true,
    });
    expect(describePlan(entitlements("free", { term: "lifetime", status: "suspended", foundingSeat: 7 }))).toMatchObject({
      title: "Builder’s Hub is paused",
      manage: false,
    });
  });
});

describe("WP64-S6 the ladder", () => {
  test("one radio group: price, billing period and renewal in plain words, the real annual saving", () => {
    const html = renderToStaticMarkup(<TermPicker name="t" value="monthly" onChange={() => {}} now={NOON} seats={SEATS} />);
    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>Choose how to pay<\/legend>/);
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toMatch(/<input(?=[^>]*checked="")(?=[^>]*value="monthly")[^>]*>/);
    expect(html).toContain("$29 billed every month. Renews until you cancel.");
    expect(html).toContain("$199 billed once a year. Renews until you cancel.");
    expect(html).toContain("Save 43% compared with 12 months of monthly.");
    expect(html).toContain("$349 once. No renewal.");
    expect(html).toContain("34 of 50 founding seats left. $249 for seats 1 to 15, then $349 for seats 16 to 50.");
    for (const term of ["monthly", "annual", "lifetime"]) {
      expect(html).toContain(`aria-describedby="t-${term}-terms"`);
      expect(html).toContain(`id="t-${term}-terms"`);
    }
    // The sold-out announcer starts empty, so a page load announces nothing.
    expect(html).toMatch(/<p role="status" class="sr-only"><\/p>/);
  });

  test("Founding Lifetime stays hidden until seats are seeded, and is unselectable when sold out", () => {
    const unseeded = renderToStaticMarkup(
      <TermPicker name="t" value="monthly" onChange={() => {}} now={NOON} seats={{ ...SEATS, open: false, seatsLeft: 0, nextSeatAmountMinor: null }} />,
    );
    expect(unseeded.match(/type="radio"/g)).toHaveLength(2);
    expect(unseeded).not.toContain("Founding Lifetime");

    const soldOut = renderToStaticMarkup(
      <TermPicker name="t" value="monthly" onChange={() => {}} now={NOON} seats={{ ...SEATS, seatsLeft: 0, nextSeatAmountMinor: null }} />,
    );
    expect(soldOut).toMatch(/<input(?=[^>]*disabled="")(?=[^>]*value="lifetime")[^>]*>/);
    expect(soldOut).toContain("Founding Lifetime<span");
    expect(soldOut).toContain(" · Sold out");
    expect(soldOut).toContain("All 50 founding seats are taken.");
    // Sold out at load is not news: only a sell-out while watching is announced.
    expect(soldOut).toMatch(/<p role="status" class="sr-only"><\/p>/);

    const held = renderToStaticMarkup(
      <TermPicker name="t" value="monthly" onChange={() => {}} now={NOON} seats={{ ...SEATS, seatsLeft: 0, seatsHeld: 2, nextSeatAmountMinor: null }} />,
    );
    expect(held).toContain("A seat held by an unfinished checkout comes back if that checkout expires.");
  });

  test("the buy button names the price, and the refund line, tax line and legal links sit beside it", () => {
    withData(entitlements("free"));
    const html = renderToStaticMarkup(<MembershipLadder />);
    expect(html).toContain('id="builders-hub"');
    expect(html).toContain(`>${upgradeLabel("monthly")}</button>`);
    expect(html).toMatch(/<button type="button" aria-describedby="ladder-fine-print"/);
    expect(html).toContain(`<p id="ladder-fine-print">${REFUND_LINE} ${TAX_LINE}</p>`);
    for (const link of MEMBERSHIP_LEGAL_LINKS) expect(html).toContain(`href="${link.href}"`);
    expect(html).not.toMatch(/countdown|% off|was \$|line-through|<s>|<del>|defaultChecked/i);
  });
});

describe("WP64-S6 Plan and billing", () => {
  const OLD = Date.now() - 2 * QUIET_PERIOD_MS;

  test("a free member past day one sees their plan, the table and the ladder", () => {
    withData(entitlements("free", {}, OLD));
    const html = renderToStaticMarkup(<PlanComparison />);
    expect(html).toContain("Your plan");
    expect(html).toContain("Nothing to pay on the Free plan.");
    expect(html).toContain('id="builders-hub"');
    expect(html).toContain("Choose how to pay");
    expect(html).not.toContain("Manage billing");
  });

  test("the first day keeps the quiet period: no ladder", () => {
    withData(entitlements("free", {}, Date.now() - 1_000));
    const html = renderToStaticMarkup(<PlanComparison />);
    expect(html).toContain("Your plan");
    expect(html).not.toContain('id="builders-hub"');
  });

  test("a subscriber sees the term, the renewal date and Manage billing, and never the ladder", () => {
    withData(entitlements("builders_hub", { term: "annual", status: "active", renewsAt: NOON }, OLD));
    const html = renderToStaticMarkup(<PlanComparison />);
    expect(html).toContain("Builder’s Hub, annual");
    expect(html).toContain("Renews on November 4, 2026.");
    expect(html).toContain("Manage billing");
    expect(html).not.toContain('id="builders-hub"');
    expect(html).not.toContain("Choose how to pay");
  });

  test("a founding member sees their seat and no Manage billing", () => {
    withData(entitlements("builders_hub", { term: "lifetime", status: "active", foundingSeat: 3 }, OLD));
    const html = renderToStaticMarkup(<PlanComparison />);
    expect(html).toContain("Founding member, seat 3 of 50.");
    expect(html).not.toContain("Manage billing");
    expect(html).not.toContain('id="builders-hub"');
  });

  test("an open dispute hides the ladder", () => {
    withData(entitlements("free", { term: "monthly", status: "suspended" }, OLD));
    const html = renderToStaticMarkup(<PlanComparison />);
    expect(html).toContain("Builder’s Hub is paused");
    expect(html).not.toContain('id="builders-hub"');
  });

  test("returning from Stripe shows the banner above the plan", () => {
    convex.search = "checkout=return";
    withData(entitlements("free", {}, OLD));
    const html = renderToStaticMarkup(<PlanComparison />);
    expect(html.indexOf("Confirming your payment.")).toBeGreaterThan(-1);
    expect(html.indexOf("Confirming your payment.")).toBeLessThan(html.indexOf("Your plan"));
  });
});

describe("WP64-S6 copy and safety pins", () => {
  const surfaces = {
    ...import.meta.glob("../../components/platform/plan/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }),
    ...import.meta.glob("../../components/platform/billing/{CurrentPlan,CheckoutReturn,PlanAndBilling}.tsx", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  } as Record<string, string>;
  const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  test("no price is typed out: every amount comes from PRICING", () => {
    for (const [path, source] of Object.entries(surfaces)) {
      expect(code(source), path).not.toMatch(/\$\d/);
    }
  });

  test("no embedded checkout, card field or client secret in any surface", () => {
    for (const [path, source] of Object.entries(surfaces)) {
      expect(source, path).not.toMatch(/client_secret|clientSecret|stripe-js|loadStripe|EmbeddedCheckout|card_number|payment_method/i);
    }
  });

  test("no timers, strike-through prices, fake discounts or pre-checked boxes", () => {
    for (const [path, source] of Object.entries(surfaces)) {
      expect(source, path).not.toMatch(/countdown|% off|was \$|line-through|<s>|<del>|defaultChecked/i);
    }
  });

  test("the legal links point at the pages S9 publishes", () => {
    expect(MEMBERSHIP_LEGAL_LINKS.map((link) => link.href)).toEqual(["/terms", "/refund-policy"]);
  });

  test("the button names the chosen term's price", () => {
    expect(upgradeLabel("monthly")).toBe("Upgrade to Builder’s Hub · $29/mo");
    expect(upgradeLabel("annual")).toBe("Upgrade to Builder’s Hub · $199/yr");
    expect(upgradeLabel("lifetime", 34_900)).toBe("Upgrade to Builder’s Hub · $349 once");
    expect(upgradeLabel("lifetime")).toBe("Upgrade to Builder’s Hub · $249 once");
  });
});

describe("WP64-S6 events", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("upgrade_clicked carries the term when one was chosen, and nothing when none was", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });
    trackDashboardEvent({ name: "upgrade_clicked", props: { surface: "billing", feature: "weekend_plan", term: "annual" } });
    trackDashboardEvent({ name: "upgrade_clicked", props: { surface: "sidebar", feature: "weekend_plan" } });
    trackDashboardEvent({ name: "upgrade_clicked", props: { surface: "tag", feature: "weekend_plan", term: undefined } });
    trackDashboardEvent({ name: "checkout_started", props: { surface: "sheet", term: "lifetime" } });
    // Strict: toEqual would ignore a forwarded `term: undefined`.
    expect(gtag.mock.calls).toStrictEqual([
      ["event", "upgrade_clicked", { surface: "billing", feature: "weekend_plan", term: "annual" }],
      ["event", "upgrade_clicked", { surface: "sidebar", feature: "weekend_plan" }],
      ["event", "upgrade_clicked", { surface: "tag", feature: "weekend_plan" }],
      ["event", "checkout_started", { surface: "sheet", term: "lifetime" }],
    ]);
  });
});
