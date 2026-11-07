"use client";

import Link from "next/link";

import { Icon } from "@/components/home/icons";
import {
  OWN_IDEA_PATH,
  PICK_LIBRARY_IDEA_LABEL,
  START_BUILDING_LABEL,
} from "@/lib/workspace/build-cta";
import { trackEvent } from "@/lib/track";

/** The workspace library, so a member picks an idea without leaving the workspace. */
const LIBRARY_PATH = "/dashboard/explore";

/**
 * L1-C9: the dashboard's way into the build wizard. The dashboard is
 * signed-in only, so "Start building" links straight to `/start/own` with no
 * sign-up hop; the secondary link opens the library, where each idea page has
 * its own build button. Rendered only behind the launch-workspace flag
 * (`buildCtaVisible`). The wizard re-checks access; the link grants nothing.
 * Clicks go through `trackEvent`, which does nothing before analytics consent.
 */
export function StartBuildingCard() {
  return (
    <section
      aria-labelledby="start-building-title"
      className="flex flex-col gap-4 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">Private beta</p>
      <h2
        id="start-building-title"
        className="font-editorial text-[24px] font-normal leading-[1.15] tracking-[-0.015em] text-home-ink sm:text-[26px]"
      >
        Build your own idea with your AI co-founder.
      </h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={OWN_IDEA_PATH}
          onClick={() =>
            trackEvent("cta_button_clicked", {
              button_location: "start-building-dashboard",
              button_text: START_BUILDING_LABEL,
            })
          }
          className="inline-flex h-11 items-center gap-2 rounded-[9px] bg-home-orange-ink px-4 text-sm font-medium text-white transition-colors hover:bg-[#8f3f00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          {START_BUILDING_LABEL}
          <Icon name="arrow" size={16} strokeWidth={1.75} />
        </Link>
        <Link
          href={LIBRARY_PATH}
          onClick={() =>
            trackEvent("cta_button_clicked", {
              button_location: "start-building-dashboard-library",
              button_text: PICK_LIBRARY_IDEA_LABEL,
            })
          }
          className="text-sm font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          {PICK_LIBRARY_IDEA_LABEL}
        </Link>
      </div>
    </section>
  );
}
