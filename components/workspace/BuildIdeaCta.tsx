"use client";

import Link from "next/link";

import { Icon } from "@/components/home/icons";
import { buttonClass } from "@/components/home/ui";
import { BUILD_CTA_LABEL, buildHref, type BuildCtaLocation } from "@/lib/workspace/build-cta";
import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

type Tone = "primary" | "secondary" | "dark" | "ghost-dark" | "white";

/**
 * "Build this idea, free" (WP74-S5): a real link to `/start/{slug}`. It is
 * server-rendered like any link, so nothing shifts when the page hydrates.
 * The click event goes through `trackEvent`, which does nothing before
 * analytics consent. The visible name stays first in the accessible name
 * and the idea title follows it.
 */
export function BuildIdeaCta({
  slug,
  title,
  location,
  tone = "primary",
  className,
}: {
  slug: string;
  title: string;
  location: BuildCtaLocation;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Link
      href={buildHref(slug)}
      onClick={() =>
        trackEvent("cta_button_clicked", {
          button_location: `build-cta-${location}`,
          button_text: BUILD_CTA_LABEL,
          idea_slug: slug,
        })
      }
      className={cn(buttonClass(tone), className)}
    >
      {BUILD_CTA_LABEL}
      <span className="sr-only"> for {title}</span>
      <Icon name="arrow" size={18} strokeWidth={1.75} />
    </Link>
  );
}
