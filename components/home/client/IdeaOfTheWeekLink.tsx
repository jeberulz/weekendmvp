"use client";

import Link from "next/link";

import { IDEA_OF_WEEK_CTA_LOCATION, heroCta, heroIdeaHref } from "@/lib/home/hero-cta";
import { trackEvent } from "@/lib/track";
import { useSessionHint } from "@/lib/use-session-hint";
import { Icon } from "../icons";
import { buttonClass } from "../ui";

/**
 * The "Idea of the week" button (WP62). Same destination as the hero link:
 * `/ideas/{slug}` shows a member the research and anyone else the gate. Only
 * the wording follows the session hint, read after hydration; server markup is
 * the visitor's. The hint never decides access.
 */
export function IdeaOfTheWeekLink({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const cta = heroCta(useSessionHint());
  return (
    <Link
      href={heroIdeaHref(slug)}
      onClick={() =>
        trackEvent("cta_button_clicked", {
          button_location: IDEA_OF_WEEK_CTA_LOCATION,
          button_text: cta.label,
          audience: cta.audience,
          idea_slug: slug,
        })
      }
      className={buttonClass("dark", className)}
    >
      {cta.label}
      <span className="sr-only"> for {title}</span>
      <Icon name="arrow" size={18} strokeWidth={1.75} />
    </Link>
  );
}
