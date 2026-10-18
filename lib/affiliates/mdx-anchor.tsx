import * as React from "react";

import {
  LOVABLE_AFFILIATE_REL,
  isLovableOutboundUrl,
  resolveLovableAffiliateHref,
} from "@/lib/affiliates/lovable";

type AnchorProps = React.JSX.IntrinsicElements["a"];

/**
 * Shared MDX `<a>` wrapper: Lovable destinations rewrite to the affiliate URL
 * and pick up `rel="sponsored noopener noreferrer"`. Target behaviour is
 * unchanged (MDX links stay same-tab unless the source set `target`).
 */
export function AffiliateAwareAnchor({
  href,
  rel,
  className,
  children,
  ...props
}: AnchorProps) {
  const resolved = resolveLovableAffiliateHref(href) ?? href;
  const sponsored = isLovableOutboundUrl(href);
  const nextRel = sponsored
    ? mergeRel(rel, LOVABLE_AFFILIATE_REL)
    : rel;

  return (
    <a href={resolved} rel={nextRel} className={className} {...props}>
      {children}
    </a>
  );
}

function mergeRel(
  existing: string | undefined,
  required: string,
): string {
  const parts = new Set(
    `${existing ?? ""} ${required}`
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
  return [...parts].join(" ");
}
