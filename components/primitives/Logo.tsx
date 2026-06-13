import * as React from "react";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  "aria-label"?: string;
};

/** Brand logo via CSS mask — colored by currentColor (CLAUDE.md a11y rule). */
export function Logo({
  className,
  "aria-label": ariaLabel = "Weekend MVP",
}: LogoProps) {
  return (
    <div
      className={cn("logo", className)}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
