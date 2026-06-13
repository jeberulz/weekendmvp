"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  subscribeViaApi,
  type AllowedAutomationId,
} from "@/lib/beehiiv-client";
import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

const BEEHIIV_PUB_ID = "pub_5fbc631f-7950-4bac-80fe-80ba70dae2da";
const BEEHIIV_FORM_ID = "7346f13f-9331-48d7-97f8-88c38da780b1";

/** CSP-resistant fallback: posts the legacy Beehiiv embed form into a hidden iframe. */
function submitViaBeehiivEmbed(email: string, firstName: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://www.beehiiv.com/subscribe";
  form.target = "beehiiv-hidden-frame";
  form.style.display = "none";

  const fields: Array<[string, string]> = [
    ["pub_id", BEEHIIV_PUB_ID],
    ["form_id", BEEHIIV_FORM_ID],
    ["email", email],
    ["first_name", firstName],
  ];
  for (const [name, value] of fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  let iframe = document.getElementById(
    "beehiiv-hidden-frame",
  ) as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "beehiiv-hidden-frame";
    iframe.name = "beehiiv-hidden-frame";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }

  document.body.appendChild(form);
  form.submit();
  setTimeout(() => form.remove(), 2000);
}

type BeehiivSubscribeFormProps = {
  automationId?: AllowedAutomationId;
  utmCampaign?: string;
  /** Where to send the user after success. Default mirrors legacy behavior. */
  successHref?: string | null;
  /** Called instead of (or in addition to) redirecting. */
  onSuccess?: () => void;
  showFirstName?: boolean;
  submitLabel?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
};

export function BeehiivSubscribeForm({
  automationId,
  utmCampaign,
  successHref = "/starter-kit?subscribed=true",
  onSuccess,
  showFirstName = true,
  submitLabel = "Get the Starter Kit",
  className,
  inputClassName,
  buttonClassName,
}: BeehiivSubscribeFormProps) {
  const emailId = useId();
  const nameId = useId();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "error">(
    "idle",
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const firstName = String(data.get("first_name") ?? "").trim();
    if (!email) return;

    setStatus("submitting");
    const emailDomain = email.split("@")[1] || "unknown";

    const finish = (method: string) => {
      trackEvent("signup_form_submitted", { method, email_domain: emailDomain });
      trackEvent("signup_form_success", { method });
      try {
        localStorage.setItem("weekendmvp_subscribed", "true");
      } catch {
        // storage unavailable — non-fatal
      }
      onSuccess?.();
      if (successHref) router.push(successHref);
      else setStatus("idle");
    };

    const result = await subscribeViaApi({
      email,
      firstName: firstName || undefined,
      automationIds: automationId ? [automationId] : undefined,
      utmCampaign,
    });

    if (result.ok) {
      finish("api");
      return;
    }

    // Legacy fallback path: Beehiiv embed iframe, redirect after a beat.
    try {
      submitViaBeehiivEmbed(email, firstName);
      setTimeout(() => finish("embed_fallback"), 1000);
    } catch {
      trackEvent("signup_form_error", { error: "both_methods_failed" });
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      {showFirstName && (
        <div>
          <label htmlFor={nameId} className="sr-only">
            First name
          </label>
          <input
            type="text"
            id={nameId}
            name="first_name"
            placeholder="First name (optional)"
            autoComplete="given-name"
            className={cn(
              "w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/40",
              inputClassName,
            )}
          />
        </div>
      )}
      <div>
        <label htmlFor={emailId} className="sr-only">
          Email address
        </label>
        <input
          type="email"
          id={emailId}
          name="email"
          required
          placeholder="jane@example.com"
          autoComplete="email"
          className={cn(
            "w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/40",
            inputClassName,
          )}
        />
      </div>
      <button
        type="submit"
        disabled={status === "submitting"}
        className={cn(
          "w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-60",
          buttonClassName,
        )}
      >
        {status === "submitting"
          ? "Sending..."
          : status === "error"
            ? "Error. Try again?"
            : submitLabel}
      </button>
    </form>
  );
}
