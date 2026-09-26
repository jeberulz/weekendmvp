import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IdeasLibrary, LibrarySkeleton } from "@/components/platform/explore/IdeasLibrary";
import { SAVED_PATH } from "@/components/platform/explore/library-params";
import { getDashboardEditorial } from "@/lib/dashboard/editorial";

export const metadata: Metadata = {
  title: "Ideas",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function IdeasPage({ searchParams }: { searchParams: SearchParams }) {
  const { view } = await searchParams;
  // Saved and Building left Explore (WP44-S5). Old links still land somewhere true.
  if (view === "saved" || view === "interested") redirect(SAVED_PATH);
  if (view === "building") redirect("/dashboard/explore");

  const editorial = await getDashboardEditorial();
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          Ideas
        </h1>
        <p className="text-[15px] text-home-ink-2">
          {editorial
            ? `${editorial.total} researched ideas, each with scores, sources and build prompts.`
            : "Researched ideas, each with scores, sources and build prompts."}
        </p>
      </header>
      <Suspense fallback={<LibrarySkeleton />}>
        <IdeasLibrary />
      </Suspense>
    </div>
  );
}
