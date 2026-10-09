/// <reference types="vite/client" />

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import TermsPage, { generateMetadata as termsMetadata } from "../../app/(marketing)/terms/page";
import RefundPolicyPage, { generateMetadata as refundMetadata } from "../../app/(marketing)/refund-policy/page";
import PrivacyPolicyPage from "../../app/(marketing)/privacy-policy/page";
import { CONSENT_MAX_LENGTH, checkoutConsentMessage } from "../../app/api/platform/membership/_consent";
import { LegalText } from "../../components/public/LegalPage";
import {
  LEGAL_DOCS,
  PRIVACY_MEMBERSHIP,
  REFUND_POLICY,
  TERMS,
  openItems,
} from "../../lib/legal/content";
import { MEMBERSHIP_LEGAL_APPROVED, legalPagesVisible } from "../../lib/legal/status";
import {
  LIFETIME_TRANCHE_LINE,
  MEMBERSHIP_LEGAL_LINKS,
  PLANS,
  PRICING,
  REFUND_LINE,
  TAX_LINE,
  formatUsd,
} from "../../convex/platform/plans";
import sitemapSource from "../../app/sitemap.ts?raw";
import footerSource from "../../components/layout/SiteFooter.tsx?raw";
import privacySource from "../../app/(marketing)/privacy-policy/page.tsx?raw";

// WP64-S9. The Builder's Hub Terms, refund policy, privacy section and the
// Checkout consent sentence.

