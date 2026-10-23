"use client";

import { useEffect, useState, type ReactNode } from "react";
import { UTM } from "@/lib/live/config";
import {
  appendLiveAttribToUrl,
  resolveLiveAttrib,
} from "@/lib/live/attrib";
import { cn } from "@/lib/utils";

const BUTTON =
  "inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-[#A84A00] px-[26px] text-base font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#8F3F00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84A00] sm:w-auto";

/**
 * Luma register CTA that copies utm_* (and src/placement aliases) from the
 * page URL onto the Luma link. First-touch tags persist in sessionStorage so
 * /live → /live/48-hours keeps attribution. SSR href stays the bare Luma URL.
 */
export function LumaRegisterLink({
  href,
  children,
  className,
  variant = "button",
}: {
  /** Bare Luma event URL (no UTMs). */
  href: string;
  children: ReactNode;
  className?: string;
  variant?: "button" | "inline";
}) {
  const [url, setUrl] = useState(href);

  useEffect(() => {
    const attrib = resolveLiveAttrib(window.location.search, UTM.free);
    setUrl(appendLiveAttribToUrl(href, attrib));
  }, [href]);

  if (variant === "inline") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(BUTTON, className)}
    >
      {children}
      <span aria-hidden="true">↗</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
