import type { ReactNode } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { DefaultLink } from "./DefaultLink";
import { EmployeeAvatar } from "./EmployeeAvatar";
import { BTN_SECONDARY, FOCUS } from "./styles";
import { ROLE_LABELS, type EmployeeIdentity, type LinkComponent } from "./types";

// Server-safe: no hooks and no "use client". Any `linkComponent` passed in must
// itself be usable from the parent's boundary (`next/link` is).

export const CARD_SHELL = "flex flex-col gap-2 rounded-xl border border-home-rule bg-home-paper p-3";

export function WrenMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-5 items-center justify-center bg-home-ink font-editorial text-xs italic text-home-card",
        className,
      )}
    >
      W
    </span>
  );
}

export function WrenMessage({ time, children }: { time: string; children: ReactNode }) {
  return (
    <div data-message="wren" className="flex flex-col gap-1.5 text-sm text-home-ink">
      <p className="flex items-center gap-2 text-[13px]">
        <WrenMark />
        <span className="font-medium">Wren</span>
        <span className="font-mono text-[11px] text-home-ink-3">{time}</span>
      </p>
      <div className="flex flex-col gap-2 leading-relaxed">{children}</div>
    </div>
  );
}

export function FromAttribution({
  from,
  time,
  workstreamHref,
  linkComponent: Link = DefaultLink,
}: {
  from: EmployeeIdentity;
  time: string;
  workstreamHref: string;
  linkComponent?: LinkComponent;
}) {
  const roleLabel = ROLE_LABELS[from.role];
  return (
    <div className="flex items-center gap-2 text-[13px] text-home-ink-2">
      <EmployeeAvatar name={from.name} role={from.role} size="sm" />
      <p>
        <strong className="font-semibold text-home-ink">From {roleLabel}</strong> · {from.name} ·
        routed by Wren · <span className="font-mono text-[11px]">{time}</span>
      </p>
      <Link
        href={workstreamHref}
        className={cn("ml-auto inline-flex min-h-6 items-center underline underline-offset-2", FOCUS)}
      >
        Workstream<span className="sr-only"> · {from.name}, {roleLabel}</span>
      </Link>
    </div>
  );
}

export function MilestoneCard({ title, detail, time }: { title: string; detail: string; time: string }) {
  return (
    <div data-card="milestone" className={CARD_SHELL}>
      <p className="text-[13px] text-home-ink-2">
        Milestone reached: <strong className="font-semibold text-home-ink">{title}</strong>
      </p>
      <div className="flex items-center gap-3 rounded-lg bg-home-sky px-3 py-2 text-home-sky-ink">
        <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full bg-home-card">
          <Globe className="size-4" />
        </span>
        <p className="text-[13px]">
          <span className="block font-semibold">{title}</span>
          <span>
            {detail} · {time}
          </span>
        </p>
      </div>
    </div>
  );
}

export function SiteLiveCard({
  title,
  body,
  url,
  href,
}: {
  title: string;
  body: string;
  url: string;
  href: string;
}) {
  return (
    <div data-card="site-live" className={CARD_SHELL}>
      <p className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-mono text-xs text-home-ink">{url}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bcd0b0] bg-home-sage px-2.5 py-0.5 text-xs font-medium text-home-sage-ink">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          Live
        </span>
      </p>
      <p className="text-sm font-medium text-home-ink">{title}</p>
      <p className="text-[13px] text-home-ink-2">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(BTN_SECONDARY, "self-start")}
      >
        Open site<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}

export function BuildPackCard({
  title,
  titleTail,
  body,
  caption,
  openHref,
  linkComponent: Link = DefaultLink,
}: {
  title: string;
  titleTail: string;
  body: string;
  caption: string;
  openHref: string;
  linkComponent?: LinkComponent;
}) {
  return (
    <div data-card="build-pack" className="flex flex-col gap-2 rounded-xl bg-home-panel p-4 text-home-d1">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-home-orange-light">
        Weekend build pack unlocked
      </p>
      <p className="font-editorial text-xl leading-snug">
        {title} <em>{titleTail}</em>
      </p>
      <p className="text-[13px] text-home-d2">{body}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={openHref}
          className={cn(
            "inline-flex min-h-10 items-center rounded-full bg-home-card px-4 text-[13px] font-medium text-home-ink",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light",
          )}
        >
          Open build pack
        </Link>
        <span className="text-xs text-home-d2">{caption}</span>
      </div>
    </div>
  );
}

export function LaunchPlanNudgeCard({
  message,
  href,
  linkComponent: Link = DefaultLink,
}: {
  message: string;
  href: string;
  linkComponent?: LinkComponent;
}) {
  return (
    <div data-card="launch-plan-nudge" className={CARD_SHELL}>
      <p className="text-sm text-home-ink">{message}</p>
      <Link href={href} className={cn(BTN_SECONDARY, "self-start")}>
        Open weekend launch plan
      </Link>
    </div>
  );
}

