import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBuilds } from "@/components/platform/live/LiveBuilds";
import { buildersHubUiEnabled } from "@/convex/platform/plans";

export const metadata: Metadata = {
  title: "Live builds",
  robots: { index: false, follow: false },
};

// WP64-S8. Part of Builder's Hub, so it exists only with the flag on.
// No `main` here: the workspace shell owns the only one (WP44-S7).
export default function LiveBuildsPage() {
  if (!buildersHubUiEnabled(process.env.NEXT_PUBLIC_BUILDERS_HUB)) notFound();
  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          Live builds
        </h1>
        <p className="text-[15px] text-home-ink-2">
          One live build a month, with a replay after. Times show in your time zone.
        </p>
      </header>
      <LiveBuilds />
    </div>
  );
}
