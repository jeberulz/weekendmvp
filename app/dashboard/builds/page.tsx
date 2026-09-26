import type { Metadata } from "next";
import { BuildsList } from "@/components/platform/builds/BuildsList";

export const metadata: Metadata = {
  title: "Builds",
  robots: { index: false, follow: false },
};

export default function BuildsPage() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          Builds
        </h1>
        <p className="text-[15px] text-home-ink-2">Your weekend plans and the links you shipped.</p>
      </header>
      <BuildsList />
    </div>
  );
}
