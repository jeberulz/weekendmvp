import * as React from "react";

type NavExternalLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "target" | "rel"
> & {
  href: string;
};

/**
 * External link that always opens in a new tab with safe rel attributes and
 * a screen-reader hint (CLAUDE.md a11y rule).
 */
export function NavExternalLink({
  children,
  ...props
}: NavExternalLinkProps) {
  return (
    <a target="_blank" rel="noopener noreferrer" {...props}>
      {children}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}
