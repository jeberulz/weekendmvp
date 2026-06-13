"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
// Side-effect import: lib/track.ts carries the global window.gtag/window.fbq
// type declarations used below.
import "@/lib/track";

/**
 * DARE seat form, ported from the dare.html inline subscribe handler.
 * Captures the lead via Beehiiv (/api/subscribe) — wire [[CHECKOUT_URL]]
 * (Stripe/Gumroad) for live payment once the checkout is ready.
 */

const DEFAULT_MESSAGE =
  "Your inbox gets: Zoom link · DARE worksheets · 4-Week Plan template · replay after the session. One-time $29.";

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage("Please enter a valid email.");
      setTone("accent");
      return;
    }

    setStatus("loading");
    setMessage("Saving…");
    setTone("muted");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          utm_campaign: "dare-workshop",
          utm_source: "dare",
          utm_medium: "website",
        }),
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

  const buttonLabel =
    status === "success" ? "Seat saved ✓" : "Save my seat · $29";

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
          <span>{status === "loading" ? "Saving…" : buttonLabel}</span>
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
