"use client";

import { useConvex, useConvexAuth } from "convex/react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { api } from "@/convex/_generated/api";
import { LocalTime } from "@/components/live/LocalTime";
import { BUILD_ALONG, liveZoomUrl } from "@/lib/live/config";

type WorkshopStatus = {
  kind: "none" | "pending" | "paid";
  seatsLeft: number | null;
  seatNumber?: number;
  sessionStartsAt: number;
  orderId?: string;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `live_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `live_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * One-shot dashboard status (no live Convex subscription).
 * Abandoned → Finish card while seats remain and before session start.
 * Paid → ticket card with GMT + local time, join link, replay note.
 */
export function WorkshopDashboardCards({ nowMs }: { nowMs: number }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const convex = useConvex();
  const [status, setStatus] = useState<WorkshopStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    void convex
      .query(api.live.workshopQueries.myStatus, { nowMs })
      .then((row) => {
        if (!cancelled) setStatus(row);
      })
      .catch(() => {
        /* leave status null */
      });
    return () => {
      cancelled = true;
    };
  }, [convex, isAuthenticated, isLoading, nowMs]);

  const active = isAuthenticated && !isLoading ? status : null;
  if (!active) return null;

  const beforeSession = nowMs < active.sessionStartsAt;
  const seatsRemain = active.seatsLeft === null || active.seatsLeft > 0;
  const showAbandoned =
    active.kind === "pending" && beforeSession && seatsRemain;
  const showPaid = active.kind === "paid";

  if (!showAbandoned && !showPaid) return null;

  function continueCheckout() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/live/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idempotencyKey: newIdempotencyKey() }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; url: string }
          | { ok: false; code: string }
          | null;
        if (!data || !data.ok) {
          const code = data && "code" in data ? data.code : "BILLING_UNAVAILABLE";
          setError(
            code === "SOLD_OUT"
              ? "Sold out — see the next date on the ticket page."
              : "Couldn't restart checkout. Try again shortly.",
          );
          return;
        }
        window.location.assign(data.url);
      } catch {
        setError("Couldn't restart checkout. Try again shortly.");
      }
    });
  }

  const zoom = liveZoomUrl();

  return (
    <section className="flex flex-col gap-4" aria-label="Build-Along ticket">
      {showAbandoned ? (
        <div className="rounded-[14px] border border-home-rule bg-home-card px-5 py-4">
          <h2 className="font-editorial text-xl font-medium tracking-tight text-home-ink">
            Finish your Build-Along ticket
          </h2>
          <p className="mt-1.5 text-sm text-home-ink-2">
            You started checkout for Sat 14 Nov 2026, 15:00–17:00 GMT. Seats are
            still open — continue at today&apos;s price.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={continueCheckout}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-md bg-home-orange px-4 py-2 text-sm font-medium text-white hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:opacity-60"
            >
              {pending ? "Opening checkout…" : "Continue"}
            </button>
            <Link
              href="/live/build-along#ticket"
              className="text-sm text-home-ink-2 underline underline-offset-4"
            >
              Ticket page
            </Link>
          </div>
          {error ? (
            <p className="mt-2 text-sm text-home-ink-2" role="status">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {showPaid ? (
        <div className="rounded-[14px] border border-home-rule bg-home-card px-5 py-4">
          <h2 className="font-editorial text-xl font-medium tracking-tight text-home-ink">
            Your Build-Along ticket
          </h2>
          {active.seatNumber !== undefined ? (
            <p className="mt-1 font-mono text-xs text-home-ink-2">
              Seat {active.seatNumber} of 20
            </p>
          ) : null}
          <p className="mt-2 text-sm text-home-ink">
            Sat 14 Nov 2026 · 15:00–17:00 GMT
          </p>
          <LocalTime startMs={BUILD_ALONG.startAt} endMs={BUILD_ALONG.endAt} />
          <div className="mt-3 space-y-1.5 text-sm">
            {zoom ? (
              <p>
                <a
                  href={zoom}
                  className="font-medium text-home-orange-ink underline underline-offset-4"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Join on Zoom
                </a>
              </p>
            ) : (
              <p className="text-home-ink-2">
                Join link arrives by email before the session.
              </p>
            )}
            <p className="text-home-ink-2">Replay later — no expiry.</p>
          </div>
          <p className="mt-3">
            <Link
              href="/live/build-along"
              className="text-sm text-home-ink-2 underline underline-offset-4"
            >
              Session details
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
