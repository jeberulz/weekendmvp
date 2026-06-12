import * as React from "react";
import { cn } from "@/lib/utils";

type IconButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> & {
  /** Required: icon-only buttons must name their action for screen readers. */
  "aria-label": string;
};

/**
 * Icon-only button that cannot ship without an aria-label (CLAUDE.md a11y rule).
 * Children are treated as decorative and wrapped with aria-hidden.
 */
export function IconButton({
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button type={type} className={cn(className)} {...props}>
      <span aria-hidden="true" className="contents">
        {children}
      </span>
    </button>
  );
}
