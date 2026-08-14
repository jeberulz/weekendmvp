import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingWorkspace } from "@/components/platform/billing/BillingWorkspace";
import { PLATFORM_CREDIT_PACKS } from "@/convex/platform/billing/catalog";

export const metadata: Metadata = {
  title: "Billing · Weekend MVP",
  robots: { index: false, follow: false },
};

export default function BillingPage() {
  const packs = PLATFORM_CREDIT_PACKS.map(({ id, name, amountMinor, credits }) => ({
    id,
    name,
    amountMinor,
    credits,
  }));
  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100">
      <Suspense fallback={<div className="min-h-[40vh]" aria-hidden="true" />}>
        <BillingWorkspace packs={packs} />
      </Suspense>
    </main>
  );
}
