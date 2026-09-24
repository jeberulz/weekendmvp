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
          className="block px-4 py-3 rounded-lg text-white bg-white/10 hover:bg-white/15 transition-colors font-medium"
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
          className="block px-4 py-3 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
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

  const loginClass =
    theme === "cream"
      ? "px-3 py-2 text-xs font-medium text-neutral-500 transition-colors hover:text-black focus:outline-none focus-visible:text-black"
      : "px-3 py-2 text-xs font-medium text-neutral-400 transition-colors hover:text-white focus:outline-none focus-visible:text-white";

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
