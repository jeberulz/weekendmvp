import {
  LIFETIME_TRANCHE_LINE,
  PLANS,
  PRICING,
  REFUND_LINE,
  TAX_LINE,
  formatUsd,
} from "@/convex/platform/plans";

/**
 * WP64-S9. The Builder's Hub Terms, refund policy and privacy section, as
 * data. Prices and plan features come from `PRICING` and `PLANS`, so the
 * pages never drift from checkout. Drafts until approved (`status.ts`).
 * Rendered by `components/public/LegalPage.tsx`.
 *
 * Two kinds of draft marker, both refused once approved:
 * - `pending` on a section: the wording depends on an open decision (O1 to
 *   O9 in `docs/wp/wp64-stories.md`) or needs a lawyer's or the owner's
 *   review. Where a decision is open, the text is the recommended default.
 * - `{{O2: what}}` inside text: a fact only the owner can supply. Never
 *   invented here.
 *
 * Not legal advice. Plain words on purpose.
 */

export type ReviewBy = "O1" | "O2" | "O3" | "O4" | "O8" | "O9" | "lawyer" | "owner";
export type Pending = { by: ReviewBy; note: string };
export type Block =
  | { kind: "p"; text: string; link?: { href: string; label: string } }
  | { kind: "list"; items: readonly string[] };
export type LegalSection = { id: string; heading: string; blocks: readonly Block[]; pending?: readonly Pending[] };
export type LegalDoc = {
  path: string;
  title: string;
  /** The site footer's link text, once approved. */
  footerLabel: string;
  description: string;
  intro: string;
  sections: readonly LegalSection[];
};

/** A fact only the owner can supply (O2). Rendered highlighted, never shipped. */
const tbc = (what: string) => `{{O2: ${what}}}`;
export const PLACEHOLDER_PATTERN = /\{\{(O\d): ([^}]+)\}\}/g;

const HUB = PLANS.builders_hub.name;
const SEATS = PRICING.lifetime.seats;
const MONTHLY = formatUsd(PRICING.monthly.amountMinor);
const ANNUAL = formatUsd(PRICING.annual.amountMinor);
/** Ruling "WP64 / seller identity" (O2, 2026-10-09). */
const SELLER = "Rulz&Co";
const SUPPORT = "iseghohi.john@gmail.com";

