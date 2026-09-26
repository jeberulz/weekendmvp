import type { Metadata } from "next";
import { PlanAndBilling } from "@/components/platform/billing/PlanAndBilling";
import { buildersHubUiEnabled } from "@/convex/platform/plans";

export const metadata: Metadata = {
  title: "Plan and billing",
  robots: { index: false, follow: false },
};

// No `main` here: the workspace shell owns the only one (WP44-S7).
export default function PlanAndBillingPage() {
  return <PlanAndBilling showBuildersHub={buildersHubUiEnabled(process.env.NEXT_PUBLIC_BUILDERS_HUB)} />;
}
