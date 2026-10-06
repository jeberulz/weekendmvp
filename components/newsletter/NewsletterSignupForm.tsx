"use client";

import { useState } from "react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { cn } from "@/lib/utils";

/**
 * The legacy `form[data-newsletter-subscribe]` (newsletter.html + issue
 * pages): single email field + Subscribe pill, no redirect — success is
 * announced inline ("Check your inbox to confirm — you're in.") and the
 * button flips to "Subscribed ✓". Styled for the research-desk paper ground.
 */
export function NewsletterSignupForm({
  utmCampaign,
  className,
}: {
  utmCampaign: string;
  className?: string;
}) {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className={className}>
      <BeehiivSubscribeForm
        utmCampaign={utmCampaign}
        successHref={null}
        onSuccess={() => setSubscribed(true)}
        showFirstName={false}
        submitLabel={subscribed ? "Subscribed ✓" : "Subscribe"}
        className="flex flex-col gap-2.5 space-y-0 text-left sm:flex-row sm:items-end [&>div]:flex-1"
        emailLabelClassName="mb-2 block font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-2"
        inputClassName="h-[52px] border-home-ink-3 bg-home-card px-5 py-0 text-base text-home-ink placeholder:text-home-ink-3 focus:ring-home-orange-ink"
        buttonClassName="h-[52px] w-full bg-home-orange-ink px-6 py-0 text-base text-white hover:bg-[#8f3f00] focus:ring-home-orange-ink focus:ring-offset-2 focus:ring-offset-home-paper disabled:cursor-not-allowed sm:w-auto motion-reduce:transition-none"
      />
      <p
        className={cn(
          "mt-3 text-[13px] leading-[1.5]",
          subscribed ? "font-medium text-home-ink" : "text-home-ink-3",
        )}
        role="status"
        aria-live="polite"
      >
        {subscribed
          ? "Check your inbox to confirm — you're in."
          : "Free. 2 emails a day. Unsubscribe anytime."}
      </p>
    </div>
  );
}