vi.mock("next/font/google", () => ({
  Newsreader: () => ({ className: "font-serif", variable: "--font-serif", style: { fontFamily: "serif" } }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

const ALL_SECTIONS = [...TERMS.sections, ...REFUND_POLICY.sections, PRIVACY_MEMBERSHIP];
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

function notFoundDigest(render: () => unknown): string | undefined {
  try {
    render();
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
  return undefined;
}

describe("WP64-S9 the approval gate", () => {
  test("approved by the owner, so the pages show in production as well as development", () => {
    // Rulings "WP64 / Terms sign-off" and "WP64 / legal pages live" (2026-10-09).
    expect(MEMBERSHIP_LEGAL_APPROVED).toBe(true);
    expect(legalPagesVisible("production")).toBe(true);
    expect(legalPagesVisible("development")).toBe(true);
    expect(legalPagesVisible("test")).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(notFoundDigest(() => renderToStaticMarkup(<TermsPage />))).toBeUndefined();
    expect(notFoundDigest(() => renderToStaticMarkup(<RefundPolicyPage />))).toBeUndefined();

    vi.stubEnv("NODE_ENV", "development");
    expect(notFoundDigest(() => renderToStaticMarkup(<TermsPage />))).toBeUndefined();
    expect(notFoundDigest(() => renderToStaticMarkup(<RefundPolicyPage />))).toBeUndefined();
  });

  test("approval is refused while any open decision or placeholder remains", () => {
    // Approved, so nothing may remain open.
    expect(MEMBERSHIP_LEGAL_APPROVED).toBe(true);
    expect(openItems(...ALL_SECTIONS)).toEqual([]);
    // The check still finds a review note or a gap if one is added back.
    expect(openItems({ id: "x", heading: "X", blocks: [{ kind: "list", items: ["{{O2: a fact}}"] }] })).toEqual([
      "x: O2 placeholder (a fact)",
    ]);
    expect(openItems({ id: "y", heading: "Y", blocks: [], pending: [{ by: "owner", note: "Check this." }] })).toEqual(["y: owner"]);
  });

  test("approved pages are indexable, with their own canonical, in production too", () => {
    for (const nodeEnv of ["production", "development"]) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      expect(termsMetadata().robots).toBeUndefined();
      expect(refundMetadata().robots).toBeUndefined();
      expect(termsMetadata().alternates?.canonical).toBe("/terms");
      expect(refundMetadata().alternates?.canonical).toBe("/refund-policy");
      expect(termsMetadata().title).toBe("Builder’s Hub Terms");
    }
  });

  test("the sitemap and footer list the pages only once approved", () => {
    expect(sitemapSource).toMatch(/\.\.\.\(MEMBERSHIP_LEGAL_APPROVED\s*\?\s*LEGAL_DOCS\.map/);
    expect(footerSource).toMatch(/\{MEMBERSHIP_LEGAL_APPROVED\s*\?\s*LEGAL_DOCS\.map/);
  });

  test("the dashboard's legal links point at these routes", () => {
    expect(MEMBERSHIP_LEGAL_LINKS.map((link) => link.href)).toEqual(LEGAL_DOCS.map((doc) => doc.path));
  });
});

describe("WP64-S9 the Terms", () => {
  vi.stubEnv("NODE_ENV", "development");
  const html = renderToStaticMarkup(<TermsPage />);
  const body = text(html);
  vi.unstubAllEnvs();

  test("cover every topic the story asks for, in order", () => {
    expect(TERMS.sections.map((section) => section.id)).toEqual([
      "who-we-are",
      "what-you-get",
      "prices",
      "founding-lifetime",
      "changing-plan",
      "cancelling",
      "refunds",
      "your-rights",
      "payment-problems",
      "fair-use",
      "changes",
      "responsibility",
      "law",
      "contact",
    ]);
    for (const section of TERMS.sections) {
      expect(html).toContain(`id="${section.id}"`);
      expect(html).toContain(`href="#${section.id}"`);
    }
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.match(/<main\b/g)).toHaveLength(1);
  });

  test("prices, features and refund come from the plan constants", () => {
    expect(body).toContain(`Monthly: ${formatUsd(PRICING.monthly.amountMinor)} billed every month`);
    expect(body).toContain(`Annual: ${formatUsd(PRICING.annual.amountMinor)} billed once a year`);
    expect(body).toContain(LIFETIME_TRANCHE_LINE);
    expect(body).toContain(`Only ${PRICING.lifetime.seats} seats exist.`);
    for (const item of PLANS.builders_hub.adds) expect(body).toContain(item);
    expect(body).toContain(REFUND_LINE);
    expect(body).toContain(TAX_LINE);
    // No hand-typed prices anywhere in the content.
    const source = JSON.stringify(LEGAL_DOCS) + JSON.stringify(PRIVACY_MEMBERSHIP);
    const typed = source.match(/\$\d+/g) ?? [];
    const allowed = new Set(
      [PRICING.monthly.amountMinor, PRICING.annual.amountMinor, ...PRICING.lifetime.tranches.map((t) => t.amountMinor)].map(
        formatUsd,
      ),
    );
    for (const amount of typed) expect(allowed.has(amount), amount).toBe(true);
  });

  test("state the live build, the missed-month remedy and the lifetime clause", () => {
    expect(body).toContain("one live build session a month");
    expect(body).toContain("we run a make-up session or extend every member's plan by one month");
    expect(body).toContain("at least 90 days' notice");
    expect(body).toContain("goes down evenly over three years");
    expect(body).toContain("you can usually cancel an online purchase within 14 days");
    expect(body).toContain("Link and Stripe process payments. We never see or store your card details.");
  });

  test("say how switching plans works, and that a switch refunds nothing automatically (O5)", () => {
    expect(body).toContain("Monthly to annual starts straight away.");
    expect(body).toContain("less a credit for the unused part of your current month");
    expect(body).toContain("Annual to monthly starts when your annual year ends.");
    expect(body).toContain("your monthly or annual plan stops renewing and we do not charge you for it again.");
    expect(body).toContain("does not refund the time you already paid for automatically");
    expect(body).toContain("You can still ask for the 30-day refund on your first payment.");
  });

  test("name the seller and Link as merchant of record (O1, O2)", () => {
    expect(body).toContain("is run by Rulz&Co,");
    expect(body).toContain("Rulz&Co is not registered for VAT.");
    expect(body).toContain("go through Link, a Stripe service that acts as the merchant of record.");
    expect(body).toContain("Questions, refunds and cancellations: iseghohi.john@gmail.com.");
  });

  test("live: no draft banner, review notes, gaps or raw markers", () => {
    expect(body).not.toContain("Draft for review. Not in force.");
    expect(body).not.toContain("Draft: October 2026");
    expect(body).toContain("Last updated: October 2026");
    expect(body).not.toMatch(/Open decision|For the lawyer:|To be confirmed/);
    expect(html).not.toContain("<mark");
    expect(html).not.toContain("{{");
  });

  test("until the owner sends them, the company's registered details are offered by email (O2)", () => {
    expect(body).toContain("a trading name of a private limited company registered in England and Wales.");
    expect(body).toContain("For the company's registered name, number and office, email iseghohi.john@gmail.com.");
  });

  test("gaps render as marks with the text around them intact", () => {
    expect(renderToStaticMarkup(<LegalText text="Run by {{O2: name}}, at {{O2: address}}." />)).toBe(
      'Run by <mark class="rounded-sm bg-home-note px-1 text-home-ink">To be confirmed (O2): name</mark>, at ' +
        '<mark class="rounded-sm bg-home-note px-1 text-home-ink">To be confirmed (O2): address</mark>.',
    );
    expect(renderToStaticMarkup(<LegalText text="No gaps." />)).toBe("No gaps.");
  });

  test("link to the refund policy", () => {
    expect(html).toContain('href="/refund-policy"');
  });
});

describe("WP64-S9 the refund policy", () => {
  vi.stubEnv("NODE_ENV", "development");
  const html = renderToStaticMarkup(<RefundPolicyPage />);
  const body = text(html);
  vi.unstubAllEnvs();

  test("states the 30-day full refund, how to ask, renewals and disputes", () => {
    expect(body).toContain(REFUND_LINE);
    expect(body).toContain("You do not need to give a reason.");
    expect(body).toContain("the seat goes back into the pool");
    expect(body).toContain("The 30-day window covers your first payment only.");
    expect(body).toContain("While a dispute is open");
    expect(html).toContain('href="/terms"');
    expect(body).toContain("Email iseghohi.john@gmail.com from the address on your account");
    expect(html).not.toContain("<mark");
  });
});

describe("WP64-S9 the privacy policy", () => {
  const sectionIds = (html: string) => [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
  const LIVE_IDS = ["cookies-and-analytics", "your-choices", "data-collection", "email-collection", "payments", "contact"];

  test("adds a Builder's Hub section after Payments, now in production too", () => {
    for (const nodeEnv of ["production", "development"]) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      const html = renderToStaticMarkup(<PrivacyPolicyPage />);
      const page = text(html);
      // The rest of the policy (with its Payments section, PR #129) is unchanged around it.
      expect(sectionIds(html)).toEqual([...LIVE_IDS.slice(0, -1), "builders-hub", "contact"]);
      expect(page).toContain("Builder’s Hub payments go through Stripe Checkout with Managed Payments.");
      expect(page).toContain("Link, a Stripe service, is the merchant of record");
      expect(page).toContain("We never see or store your card number.");
      expect(page).toContain("your Stripe customer id");
      expect(page).toContain("Founding Lifetime seat number");
      expect(page).toContain("one-way hashes of the addresses");
      expect(page).toContain("We do not keep a list of who joins.");
      expect(page).not.toContain("Review notes");
    }
  });

  test("the section sits between Payments and Contact, behind the gate", () => {
    expect(privacySource).toContain("{legalPagesVisible() ? <LegalSectionRow section={PRIVACY_MEMBERSHIP} /> : null}");
    expect(privacySource.indexOf('id="payments"')).toBeLessThan(privacySource.indexOf("PRIVACY_MEMBERSHIP} />"));
    expect(privacySource.indexOf("PRIVACY_MEMBERSHIP} />")).toBeLessThan(privacySource.indexOf('id="contact"'));
  });
});

describe("WP64-S9 the Checkout consent sentence", () => {
  const origin = "https://weekendmvp.app";

  test("one sentence per term: price, renewal and refund, linking both pages", () => {
    expect(checkoutConsentMessage({ term: "monthly", origin })).toBe(
      "I agree to the [Builder’s Hub Terms](https://weekendmvp.app/terms): $29 a month, renewing every month until I cancel, " +
        "with a full refund within 30 days of my first payment under the [refund policy](https://weekendmvp.app/refund-policy).",
    );
    expect(checkoutConsentMessage({ term: "annual", origin })).toContain(": $199 a year, renewing every year until I cancel, with");
    expect(checkoutConsentMessage({ term: "lifetime", origin, lifetimeAmountMinor: 24_900 })).toContain(
      ": $249 once, with no renewal, with a full refund",
    );
    expect(checkoutConsentMessage({ term: "lifetime", origin, lifetimeAmountMinor: 34_900 })).toContain(": $349 once,");
    for (const term of ["monthly", "annual", "lifetime"] as const) {
      const message = checkoutConsentMessage({ term, origin, lifetimeAmountMinor: 24_900 });
      expect(message.length).toBeLessThanOrEqual(CONSENT_MAX_LENGTH);
      // One sentence once the link targets are set aside.
      expect(message.replace(/\]\([^)]+\)/g, "]").match(/\./g)).toHaveLength(1);
      expect(message).toContain(`(${origin}${TERMS.path})`);
      expect(message).toContain(`(${origin}${REFUND_POLICY.path})`);
    }
  });

  test("a lifetime sentence needs a real tranche amount", () => {
    expect(() => checkoutConsentMessage({ term: "lifetime", origin })).toThrow("tranche");
    expect(() => checkoutConsentMessage({ term: "lifetime", origin, lifetimeAmountMinor: 29_900 })).toThrow("tranche");
    // Monthly and annual ignore any amount passed.
    expect(checkoutConsentMessage({ term: "monthly", origin, lifetimeAmountMinor: 1 })).toContain("$29 a month");
  });

  test("links go only to a bare https origin, or this machine in test mode", () => {
    expect(checkoutConsentMessage({ term: "monthly", origin: "http://localhost:3000" })).toContain(
      "(http://localhost:3000/terms)",
    );
    for (const bad of [
      "http://weekendmvp.app",
      "https://weekendmvp.app/",
      "https://weekendmvp.app/terms",
      "https://user@weekendmvp.app",
      "javascript:alert(1)",
      "weekendmvp.app",
      "",
    ]) {
      expect(() => checkoutConsentMessage({ term: "monthly", origin: bad }), bad).toThrow("Consent origin");
    }
  });
});
