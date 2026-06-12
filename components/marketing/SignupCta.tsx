"use client";

import { useState } from "react";
import { SignupModal } from "@/components/layout/SignupModal";
import type { AllowedAutomationId } from "@/lib/beehiiv-client";
import { trackEvent } from "@/lib/track";

type SignupCtaProps = {
  children: React.ReactNode;
  className?: string;
  automationId?: AllowedAutomationId;
  utmCampaign?: string;
  buttonLocation?: string;
};

/** Button that opens the signup modal — replaces legacy `.open-modal` wiring. */
export function SignupCta({
  children,
  className,
  automationId,
  utmCampaign,
  buttonLocation = "unknown",
}: SignupCtaProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          trackEvent("cta_button_clicked", {
            button_location: buttonLocation,
          });
          trackEvent("modal_opened");
          setOpen(true);
        }}
      >
        {children}
      </button>
      <SignupModal
        open={open}
        onOpenChange={setOpen}
        automationId={automationId}
        utmCampaign={utmCampaign}
      />
    </>
  );
}
