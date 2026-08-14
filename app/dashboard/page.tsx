import { PreviewClaimRunner } from "@/components/preview/PreviewClaimHandoff";
import { SignedInHome } from "@/components/platform/shell/SignedInHome";
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <>
      <PreviewClaimRunner />
      <Suspense
        fallback={
          <div
            aria-label="Loading home"
            className="mx-auto h-64 max-w-6xl animate-pulse px-5 py-10 motion-reduce:animate-none"
          />
        }
      >
        <SignedInHome />
      </Suspense>
    </>
  );
}