export const TERMS: LegalDoc = {
  path: "/terms",
  title: `${HUB} Terms`,
  footerLabel: "Terms",
  description: `The terms for ${HUB}, the paid plan on Weekend MVP: what it includes, prices, renewal, cancelling and refunds.`,
  intro: `These terms cover ${HUB}, the paid plan on Weekend MVP. The free plan needs no payment and these terms do not change it.`,
  sections: [
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        {
          kind: "p",
          text: `Weekend MVP (weekendmvp.app) is run by ${SELLER}, a trading name of ${tbc("registered company name and company number")}, a private limited company registered in England and Wales, registered office ${tbc("registered office address")}. ${SELLER} is not registered for VAT.`,
        },
        {
          kind: "p",
          text: `Payments for ${HUB} go through Link, a Stripe service that acts as the merchant of record. Link sells the plan to you on our behalf, collects any sales tax or VAT, sends your receipts and handles payment questions. We provide ${HUB} and everything in it.`,
        },
        { kind: "p", text: `In these terms, "we" means ${SELLER} and "you" means the person who buys or uses ${HUB}.` },
      ],
      pending: [{ by: "O2", note: "Registered company name, company number and registered office (UK trading disclosures)." }],
    },
    {
      id: "what-you-get",
      heading: `What ${HUB} includes`,
      blocks: [
        { kind: "p", text: `${HUB} adds these to the free plan:` },
        { kind: "list", items: PLANS.builders_hub.adds },
        { kind: "p", text: "Every idea, score, source and prompt stays free on every plan. We never paywall research." },
        {
          kind: "p",
          text: "Live builds: we run one live build session a month and publish a replay for members afterwards, with captions or a transcript. If we miss a month, we run a make-up session or extend every member's plan by one month.",
        },
      ],
    },
    {
      id: "prices",
      heading: "Prices, billing and renewal",
      blocks: [
        {
          kind: "list",
          items: [
            `Monthly: ${MONTHLY} billed every month. Renews every month until you cancel.`,
            `Annual: ${ANNUAL} billed once a year. Renews every year until you cancel. We email you at least 7 days before each renewal.`,
            `Founding Lifetime: one payment and no renewal. ${LIFETIME_TRANCHE_LINE}. Only ${SEATS} seats exist.`,
          ],
        },
        { kind: "p", text: `${TAX_LINE} You pay at the start of each billing period.` },
        { kind: "p", text: "Link and Stripe process payments. We never see or store your card details." },
      ],
    },
    {
      id: "founding-lifetime",
      heading: "Founding Lifetime",
      blocks: [
        {
          kind: "p",
          text: `Founding Lifetime is one payment for ${HUB}, with no renewal. There are ${SEATS} seats. ${LIFETIME_TRANCHE_LINE}. Your seat number sets your price.`,
        },
        {
          kind: "p",
          text: `"Lifetime" means for as long as we offer ${HUB}. If we stop offering it, we give you at least 90 days' notice and refund part of your payment. The refund starts at the full amount and goes down evenly over three years from the day you paid. After three years there is no refund.`,
        },
        { kind: "p", text: "A seat is for one person. You cannot transfer or resell it." },
      ],
    },
    {
      id: "cancelling",
      heading: "Cancelling",
      blocks: [
        {
          kind: "p",
          text: "You can cancel a monthly or annual plan at any time from Plan and billing, with Manage billing. Your plan stays active until the end of the period you paid for, then ends. We do not charge you again.",
        },
        { kind: "p", text: "Founding Lifetime has nothing to cancel. You can still ask for a refund within 30 days." },
      ],
    },
    {
      id: "refunds",
      heading: "Refunds",
      blocks: [
        {
          kind: "p",
          text: `${REFUND_LINE} This covers monthly, annual and Founding Lifetime. We refund the full amount to the card you paid with. A refund ends your access, and a refunded Founding Lifetime seat goes back into the pool.`,
        },
        {
          kind: "p",
          text: `Renewals: the 30-day window covers your first payment only. If a renewal charges you and you have not used ${HUB} since, ask within 7 days and we may refund it.`,
          link: { href: "/refund-policy", label: "Read the refund policy" },
        },
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights under consumer law",
      blocks: [
        { kind: "p", text: "Nothing in these terms takes away rights you have under the law where you live." },
        {
          kind: "p",
          text: `In the UK and the EU you can usually cancel an online purchase within 14 days. ${HUB} starts as soon as you pay, so when you buy you ask us to start straight away. Our 30-day full refund on your first payment gives you longer than those 14 days.`,
        },
      ],
    },
    {
      id: "payment-problems",
      heading: "Failed payments and disputes",
      blocks: [
        {
          kind: "p",
          text: "If a renewal payment fails, Stripe retries it over about two weeks and your access continues meanwhile. If it still fails, your plan ends. You can update your card from Manage billing.",
        },
        {
          kind: "p",
          text: `If you dispute a payment with your bank, your ${HUB} access is paused while the dispute is open. If it closes in our favour, access comes back. If it closes in yours, the plan ends and we may refuse new purchases on the account until we have spoken with you. Please contact us first: we refund anything the refund policy covers.`,
        },
      ],
    },
    {
      id: "fair-use",
      heading: "Fair use",
      blocks: [
        {
          kind: "list",
          items: [
            "One account is for one person. Do not share your sign-in.",
            "You may use the ideas, prompts and exports for your own projects, including commercial ones.",
            "Do not copy, scrape, resell or republish the research library or prompt packs.",
            "Do not record or rebroadcast live builds. Replays are for members.",
          ],
        },
        {
          kind: "p",
          text: "We may suspend an account that breaks these rules. If we end a paid plan for a serious breach, we tell you why. If we end it for any other reason, we refund the unused part.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        { kind: "p", text: `We may improve ${HUB} over time. We will not remove a feature listed above from paying members without notice.` },
        {
          kind: "p",
          text: "If the price of a monthly or annual plan changes, we email you at least 30 days before your first renewal at the new price, so you can cancel first. Founding Lifetime has no further charges.",
        },
        { kind: "p", text: "If we change these terms in a way that matters to you, we email you before the change applies." },
      ],
    },
    {
      id: "responsibility",
      heading: "Our responsibility to you",
      blocks: [
        { kind: "p", text: "We provide research, plans and prompts to help you build. We do not promise any business result." },
        {
          kind: "p",
          text: "We are responsible for losses you suffer that are a foreseeable result of us breaking these terms or not using reasonable care and skill. We are not responsible for business losses, such as lost profit or lost opportunity. Nothing here limits our liability where the law does not allow it, for example for death or personal injury caused by negligence, or for fraud.",
        },
      ],
    },
    {
      id: "law",
      heading: "Governing law",
      blocks: [
        {
          kind: "p",
          text: "These terms are governed by the law of England and Wales. If you live elsewhere in the UK or in the EU, you keep the protection of the mandatory laws of your country and can bring a claim in your local courts.",
        },
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [{ kind: "p", text: `Questions, refunds and cancellations: ${SUPPORT}. We aim to reply within two working days.` }],
    },
  ],
};

export const REFUND_POLICY: LegalDoc = {
  path: "/refund-policy",
  title: "Refund policy",
  footerLabel: "Refund Policy",
  description: `How refunds work for ${HUB}: a full refund within 30 days of your first payment.`,
  intro: `${REFUND_LINE} This page explains how to ask and what happens next. It is part of the ${HUB} Terms.`,
  sections: [
    {
      id: "in-short",
      heading: "In short",
      blocks: [
        {
          kind: "p",
          text: `${REFUND_LINE} This covers monthly, annual and Founding Lifetime. You do not need to give a reason.`,
          link: { href: "/terms", label: `Read the ${HUB} Terms` },
        },
      ],
    },
    {
      id: "how-to-ask",
      heading: "How to ask",
      blocks: [
        { kind: "p", text: `Email ${SUPPORT} from the address on your account, within 30 days of your first payment.` },
        { kind: "p", text: "We refund the full amount to the card you paid with. Banks usually take 5 to 10 working days to show it." },
      ],
    },
    {
      id: "after-a-refund",
      heading: "What happens after a refund",
      blocks: [
        {
          kind: "list",
          items: [
            "Monthly or annual: the plan is cancelled straight away and your access ends.",
            "Founding Lifetime: your access ends and the seat goes back into the pool, at its own number and price.",
          ],
        },
      ],
    },
    {
      id: "renewals",
      heading: "Renewals",
      blocks: [
        {
          kind: "p",
          text: `The 30-day window covers your first payment only. If a renewal charges you and you have not used ${HUB} since, ask within 7 days and we may refund it. To stop future renewals, cancel from Plan and billing.`,
        },
      ],
    },
    {
      id: "partial-refunds",
      heading: "Partial refunds",
      blocks: [
        {
          kind: "p",
          text: "We do not refund part of a period you have started, except where the Terms or the law say so. Cancelling stops the next charge and keeps your access until the period ends.",
        },
      ],
    },
    {
      id: "disputes",
      heading: "Before you dispute a payment",
      blocks: [
        {
          kind: "p",
          text: `Please contact us before you dispute a payment with your bank. A refund from us is faster. While a dispute is open, your ${HUB} access is paused.`,
        },
      ],
    },
    {
      id: "your-rights",
      heading: "Your rights",
      blocks: [{ kind: "p", text: "This policy adds to your rights under consumer law. It does not replace them." }],
    },
  ],
};

/**
 * WP64-S9. The privacy policy section for Builder's Hub, under the same
 * approval gate as the Terms. It follows the live "Payments" section (PR #129),
 * which already names Stripe and links its privacy policy, so this one covers
 * only what Builder's Hub adds.
 */
export const PRIVACY_MEMBERSHIP: LegalSection = {
  id: "builders-hub",
  heading: HUB,
  blocks: [
    {
      kind: "p",
      text: `${HUB} payments go through Stripe Checkout with Managed Payments. Link, a Stripe service, is the merchant of record: Link and Stripe collect your card details, name and billing address directly, calculate any sales tax or VAT, and send your receipts. We never see or store your card number. Link's and Stripe's privacy policies cover the data they hold.`,
    },
    {
      kind: "p",
      text: "We store, linked to your account: your Stripe customer id, your plan's term, status and renewal or end date, any Founding Lifetime seat number, and the orders and payment events we need to start, renew, refund or end your plan. Those records hold ids, types and outcomes, not card data.",
    },
    {
      kind: "p",
      text: "For the founding offer, we may check whether your email address is on our list of past Weekend MVP buyers or newsletter subscribers. We keep those lists as one-way hashes of the addresses, not the addresses themselves.",
    },
    {
      kind: "p",
      text: "For live builds, we keep the schedule and the links to sessions and replays. We do not keep a list of who joins. If you accept analytics cookies, we count clicks on the join and replay buttons, without the link or the session title. The live session tool has its own privacy policy, which applies when you join.",
    },
  ],
};

export const LEGAL_DOCS = [TERMS, REFUND_POLICY] as const;

/** Every draft marker left in a document or section. Empty means it can be approved. */
export function openItems(...sections: readonly LegalSection[]): string[] {
  const items: string[] = [];
  for (const section of sections) {
    for (const pending of section.pending ?? []) items.push(`${section.id}: ${pending.by}`);
    const text = section.blocks
      .flatMap((block) => (block.kind === "p" ? [block.text] : block.items))
      .join("\n");
    for (const match of text.matchAll(PLACEHOLDER_PATTERN)) items.push(`${section.id}: ${match[1]} placeholder (${match[2]})`);
  }
  return items;
}
