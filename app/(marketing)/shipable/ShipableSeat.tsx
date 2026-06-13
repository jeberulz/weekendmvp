"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ShipableCheckoutForm } from "./ShipableCheckoutForm";
import "@/lib/track";

/**
 * The #seat section, ported from shipable.html. Default state shows the
 * email → Stripe checkout form; when Stripe redirects back with ?paid=1
 * the inner block swaps to the "You're in" confirmation, fires the
 * purchase conversion events once, strips ?paid (so a refresh doesn't
 * refire the conversion), and scrolls the section into view — exactly
 * like the legacy post-payment script.
 */

function SeatDefault() {
  return (
    <>
      <div className="inline-flex items-center gap-2 mb-6">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#CC5500] animate-pulse"
          aria-hidden="true"
        ></span>
        <span className="sr-only">Live:</span>
        <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-300">
          Save your seat
        </span>
      </div>
      <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
        90 minutes from now,{" "}
        <span className="accent-italic text-[#e9a06a] font-normal">
          it&apos;s live.
        </span>
      </h2>
      <p className="mt-4 text-neutral-300">
        Enter your email to grab your $9 seat. We&apos;ll send your Zoom link,
        the Ship Sheet, and your bonuses.
      </p>
      <ShipableCheckoutForm />
    </>
  );
}

function SeatPaid() {
  useEffect(() => {
    if (typeof window.gtag === "function") {
      window.gtag("event", "purchase", {
        currency: "USD",
        value: 9,
        transaction_id: "shipable-" + Date.now(),
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
      window.fbq("track", "Purchase", { currency: "USD", value: 9 });
    }

    const seat = document.getElementById("seat");
    const timer = setTimeout(
      () => seat?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );

    // Strip ?paid so refresh doesn't refire the conversion event.
    if (window.history?.replaceState) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.hash,
      );
    }

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="inline-flex items-center gap-2 mb-6">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[#e9a06a]"
          aria-hidden="true"
        ></span>
        <span className="font-mono-eyebrow text-[11px] uppercase text-neutral-300">
          Seat saved
        </span>
      </div>
      <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
        You&apos;re in.{" "}
        <span className="accent-italic text-[#e9a06a] font-normal">
          See you Saturday.
        </span>
      </h2>
      <p className="mt-4 text-neutral-300">
        Your Zoom link, Ship Sheet, and bonuses are on the way. Sat Jun 27 ·
        12:00 PM BST.
      </p>
      <p className="mt-2 text-xs text-neutral-400">
        If you don&apos;t see the confirmation in 5 minutes, check spam or
        email hello@weekendmvp.app.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white text-[#1a1a1a] px-7 py-3.5 text-sm font-semibold hover:bg-neutral-100 transition-all focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-[#1a1a1a]"
      >
        Back to Weekend MVP
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </>
  );
}

function SeatSwitch() {
  const searchParams = useSearchParams();
  // Capture once on mount: stripping ?paid via history.replaceState updates
  // useSearchParams in Next, and the confirmation must not flip back.
  const [paid] = useState(() => searchParams.get("paid") === "1");
  return paid ? <SeatPaid /> : <SeatDefault />;
}

export function ShipableSeat() {
  return (
    <section
      id="seat"
      className="px-5 py-20 md:py-28 bg-[#1a1a1a] text-white scroll-mt-24"
    >
      <div className="max-w-xl mx-auto text-center">
        {/* useSearchParams needs a Suspense boundary under Cache Components;
            the fallback is the full default seat content so crawlers and the
            static shell always see the form copy. */}
        <Suspense fallback={<SeatDefault />}>
          <SeatSwitch />
        </Suspense>
      </div>
    </section>
  );
}
