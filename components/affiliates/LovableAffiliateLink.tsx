import * as React from "react";

import {
  LOVABLE_AFFILIATE_REL,
  LOVABLE_AFFILIATE_URL,
} from "@/lib/affiliates/lovable";
import { cn } from "@/lib/utils";

type LovableAffiliateLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "rel" | "target"
> & {
  /** Open in a new tab with the site's external-link sr-only hint. Default false (MDX inline). */
  newTab?: boolean;
};

/**
 * Clickable Lovable outbound that always points at {@link LOVABLE_AFFILIATE_URL}.
 * Use in TSX and MDX (`<LovableLink>…</LovableLink>`).
 */
export function LovableAffiliateLink({
  children,
  className,
  newTab = false,
  ...props
}: LovableAffiliateLinkProps) {
  return (
    <a
      href={LOVABLE_AFFILIATE_URL}
      rel={LOVABLE_AFFILIATE_REL}
      {...(newTab ? { target: "_blank" } : {})}
      className={cn(className)}
      {...props}
    >
      {children}
      {newTab ? <span className="sr-only"> (opens in new tab)</span> : null}
    </a>
  );
}

/** MDX-friendly alias. */
export const LovableLink = LovableAffiliateLink;
