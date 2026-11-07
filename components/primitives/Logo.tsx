import * as React from "react";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  "aria-label"?: string;
  /**
   * `wordmark` (default) is the full Weekend MVP logo. `mark` is its first
   * letter, the W, for compact slots (collapsed sidebar, small headers). Give
   * the wordmark an ~8:1 box (h-4 w-32) and the mark a 2:1 box (h-4 w-8).
   */
  variant?: "wordmark" | "mark";
};

/** Brand logo via CSS mask — colored by currentColor (CLAUDE.md a11y rule). */
export function Logo({
  className,
  "aria-label": ariaLabel = "Weekend MVP",
  variant = "wordmark",
}: LogoProps) {
  return (
    <div
      className={cn(variant === "mark" ? "logo-mark" : "logo", className)}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
