import type { Metadata } from "next";
import { CompareView } from "@/components/platform/hub/CompareView";
import { getIdeaTiers } from "@/lib/dashboard/idea-prompts";
import { isIdeaSlug } from "@/lib/pending-save";

export const metadata: Metadata = {
  title: "Compare ideas",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** At most 4 valid, distinct slugs, in the order given. The query enforces the plan's own limit. */
function compareSlugs(value: string | string[] | undefined): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((slug) => slug.trim()))].filter(isIdeaSlug).slice(0, 4);
}

/**
 * WP44-S11 compare. Pricing comes from each idea's public MDX; everything
 * else comes from the gated Convex query, so the table only renders for a
 * member whose plan includes compare.
 */
export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const slugs = compareSlugs((await searchParams).ideas);
  const tiers = Object.fromEntries(await Promise.all(slugs.map(async (slug) => [slug, await getIdeaTiers(slug)])));
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          Compare ideas
        </h1>
        <p className="text-[15px] text-home-ink-2">Scores, build time, tools and pricing, side by side.</p>
      </header>
      <CompareView slugs={slugs} tiers={tiers} />
    </div>
  );
}
