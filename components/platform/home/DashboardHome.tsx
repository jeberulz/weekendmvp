import Link from "next/link";
import type { DashboardEditorial } from "@/lib/dashboard/editorial-map";
import { Greeting } from "./Greeting";
import { HomeRail } from "./HomeRail";
import { NewestIdeas } from "./NewestIdeas";
import { NextStepCard } from "./NextStepCard";
import { PickedForYou } from "./PickedForYou";
import { WeeklyPick } from "./WeeklyPick";

function WeeklyPickUnavailable() {
  return (
    <p className="rounded-[14px] border border-home-rule bg-home-card px-5 py-4 text-sm text-home-ink-2">
      This week’s pick is not available right now.{" "}
      <Link
        href="/dashboard/explore"
        className="font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
      >
        Browse ideas
      </Link>
    </p>
  );
}

/**
 * Dashboard Home (WP44-S4, PRD 6.2): personal first, then editorial, then
 * discovery. Editorial modules (2 and 4) render on the server from the
 * homepage cache. Personal modules (greeting, 1, 3 and the rail) load from
 * Convex in the browser, each behind its own skeleton and error state.
 */
export function DashboardHome({ editorial }: { editorial: DashboardEditorial | null }) {
  const weekly = editorial ? { slug: editorial.weekly.slug, title: editorial.weekly.title } : null;
  // Picks skip what Home already shows, so no idea appears twice.
  const shown = editorial ? [editorial.weekly.slug, ...editorial.newest.map((row) => row.slug)] : [];

  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10 xl:grid-cols-[minmax(0,1fr)_272px] xl:items-start">
      <div className="flex min-w-0 flex-col gap-8">
        <Greeting />
        <NextStepCard weekly={weekly} total={editorial?.total ?? null} />
        {editorial ? (
          <WeeklyPick idea={editorial.weekly} weekLabel={editorial.week.label} />
        ) : (
          <WeeklyPickUnavailable />
        )}
        <PickedForYou exclude={shown} />
        {editorial && <NewestIdeas rows={editorial.newest} />}
      </div>
      <HomeRail />
    </div>
  );
}
