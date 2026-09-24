"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasConvexAuthSessionCookie } from "@/lib/auth-session-cookie";
import { cn } from "@/lib/utils";

export { hasConvexAuthSessionCookie } from "@/lib/auth-session-cookie";

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
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(hasConvexAuthSessionCookie(document.cookie));
  }, []);

  if (variant === "mobile") {
    if (signedIn) {
      return (
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="block px-4 py-3 rounded-lg text-center font-semibold text-zinc-950 bg-zinc-100 hover:bg-white transition-colors"
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
          className="block px-4 py-3 rounded-lg text-center font-medium text-neutral-200 border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          onClick={onNavigate}
          className="block px-4 py-3 rounded-lg text-center font-semibold text-zinc-950 bg-zinc-100 hover:bg-white transition-colors"
        >
          Sign up
        </Link>
      </>
    );
  }

  const loginClass = cn(
    "inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2",
    theme === "cream"
      ? "border-neutral-300 text-neutral-700 hover:border-neutral-500 hover:text-black"
      : "border-white/25 text-neutral-200 hover:border-white/45 hover:text-white",
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
      <Link href="/dashboard" className={primaryClass}>
        Dashboard
      </Link>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-2">
      <Link href="/login" className={loginClass}>
        Log in
      </Link>
      <Link href="/signup" className={primaryClass}>
        Sign up
      </Link>
    </div>
  );
}
