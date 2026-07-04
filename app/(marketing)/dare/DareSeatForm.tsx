"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
// Side-effect import: lib/track.ts carries the global window.gtag/window.fbq
// type declarations used below.
import "@/lib/track";

/**
 * DARE seat form. Two modes, decided by NEXT_PUBLIC_DARE_CHECKOUT_URL:
 *
 *  - Checkout mode (URL set): the ShipableCheckoutForm sequence — validate,
 *    fire begin_checkout (GA) + InitiateCheckout (Meta), fire-and-forget
 *    Beehiiv waitlist subscribe, redirect to the Stripe Payment Link with
 *    prefilled_email + client_reference_id. The Stripe webhook
 *    (checkout.session.completed) handles paid enrollment server-side.
 *
 *  - Waitlist mode (URL unset — the pre-launch draft state): capture the
 *    lead via Beehiiv (/api/subscribe) only, as before.
 *
 * NEXT_PUBLIC_* vars are inlined at build time — after setting the payment
 * link in Vercel, trigger a fresh build (see CLAUDE.md analytics gotcha).
 */

const DARE_CHECKOUT_URL = process.env.NEXT_PUBLIC_DARE_CHECKOUT_URL ?? "";

const DEFAULT_MESSAGE = DARE_CHECKOUT_URL
  ? "One-time $29 · Secured by Stripe · Live on Zoom · Replay included."
  : "Your inbox gets: Zoom link · DARE worksheets · 4-Week Plan template · replay after the session. One-time $29.";

type Status = "idle" | "loading" | "success" | "error";
type Tone = "neutral" | "muted" | "accent" | "success";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-neutral-400",
  muted: "text-neutral-500",
  accent: "text-[#A7C0F2]",
  success: "text-white",
};

export function DareSeatForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [tone, setTone] = useState<Tone>("neutral");

  const subscribePayload = (trimmed: string) =>
    JSON.stringify({
      email: trimmed,
      utm_campaign: "dare-workshop",
      utm_source: "dare",
      utm_medium: DARE_CHECKOUT_URL ? "waitlist" : "website",
    });

  const startCheckout = (trimmed: string) => {
    setStatus("loading");
    setMessage("Sending you to Stripe checkout…");
    setTone("muted");

    // Fire pre-checkout intent events
    if (typeof window.gtag === "function") {
      window.gtag("event", "begin_checkout", {
        currency: "USD",
        value: 29,
        items: [
          {
            item_id: "dare-live",
            item_name: "DARE Live Seat",
            price: 29,
            quantity: 1,
          },
        ],
      });
    }
    if (typeof window.fbq === "function") {
      window.fbq("track", "InitiateCheckout", { currency: "USD", value: 29 });
    }

    // Best-effort waitlist subscribe; never block checkout if it fails.
    try {
      fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: subscribePayload(trimmed),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never block checkout */
    }

    const url = new URL(DARE_CHECKOUT_URL);
    url.searchParams.set("prefilled_email", trimmed);
    url.searchParams.set("client_reference_id", trimmed.slice(0, 200));
    window.location.href = url.toString();
  };

  const saveSeat = async (trimmed: string) => {
    setStatus("loading");
    setMessage("Saving…");
    setTone("muted");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: subscribePayload(trimmed),
      });
      if (!res.ok) throw new Error("Subscribe failed");

      setEmail("");
      if (typeof window.gtag === "function") {
        window.gtag("event", "dare_seat_saved");
      }
      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead");
      }
      setMessage(
        "You're on the list. Check your inbox to confirm your seat.",
      );
      setTone("success");
      setStatus("success");
    } catch {
      setMessage("Something went wrong. Try again in a moment.");
      setTone("accent");
      setStatus("error");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage("Please enter a valid email.");
      setTone("accent");
      return;
    }
    if (DARE_CHECKOUT_URL) startCheckout(trimmed);
    else void saveSeat(trimmed);
  };

  const buttonLabel =
    status === "loading"
      ? DARE_CHECKOUT_URL
        ? "Sending you to checkout…"
        : "Saving…"
      : status === "success"
        ? "Seat saved ✓"
        : "Save my seat · $29";

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
          disabled={status === "loading" || status === "success"}
          className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-[#1a1a1a] rounded-full text-sm font-semibold hover:bg-neutral-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span>{buttonLabel}</span>
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
