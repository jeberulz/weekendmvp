import type { Metadata } from "next";
import { PlanDetail } from "@/components/platform/builds/PlanDetail";

export const metadata: Metadata = {
  title: "Weekend plan",
  robots: { index: false, follow: false },
};

// Plan ids are runtime-only, like project ids.
export const instant = false;

export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <PlanDetail planId={planId} />
    </div>
  );
}
