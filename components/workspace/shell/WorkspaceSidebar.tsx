"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { COMING_SOON_TAG, FOCUS } from "@/components/workspace/kit/styles";
import { CreditMeter, creditMeterVisibleLabel } from "@/components/workspace/kit";
import { NAV_ICONS } from "@/components/workspace/shell/nav-icons";
import { groupHeadingId, isRouteActive, visibleNavGroups } from "@/components/workspace/shell/nav-utils";
import type { CreditsSummary } from "@/lib/workspace/credits";
import { COMING_SOON_LABEL, workspaceRoute } from "@/lib/workspace/routes";

export const NAV_PANEL_ID = "workspace-nav-panel";
const MAIN_ID = "workspace-main";

/**
 * Starts with the card's visible text (WCAG 2.5.3). While billing is coming soon
 * the card shows no balance: credits are not metered yet.
 */
export function billingLinkLabel(credits: CreditsSummary): string {
  // L1: credits are not metered yet, so no balance is shown (it would be made up).
  if (workspaceRoute("billing").comingSoon) return `Credits and billing, ${COMING_SOON_LABEL.toLowerCase()}`;
  return `${creditMeterVisibleLabel(credits.balance, credits.max, credits.plan)}, open Billing`;
}

/** L1-C2: the visible text tag on an unbuilt nav row. Plain mono text, as on the Nav board. */
function ComingSoonTag() {
  return <span className={`ml-auto shrink-0 ${COMING_SOON_TAG}`}>{COMING_SOON_LABEL}</span>;
}

export function WorkspaceLogo() {
  return (
    <div role="img" aria-label="Weekend MVP" className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-[5px] bg-home-ink font-editorial text-[15px] italic text-home-card">
        W
      </span>
      <span className="font-editorial text-lg text-home-ink">
        Weekend <em>MVP</em>
      </span>
    </div>
  );
}

/**
 * The only client piece of the shell that reads the pathname. Server-rendered
 * slots (`switcher`, `footer`) arrive as props. One `<nav aria-label="Workspace">`
 * exists at every width: on small screens its panel is behind a disclosure
 * button, on lg and up it is always visible.
 */
export function WorkspaceSidebar({
  projectId,
  weekendActive,
  switcher,
  credits,
  teamBadge,
  userRow,
}: {
  projectId: string;
  weekendActive: boolean;
  switcher: ReactNode;
  credits: CreditsSummary;
  /** The "N need you" badge, rendered inside the Team HQ row. */
  teamBadge?: ReactNode;
  /** The footer user row with sign out. */
  userRow?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const groups = visibleNavGroups(weekendActive);

  // Close the mobile panel after a navigation (adjusting state during render,
  // the documented alternative to an effect).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // A link followed from the open mobile panel closes it. The panel then
  // becomes display:none, so focus is moved to the page's main landmark
  // instead of being lost. Desktop (panel never "open") is untouched.
  function onPanelClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!open) return;
    if (!(event.target instanceof Element) || event.target.closest("a") === null) return;
    setOpen(false);
    setTimeout(() => document.getElementById(MAIN_ID)?.focus(), 0);
  }

  const billing = workspaceRoute("billing");
  const billingActive = isRouteActive(pathname, projectId, billing);
  // Starts with the card's visible text so the name contains it (WCAG 2.5.3).
  const billingLabel = billingLinkLabel(credits);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || !open) return;
    setOpen(false);
    toggleRef.current?.focus();
  }

  return (
    <div
      onKeyDown={onKeyDown}
      className="border-b border-home-rule bg-home-paper lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r"
    >
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 pt-0 lg:pt-4">
        <WorkspaceLogo />
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={NAV_PANEL_ID}
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex min-h-10 items-center gap-2 rounded-full border border-home-rule bg-home-card px-3 text-[13px] font-medium text-home-ink hover:bg-home-sunk lg:hidden ${FOCUS}`}
        >
          {open ? <X aria-hidden="true" className="size-4" /> : <Menu aria-hidden="true" className="size-4" />}
          Menu
        </button>
      </div>
      <div
        id={NAV_PANEL_ID}
        onClickCapture={onPanelClickCapture}
        className={`${open ? "flex" : "hidden"} flex-col gap-3.5 px-3 pb-4 pt-2 lg:flex lg:min-h-[calc(100dvh-4.5rem)]`}
      >
        {switcher}
        <nav aria-label="Workspace" className="flex flex-1 flex-col gap-3.5">
          {groups.map(({ group, routes }) => (
            <div key={group}>
              <p
                id={groupHeadingId(group)}
                className={`px-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] ${
                  group === "This weekend" ? "text-home-orange-ink" : "text-home-ink-3"
                }`}
              >
                {group}
              </p>
              <ul aria-labelledby={groupHeadingId(group)} className="flex flex-col gap-0.5">
                {routes.map((route) => {
                  const active = isRouteActive(pathname, projectId, route);
                  const Icon = NAV_ICONS[route.id];
                  return (
                    <li key={route.id}>
                      <Link
                        href={route.path(projectId)}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-sm text-home-ink hover:bg-home-sunk ${FOCUS} ${
                          active ? "bg-home-sunk font-medium" : "font-normal"
                        }`}
                      >
                        {Icon ? <Icon aria-hidden="true" strokeWidth={1.7} className="size-4 shrink-0" /> : null}
                        <span className={route.comingSoon ? "min-w-0 truncate text-home-ink-2" : "min-w-0 truncate"}>{route.label}</span>
                        {route.id === "team" ? teamBadge : null}
                        {route.comingSoon ? <ComingSoonTag /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <Link
            href={billing.path(projectId)}
            aria-current={billingActive ? "page" : undefined}
            aria-label={billingLabel}
            className={`mt-auto block rounded-lg border border-home-rule px-2.5 pb-2 pt-2.5 hover:bg-home-sunk ${FOCUS} ${
              billingActive ? "bg-home-sunk" : "bg-home-card"
            }`}
          >
            {billing.comingSoon ? (
              <>
                <p className="text-[13px] font-medium text-home-ink">Credits and billing</p>
                <p className={`mt-1 ${COMING_SOON_TAG}`}>{COMING_SOON_LABEL}</p>
              </>
            ) : (
              <CreditMeter balance={credits.balance} max={credits.max} plan={credits.plan} />
            )}
          </Link>
        </nav>
        {userRow}
      </div>
    </div>
  );
}
