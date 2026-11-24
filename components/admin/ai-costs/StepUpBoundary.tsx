import type { ReactNode } from "react";

import { AuthPlatformProvider } from "@/app/AuthPlatformProvider";
import { StepUpProvider } from "@/components/admin/editorial/common/StepUpContext";
import type { StepUpState } from "@/lib/admin/ai-costs/controls-server";

/**
 * The live console signs in again with the account's own method (the
 * editorial step-up). Fixtures need neither provider: their step is simulated.
 */
export function StepUpBoundary({ live, stepUp, children }: { live: boolean; stepUp: StepUpState["stepUp"]; children: ReactNode }) {
  if (!live || stepUp === null) return children;
  return (
    <AuthPlatformProvider fallbackClassName="bg-(--ed-canvas)">
      <StepUpProvider value={stepUp}>{children}</StepUpProvider>
    </AuthPlatformProvider>
  );
}
