"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";
import { cn } from "@/lib/utils";

// `document.cookie` has no change event. The hint is re-read on each render,
// and the server snapshot keeps hydration on the anonymous markup.
function subscribeToNothing() {
  return () => {};
}

function readSessionHint() {
  return hasSessionHintCookie(document.cookie);
}

function readServerSessionHint() {
  return false;
}

type NavAuthLinksProps = {
  /** Desktop MegaNav trailing CTAs vs mobile sheet stack. */
  variant: "desktop" | "mobile";
  /** MegaNav visual theme (desktop only). */
  theme?: "dark" | "cream";
  /** MegaNav focus ring token (desktop only). */
  ctaRing?: string;
  onNavigate?: () => void;
};

export function NavAuthLinks({
  variant,
  theme = "dark",
  ctaRing,
  onNavigate,
}: NavAuthLinksProps) {
  const signedIn = useSyncExternalStore(
    subscribeToNothing,
    readSessionHint,
    readServerSessionHint,
  );

  if (variant === "mobile") {
    if (signedIn) {
      return (
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex h-12 items-center justify-center rounded-full bg-home-ink px-4 font-semibold text-home-paper transition-colors hover:bg-home-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          Dashboard
        </Link>
      );
    }

    return (
      <>
        <Link
          href="/login"
          onClick={onNavigate}
          className="flex h-12 items-center justify-center rounded-full border border-home-ink px-4 font-medium text-home-ink transition-colors hover:bg-home-ink hover:text-home-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          Login
        </Link>
        <Link
          href="/signup"
          onClick={onNavigate}
          className="flex h-12 items-center justify-center rounded-full bg-home-ink px-4 font-semibold text-home-paper transition-colors hover:bg-home-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          Sign up
        </Link>
      </>
    );
  }

  const loginClass = cn(
    "inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2",
    theme === "cream"
      ? "border-neutral-400 text-neutral-800 hover:border-neutral-600 hover:text-black"
      : "border-white/40 text-neutral-100 hover:border-white/70 hover:text-white",
    ctaRing,
  );

  const primaryClass = cn(
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2",
    theme === "cream"
      ? "bg-neutral-950 text-white hover:bg-black"
      : "bg-zinc-100 text-zinc-950 hover:bg-white",
    ctaRing,
  );

  if (signedIn) {
    return (
      <div className="hidden md:flex items-center gap-2">
        <Link href="/dashboard" className={primaryClass}>
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-2">
      <Link href="/login" className={loginClass}>
        Login
      </Link>
      <Link href="/signup" className={primaryClass}>
        Sign up
      </Link>
    </div>
  );
}
