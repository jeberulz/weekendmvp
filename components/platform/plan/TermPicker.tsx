"use client";

import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MembershipTerm } from "@/app/api/platform/membership/_contract";
import type { api } from "@/convex/_generated/api";
import {
  ANNUAL_SAVING_LINE,
  LIFETIME_TRANCHE_LINE,
  MEMBERSHIP_LEGAL_LINKS,
  REFUND_LINE,
  TAX_LINE,
  TERM_COPY,
} from "@/convex/platform/plans";
import { cn } from "@/lib/utils";
import { formatOpening } from "./checkout";

export type Seats = FunctionReturnType<typeof api.platform.membership.queries.ladder>;

export type LifetimeState = {
  shown: boolean;
  soldOut: boolean;
  /** This member's window opens later. The server checks again at checkout. */
  opensAt: number | null;
  selectable: boolean;
  amount: number | undefined;
};

/**
 * Founding Lifetime shows once seats are seeded and a window is dated for
 * this member (WP64-S7). Sold out, or not open yet, keeps it visible and
 * unselectable. `now` is the browser's clock, for display only.
 */
export function lifetimeState(seats: Seats | undefined, now: number): LifetimeState {
  if (!seats?.open || seats.eligibleFrom === null) {
    return { shown: false, soldOut: false, opensAt: null, selectable: false, amount: undefined };
  }
  const soldOut = seats.seatsLeft === 0;
  const opensAt = now < seats.eligibleFrom ? seats.eligibleFrom : null;
  return { shown: true, soldOut, opensAt, selectable: !soldOut && opensAt === null, amount: seats.nextSeatAmountMinor ?? undefined };
}

function seatLine(seats: Seats): string {
  if (seats.seatsLeft > 0) return `${seats.seatsLeft} of ${seats.seatsTotal} founding seats left. ${LIFETIME_TRANCHE_LINE}.`;
  if (seats.seatsHeld > 0) {
    return "No seat is free right now. A seat held by an unfinished checkout comes back if that checkout expires.";
  }
  return `All ${seats.seatsTotal} founding seats are taken.`;
}

/**
 * Says "sold out" once, politely, when the last seat goes while the member
 * is looking. Seat counts otherwise change silently, so a busy launch never
 * floods a screen reader.
 */
function SoldOutAnnouncer({ soldOut }: { soldOut: boolean }) {
  const previous = useRef(soldOut);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (soldOut && !previous.current) setMessage("All founding seats are now taken.");
    previous.current = soldOut;
  }, [soldOut]);
  return (
    <p role="status" className="sr-only">
      {message}
    </p>
  );
}

/**
 * WP64-S6. How to pay, as one native radio group. Each option states the
 * price, the billing period and the renewal in plain words. No option is an
 * add-on, so choosing a term is not a pre-checked box.
 */
export function TermPicker({
  name,
  value,
  onChange,
  seats,
  now,
  compact = false,
}: {
  name: string;
  value: MembershipTerm;
  onChange: (term: MembershipTerm) => void;
  seats: Seats | undefined;
  /** The browser's clock when the page loaded. */
  now: number;
  compact?: boolean;
}) {
  const lifetime = lifetimeState(seats, now);

  // The last seat went while lifetime was chosen: fall back to monthly.
  useEffect(() => {
    if (value === "lifetime" && !lifetime.selectable) onChange("monthly");
  }, [value, lifetime.selectable, onChange]);

  const terms: MembershipTerm[] = lifetime.shown ? ["monthly", "annual", "lifetime"] : ["monthly", "annual"];

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
        Choose how to pay
      </legend>
      <div className={cn("grid gap-3", !compact && "md:grid-cols-2")}>
        {terms.map((term) => {
          const disabled = term === "lifetime" && !lifetime.selectable;
          const describedBy = `${name}-${term}-terms`;
          return (
            <label
              key={term}
              className={cn(
                "flex cursor-pointer gap-3 rounded-[12px] border bg-home-card text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-home-orange-ink",
                compact ? "p-3" : "p-4",
                value === term ? "border-home-ink" : "border-home-rule hover:border-home-ink-3",
                disabled && "cursor-not-allowed bg-home-sunk hover:border-home-rule",
                term === "lifetime" && !compact && "md:col-span-2",
              )}
            >
              <input
                type="radio"
                name={name}
                value={term}
                checked={value === term}
                disabled={disabled}
                onChange={() => onChange(term)}
                aria-describedby={describedBy}
                className="mt-1 size-4 shrink-0 accent-home-ink"
              />
              <span className="flex flex-col gap-1">
                <span className="text-[15px] font-medium text-home-ink">
                  {TERM_COPY[term].name}
                  {disabled ? (
                    <span className="font-normal text-home-ink-2"> · {lifetime.soldOut ? "Sold out" : "Not open yet"}</span>
                  ) : null}
                </span>
                <span id={describedBy} className="flex flex-col gap-0.5 text-[13px] leading-[1.45] text-home-ink-2">
                  <span>{TERM_COPY[term].terms(lifetime.amount)}</span>
                  {term === "annual" ? <span className="text-home-sage-ink">{ANNUAL_SAVING_LINE}.</span> : null}
                  {term === "lifetime" && lifetime.opensAt !== null && !lifetime.soldOut ? (
                    <span>Opens for you on {formatOpening(lifetime.opensAt)}.</span>
                  ) : null}
                  {term === "lifetime" && seats ? <span>{seatLine(seats)}</span> : null}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <SoldOutAnnouncer soldOut={lifetime.soldOut} />
    </fieldset>
  );
}

/** The refund promise, the tax line and the legal links, beside every buy button. */
export function PurchaseFinePrint({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-1 text-[13px] leading-[1.45] text-home-ink-2">
      <p id={id}>
        {REFUND_LINE} {TAX_LINE}
      </p>
      <p className="flex flex-wrap gap-x-3">
        {MEMBERSHIP_LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 items-center text-home-ink underline underline-offset-4 hover:text-home-orange-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink sm:min-h-0"
          >
            {link.label}
          </Link>
        ))}
      </p>
    </div>
  );
}
