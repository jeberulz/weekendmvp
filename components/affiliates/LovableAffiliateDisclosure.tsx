import * as React from "react";

import { LovableAffiliateLink } from "@/components/affiliates/LovableAffiliateLink";
import { cn } from "@/lib/utils";

type LovableAffiliateDisclosureProps = {
  className?: string;
  /**
   * Tone for the surrounding prose. `muted` matches article body secondary
   * lines; `footer` is the compact sitewide line.
   */
  variant?: "inline" | "footer";
};

/**
 * FTC-style affiliate disclosure for pages that link to Lovable.
 * Modelled on the inline disclosure in best-ai-app-builder-non-technical-founders.
 */
export function LovableAffiliateDisclosure({
  className,
  variant = "inline",
}: LovableAffiliateDisclosureProps) {
  if (variant === "footer") {
    return (
      <p
        className={cn(
          "max-w-3xl text-center font-mono text-[11px] leading-[1.45] tracking-[0.04em] text-home-d3 md:text-left",
          className,
        )}
      >
        Affiliate disclosure: some outbound links (including{" "}
        <LovableAffiliateLink className="underline underline-offset-2 transition-colors hover:text-home-d1">
          Lovable
        </LovableAffiliateLink>
        ) are tracking links. Weekend MVP may earn a commission if you sign up.
      </p>
    );
  }

  return (
    <p
      className={cn(
        "mb-6 text-[15px] leading-[1.65] text-home-ink-3",
        className,
      )}
    >
      Disclosure: Weekend MVP may earn a commission if you sign up for{" "}
      <LovableAffiliateLink className="text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none">
        Lovable
      </LovableAffiliateLink>{" "}
      through links on this site.
    </p>
  );
}

/** MDX-friendly alias. */
export const AffiliateDisclosure = LovableAffiliateDisclosure;
