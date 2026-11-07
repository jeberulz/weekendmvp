"use client";

import Link from "next/link";

import { OWN_IDEA_CTA_LABEL, ownIdeaHref, type OwnIdeaCtaLocation } from "@/lib/workspace/build-cta";
import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

/**
 * "Start building with it" (L1, canvas Main board): the inline link for a
 * founder who brings their own idea. Like `BuildIdeaCta` it is a real link
 * through sign-up (`ownIdeaHref`) to `/start/own`, rendered only behind the
 * launch-workspace flag. The click event goes through `trackEvent`, which does
 * nothing before analytics consent.
 */
export function OwnIdeaCta({
  location,
  dark = false,
  className,
}: {
  location: OwnIdeaCtaLocation;
  dark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={ownIdeaHref()}
      onClick={() =>
        trackEvent("cta_button_clicked", {
          button_location: `own-idea-cta-${location}`,
          button_text: OWN_IDEA_CTA_LABEL,
        })
      }
      className={cn(
        "whitespace-nowrap font-medium underline underline-offset-4 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        dark
          ? "text-home-orange-light decoration-home-d2 hover:text-home-d1 focus-visible:outline-home-orange-light"
          : "text-home-orange-ink hover:text-home-ink focus-visible:outline-home-orange-ink",
        className,
      )}
    >
      {OWN_IDEA_CTA_LABEL}
    </Link>
  );
}
