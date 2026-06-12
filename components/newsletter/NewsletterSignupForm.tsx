"use client";

import { useState } from "react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";

/**
 * The legacy `form[data-newsletter-subscribe]` (newsletter.html + issue
 * pages): single email field + Subscribe pill, no redirect — success is
 * announced inline ("Check your inbox to confirm — you're in.") and the
 * button flips to "Subscribed ✓".
 */
export function NewsletterSignupForm({
  utmCampaign,
}: {
  utmCampaign: string;
}) {
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div>
      <BeehiivSubscribeForm
        utmCampaign={utmCampaign}
        successHref={null}
        onSuccess={() => setSubscribed(true)}
        showFirstName={false}
        submitLabel={subscribed ? "Subscribed ✓" : "Subscribe"}
        className="flex flex-col sm:flex-row gap-2 space-y-0 [&>div]:flex-1"
        inputClassName="bg-white/[0.03] border-white/10 px-5 py-3 placeholder:text-neutral-600 focus:border-white/30"
        buttonClassName="w-auto px-6 py-3 disabled:cursor-not-allowed"
      />
      <p
        className={`mt-3 text-xs ${subscribed ? "text-white" : "text-neutral-500"}`}
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
