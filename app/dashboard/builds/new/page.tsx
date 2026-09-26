import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StartPlan } from "@/components/platform/builds/StartPlan";
import { BUILDS_PATH, planSource } from "@/components/platform/builds/plan-copy";
import { isIdeaSlug } from "@/lib/pending-save";

export const metadata: Metadata = {
  title: "Plan my weekend",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Every "Plan my weekend" link lands here (WP44-S9). Nothing starts until the member says so. */
export default async function NewPlanPage({ searchParams }: { searchParams: SearchParams }) {
  const { idea, from } = await searchParams;
  if (!isIdeaSlug(idea)) redirect(BUILDS_PATH);
  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          Plan my weekend
        </h1>
        <p className="text-[15px] text-home-ink-2">One idea, four stages, from Friday night to Monday.</p>
      </header>
      <StartPlan slug={idea} source={planSource(from)} />
    </div>
  );
}
