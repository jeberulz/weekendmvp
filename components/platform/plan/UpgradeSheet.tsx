"use client";

import { useQuery } from "convex/react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { MembershipTerm } from "@/app/api/platform/membership/_contract";
import { api } from "@/convex/_generated/api";
import { PLANS, PLAN_COMPARISON, upgradeLabel, type GatedFeature } from "@/convex/platform/plans";
import { newsreaderEditorial } from "@/lib/fonts";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import { PurchaseFinePrint, TermPicker, lifetimeState } from "./TermPicker";
import { useMembershipCheckout } from "./useMembershipCheckout";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const BUTTON = cn(
  "inline-flex min-h-11 w-full items-center justify-center rounded-[9px] px-4 text-center text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60",
  FOCUS,
);

const HUB = PLANS.builders_hub.name;

/** What the member reached for, in their words. */
const SHEET_COPY: Record<GatedFeature, { title: string; body: (activeTitle?: string) => string }> = {
  weekend_plan: {
    title: "Start another weekend plan?",
    body: (activeTitle) =>
      activeTitle
        ? `Free includes one active plan, and you are building ${activeTitle}.`
        : "Free includes one active plan.",
  },
  collections: {
    title: "Group your ideas into collections?",
    body: () => `Collections and notes are part of ${HUB}. Your saved list stays free.`,
  },
  prompt_pack: {
    title: "Export a prompt pack?",
    body: () => `Prompt pack export is part of ${HUB}. Every prompt stays free to copy.`,
  },
  compare: {
    title: "Compare ideas side by side?",
    body: () => `Compare is part of ${HUB}. Every idea page stays free to read.`,
  },
};

export type FreeWayForward = { label: string; onSelect: () => void; pending?: boolean };

/**
 * PRD 6.6 surface 2 and 7.4: the point-of-intent sheet. Opens only when a
 * free member reaches for a Builder's Hub feature and the server refused it.
 * A dialog: focus stays inside, Escape closes it, and focus goes back to
 * what opened it. Always offers a free way forward and "Not now".
 */
export function UpgradeSheet({
  open,
  onOpenChange,
  feature,
  activeTitle,
  freeWayForward,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: GatedFeature;
  activeTitle?: string;
  freeWayForward?: FreeWayForward;
  /**
   * The control that asked. The sheet opens after a server round trip, when
   * that control may have been disabled and lost focus, so name it here.
   */
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (open) trackDashboardEvent({ name: "upgrade_prompt_viewed", props: { surface: "sheet", feature } });
  }, [open, feature]);

  const copy = SHEET_COPY[feature];
  const notNow = useRef<HTMLButtonElement>(null);
  // WP63-S6: the sheet starts checkout for the term chosen here.
  const seats = useQuery(api.platform.membership.queries.ladder, open ? {} : "skip");
  const [term, setTerm] = useState<MembershipTerm>("monthly");
  // Browser-only (behind a Convex gate). Display only: checkout checks the window with the server clock.
  const [now] = useState(() => Date.now());
  const checkout = useMembershipCheckout("sheet");
  const pending = checkout.state.kind === "pending";
  const lifetime = lifetimeState(seats, now);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-home-ink/45" />
        <Dialog.Content
          // Radix would focus the first button, which can be the free way
          // forward (archiving a plan). Start on "Not now", the safe choice.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            notNow.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const trigger = returnFocusTo?.current;
            if (trigger?.isConnected && !trigger.matches(":disabled")) trigger.focus();
            else document.getElementById("workspace-main")?.focus();
          }}
          className={cn(
            // Portalled to <body>, outside the dashboard layout, so it brings the serif and the palette.
            newsreaderEditorial.variable,
            "theme-desk fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-5 overflow-y-auto rounded-t-2xl border border-home-rule bg-home-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-sans text-home-ink outline-none",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[14px] sm:p-7",
          )}
        >
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">{HUB}</p>
            <Dialog.Title className="font-editorial text-[26px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink">
              {copy.title}
            </Dialog.Title>
            <Dialog.Description className="text-[15px] leading-[1.5] text-home-ink-2">
              {copy.body(activeTitle)}
            </Dialog.Description>
          </div>

          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Free compared with {HUB}</caption>
            <thead>
              <tr className="border-b border-home-ink font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
                <th scope="col" className="w-1/2 py-2 pr-3 font-normal">
                  Free
                </th>
                <th scope="col" className="w-1/2 py-2 font-normal">
                  {HUB}
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON.map((row) => (
                <tr
                  key={row.feature}
                  className={cn(
                    "border-b border-home-rule",
                    row.feature === feature && "bg-home-sunk font-medium text-home-ink",
                  )}
                >
                  <td className="py-2.5 pl-2 pr-3 text-home-ink-2">{row.free}</td>
                  <td className="py-2.5 pr-2 text-home-ink">{row.hub}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <TermPicker name="sheet-term" value={term} onChange={setTerm} seats={seats} now={now} compact />

          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-disabled={pending || undefined}
              aria-describedby="sheet-fine-print"
              onClick={() => {
                if (pending) return;
                trackDashboardEvent({ name: "upgrade_clicked", props: { surface: "sheet", feature, term } });
                void checkout.start(term);
              }}
              className={cn(BUTTON, "bg-home-ink text-home-card hover:bg-home-panel aria-disabled:cursor-wait aria-disabled:bg-home-panel")}
            >
              {pending ? "Opening secure checkout…" : upgradeLabel(term, lifetime.amount)}
            </button>
            {checkout.state.kind === "error" ? (
              <p role="alert" className="text-sm text-home-clay-ink">
                {checkout.state.message}
              </p>
            ) : null}
            {freeWayForward && (
              <button
                type="button"
                onClick={freeWayForward.onSelect}
                disabled={freeWayForward.pending}
                className={cn(BUTTON, "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3")}
              >
                {freeWayForward.label}
              </button>
            )}
            <Dialog.Close asChild>
              <button ref={notNow} type="button" className={cn(BUTTON, "text-home-ink-2 hover:text-home-ink")}>
                Not now
              </button>
            </Dialog.Close>
          </div>
          <PurchaseFinePrint id="sheet-fine-print" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
