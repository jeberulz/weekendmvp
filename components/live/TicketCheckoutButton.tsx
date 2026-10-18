"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LiveButton } from "@/components/live/LiveButton";
import { LIVE_BUILDALONG_SIGNUP_SRC } from "@/lib/live/config";

/** returnTo carries src so magic-link / Google land back with attribution. */
const BUILD_ALONG_RETURN = `/live/build-along?src=${LIVE_BUILDALONG_SIGNUP_SRC}#ticket`;

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `live_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `live_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Auth-gated Stripe Checkout for the Build-Along.
 * Signed-out → existing magic-link / Google signup with safe returnTo + src.
 */
export function TicketCheckoutButton({
  label,
  nextSession = false,
  className,
  variant = "primary",
  fullWidth,
}: {
  label: string;
  nextSession?: boolean;
  className?: string;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function signInFirst() {
    const returnTo = encodeURIComponent(BUILD_ALONG_RETURN);
    const src = encodeURIComponent(LIVE_BUILDALONG_SIGNUP_SRC);
    router.push(`/signup?returnTo=${returnTo}&src=${src}`);
  }

  function onClick() {
    setError(null);
    if (isLoading) return;
    if (!isAuthenticated) {
      signInFirst();
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/live/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: newIdempotencyKey(),
            ...(nextSession ? { next: true } : {}),
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; url: string }
          | { ok: false; code: string }
          | null;
        if (!data || !("ok" in data) || !data.ok) {
          const code = data && "code" in data ? data.code : "BILLING_UNAVAILABLE";
          if (code === "AUTHENTICATION_REQUIRED") {
            signInFirst();
            return;
          }
          setError(
            code === "SOLD_OUT"
              ? "Sold out — the next date is Sat 5 Dec."
              : code === "ALREADY_PAID"
                ? "You already have a ticket for this session."
                : code === "EMAIL_NOT_VERIFIED"
                  ? "Verify your email, then try again."
                  : code === "PRICE_NOT_CONFIGURED"
                    ? "Tickets aren't configured yet. Check back soon."
                    : "Checkout isn't available right now. Try again shortly.",
          );
          return;
        }
        window.location.assign(data.url);
      } catch {
        setError("Checkout isn't available right now. Try again shortly.");
      }
    });
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <LiveButton
        type="button"
        variant={variant}
        onClick={onClick}
        className={className}
        disabled={pending || isLoading}
      >
        {pending
          ? "Taking you to checkout…"
          : !isAuthenticated && !isLoading
            ? label
            : label}
      </LiveButton>
      <p className="mt-2 text-center font-mono text-xs text-[#6B6457]">
        No VAT added: Rulz&amp;Co is not VAT-registered.
      </p>
      {error ? (
        <p className="mt-2 text-center text-sm text-[#6B6457]" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
