"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SHIPABLE_WAITLIST_AUTOMATION_ID } from "@/lib/beehiiv-client";
// Side-effect import: lib/track.ts carries the global window.gtag/window.fbq
// type declarations used below.
import "@/lib/track";

/**
 * The $9 seat form, ported from the shipable.html inline seat-form script.
 * Exact legacy sequence:
 *  1. validate email (inline error copy on failure)
 *  2. disable button, swap label to "Sending you to checkout…"
 *  3. fire begin_checkout (GA) + InitiateCheckout (Meta) intent events
 *  4. fire-and-forget Beehiiv waitlist subscribe (never blocks checkout)
 *  5. redirect to the live Stripe Payment Link with prefilled_email +
 *     client_reference_id
 */

// Stripe Checkout (live Payment Link for the $9 ship·able seat).
// Replace this URL if/when you regenerate the link.
const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/aFa00cdgk7v8cym50rbII00";

const DEFAULT_MESSAGE =
  "One-time $9 · Secured by Stripe · Live on Zoom · Replay included.";

type Tone = "neutral" | "error" | "progress";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-neutral-400",
  error: "text-[#e9a06a]",
  progress: "text-neutral-300",
};

export function ShipableCheckoutForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [tone, setTone] = useState<Tone>("neutral");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage("Please enter a valid email.");
      setTone("error");
      return;
    }

    setLoading(true);
    setMessage("Sending you to Stripe checkout…");
    setTone("progress");

    // Fire pre-checkout intent events
    if (typeof window.gtag === "function") {
      window.gtag("event", "begin_checkout", {
        currency: "USD",
        value: 9,
        items: [
          {
            item_id: "shipable-workshop",
            item_name: "ship·able Workshop Seat",
            price: 9,
            quantity: 1,
          },
        ],
      });
    }
    if (typeof window.fbq === "function") {
      window.fbq("track", "InitiateCheckout", { currency: "USD", value: 9 });
    }

    // Best-effort waitlist subscribe; do not block checkout if it fails.
    // automation_ids enrolls the subscriber in the Ship.able Workshop
    // automation. utm_medium=waitlist lets the in-Beehiiv branch send
    // waitlist-specific emails (versus utm_medium=paid which the Stripe
    // webhook sets on completed purchases).
    try {
      fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          utm_source: "shipable",
          utm_medium: "waitlist",
          utm_campaign: "shipable-workshop",
          automation_ids: [SHIPABLE_WAITLIST_AUTOMATION_ID],
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never block checkout */
    }

    // Redirect to Stripe Checkout with email prefilled.
    const url = new URL(STRIPE_CHECKOUT_URL);
    url.searchParams.set("prefilled_email", trimmed);
    url.searchParams.set("client_reference_id", trimmed.slice(0, 200));
    window.location.href = url.toString();
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="mt-8 flex flex-col sm:flex-row gap-3"
        noValidate
      >
        <label htmlFor="seat-email" className="sr-only">
          Email address
        </label>
        <input
          type="email"
          id="seat-email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-white/10 border border-white/20 rounded-full px-5 py-4 text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40 transition-all"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-[#1a1a1a] rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span>{loading ? "Sending you to checkout…" : "Save my seat · $9"}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </form>
      <p
        className={`mt-4 text-xs ${TONE_CLASS[tone]}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </>
  );
}
