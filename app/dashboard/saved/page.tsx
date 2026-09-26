import type { Metadata } from "next";
import { SavedIdeas } from "@/components/platform/explore/SavedIdeas";

export const metadata: Metadata = {
  title: "Saved",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Convex ids are short base32 strings. Anything else is ignored, not queried. */
function collectionParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" && /^[a-z0-9]{10,64}$/.test(value) ? value : null;
}

export default async function SavedPage({ searchParams }: { searchParams: SearchParams }) {
  const { collection } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          Saved
        </h1>
        <p className="text-[15px] text-home-ink-2">Your shortlist, newest first. Pick one to build this weekend.</p>
      </header>
      <SavedIdeas collectionId={collectionParam(collection)} />
    </div>
  );
}
