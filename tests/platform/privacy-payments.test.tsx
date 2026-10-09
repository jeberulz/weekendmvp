import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import PrivacyPolicyPage from "../../app/(marketing)/privacy-policy/page";

// The privacy policy names Stripe for ship·able seat payments (Payment Link
// via app/api/stripe-webhook), and what that purchase record holds.

vi.mock("next/font/google", () => ({
  Newsreader: () => ({ className: "font-serif", variable: "--font-serif", style: { fontFamily: "serif" } }),
}));

// The live page. WP64-S9's Builder's Hub section is approved, so it shows here too.
vi.stubEnv("NODE_ENV", "production");
const html = renderToStaticMarkup(<PrivacyPolicyPage />);
vi.unstubAllEnvs();
const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

describe("privacy policy: payments", () => {
  test("names Stripe, what the purchase record holds, and that card numbers never reach us", () => {
    expect(html).toContain('id="payments"');
    expect(text).toContain("Stripe processes the payment through a Stripe Payment Link");
    expect(text).toContain("we never see or store your card number");
    expect(text).toContain(
      "your email address, your Stripe customer id, the amount and currency, and the payment link used",
    );
    expect(text).toContain("ship·able workshop emails in Beehiiv");
  });

  test("links Stripe's policy in a new tab and says so", () => {
    expect(html).toMatch(
      /<a target="_blank" rel="noopener noreferrer" href="https:\/\/stripe\.com\/privacy"[^>]*>Stripe&#x27;s privacy policy<span class="sr-only"> \(opens in new tab\)<\/span><\/a>/,
    );
  });

  test("sits before Builder's Hub and Contact and leaves the other sections in place", () => {
    const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual([
      "cookies-and-analytics",
      "your-choices",
      "data-collection",
      "email-collection",
      "payments",
      "builders-hub",
      "contact",
    ]);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});
