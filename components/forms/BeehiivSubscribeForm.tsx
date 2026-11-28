"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  subscribeViaApi,
  type AllowedAutomationId,
} from "@/lib/beehiiv-client";
import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

const BEEHIIV_PUB_ID = "pub_5fbc631f-7950-4bac-80fe-80ba70dae2da";
const BEEHIIV_FORM_ID = "7346f13f-9331-48d7-97f8-88c38da780b1";

const OPTIMISTIC_MESSAGES = {
  sending: { text: "Opening the guide…", error: false },
  slow: { text: "Taking a moment. The guide opens in a few seconds either way.", error: false },
  invalidEmail: { text: "That doesn't look like an email address. Check for a typo.", error: true },
  missingEmail: { text: "Enter your email to unlock the guide.", error: true },
  rejectedEmail: { text: "That email didn't go through. Check it and try again.", error: true },
};

type OptimisticMessage = keyof typeof OPTIMISTIC_MESSAGES;

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

type OptimisticUnlock = { email: string; via: "api" | "timer" | "fallback" };

type BeehiivSubscribeFormProps = {
  automationId?: AllowedAutomationId;
  utmCampaign?: string;
  utmSource?: string;
  /** Where to send the user after success. Default mirrors legacy behavior. */
  successHref?: string | null;
  /** Called instead of (or in addition to) redirecting. */
  onSuccess?: (details?: OptimisticUnlock) => void;
  /** Opt in to opening while enrollment continues in the background. */
  optimisticSuccessMs?: number;
  onConfirmed?: () => void;
  showFirstName?: boolean;
  submitLabel?: string;
  /** Placeholder for the email field. Defaults to jane@example.com. */
  emailPlaceholder?: string;
  emailLabel?: string;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  /** Classes for the email label. Defaults to visually hidden. */
  emailLabelClassName?: string;
  /** Places the email field and submit button side by side at 560px. */
  inlineEmail?: boolean;
  /** Enables inline submission announcements alongside the existing success path. */
  successMessage?: string;
};

export function BeehiivSubscribeForm({
  automationId,
  utmCampaign,
  utmSource,
  successHref = "/starter-kit?subscribed=true",
  onSuccess,
  optimisticSuccessMs,
  onConfirmed,
  showFirstName = true,
  submitLabel = "Get the Starter Kit",
  emailPlaceholder = "jane@example.com",
  emailLabel = "Email address",
  className,
  inputClassName,
  buttonClassName,
  emailLabelClassName = "sr-only",
  inlineEmail = false,
  successMessage,
}: BeehiivSubscribeFormProps) {
  const emailId = useId();
  const nameId = useId();
  const statusId = useId();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [phase, setPhase] = useState<"idle" | "sending" | "slow" | "error" | "unlocked">("idle");
  const [message, setMessage] = useState<OptimisticMessage | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const unlocked = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const optimistic = optimisticSuccessMs !== undefined
    && Number.isFinite(optimisticSuccessMs) && optimisticSuccessMs > 0;

  useEffect(() => {
    if (!optimistic) return;
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(unlockTimer.current);
      clearTimeout(slowTimer.current);
    };
  }, [optimistic]);

  async function submitOptimistically(email: string, firstName: string, delay: number) {
    if (inFlight.current || unlocked.current) return;
    function showError(message: OptimisticMessage) {
      setPhase("error");
      setMessage(message);
      emailInput.current?.focus();
    }
    if (!email || !emailInput.current?.validity.valid) {
      showError(email ? "invalidEmail" : "missingEmail");
      return;
    }

    const emailDomain = email.split("@")[1] || "unknown";

    function finish(via: OptimisticUnlock["via"]) {
      if (unlocked.current || !mounted.current) return;
      unlocked.current = true;
      const method = via === "fallback" ? "embed_fallback" : via;
      trackEvent("signup_form_submitted", { method, email_domain: emailDomain });
      try {
        localStorage.setItem("weekendmvp_subscribed", "true");
      } catch {
        // Storage may be unavailable in embedded browsers.
      }
      setPhase("unlocked");
      setMessage(null);
      onSuccess?.({ email, via });
      if (successHref) router.push(successHref);
    }

    inFlight.current = true;
    setPhase("sending");
    setMessage("sending");
    slowTimer.current = setTimeout(() => {
      setPhase("slow");
      setMessage("slow");
    }, 3000);
    unlockTimer.current = setTimeout(() => finish("timer"), delay);

    const result = await subscribeViaApi({
      email,
      firstName: firstName || undefined,
      automationIds: automationId ? [automationId] : undefined,
      utmCampaign,
      utmSource,
    });
    clearTimeout(unlockTimer.current);
    clearTimeout(slowTimer.current);
    inFlight.current = false;

    if (result.ok) {
      finish("api");
      if (mounted.current) {
        trackEvent("signup_form_success", { method: "api" });
        onConfirmed?.();
      }
      return;
    }
    if (!mounted.current && !unlocked.current) return;

    const failedAfterUnlock = unlocked.current;
    if (!failedAfterUnlock && result.status && result.status >= 400 && result.status < 500) {
      trackEvent("signup_form_submitted", { method: "api", email_domain: emailDomain });
      trackEvent("signup_form_error", { error: "address_rejected" });
      showError("rejectedEmail");
      return;
    }
    if (failedAfterUnlock) trackEvent("api_failed_after_optimistic_success");
    else finish("fallback");

    try {
      submitViaBeehiivEmbed(email, firstName);
      // Fired for both early 5xx/network fallback and late failure after unlock.
      // Outcome of the cross-origin embed is unknown. Do not claim a double failure.
      trackEvent("signup_fallback_fired");
    } catch {
      // The guide is open and delivery remains unconfirmed.
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const firstName = String(data.get("first_name") ?? "").trim();
    if (optimistic) {
      await submitOptimistically(email, firstName, optimisticSuccessMs);
      return;
    }
    if (!email) return;

    setStatus("submitting");
    const emailDomain = email.split("@")[1] || "unknown";

    const finish = (method: "api" | "embed_fallback") => {
      trackEvent("signup_form_submitted", { method, email_domain: emailDomain });
      if (method === "api") trackEvent("signup_form_success", { method: "api" });
      try {
        localStorage.setItem("weekendmvp_subscribed", "true");
      } catch {
        // storage unavailable — non-fatal
      }
      if (successMessage) setStatus("success");
      else if (!successHref) setStatus("idle");
      onSuccess?.();
      if (successHref) router.push(successHref);
    };

    const result = await subscribeViaApi({
      email,
      firstName: firstName || undefined,
      automationIds: automationId ? [automationId] : undefined,
      utmCampaign,
      utmSource,
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

  const busy = phase === "sending" || phase === "slow" || phase === "unlocked";
  const activeMessage = message && OPTIMISTIC_MESSAGES[message];

  return (
    <form onSubmit={handleSubmit} className={cn(inlineEmail ? "grid gap-x-2.5 gap-y-2 min-[560px]:grid-cols-[minmax(0,1fr)_auto]" : "space-y-4", className)} noValidate={optimistic || undefined} data-phase={optimistic ? phase : undefined}>
      {showFirstName && (
        <div className={inlineEmail ? "col-span-full" : undefined}>
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
      <div className={inlineEmail ? "contents" : undefined}>
        <label htmlFor={emailId} className={cn(inlineEmail && "col-span-full", emailLabelClassName)}>
          {emailLabel}
        </label>
        <input
          type="email"
          id={emailId}
          name="email"
          required
          placeholder={emailPlaceholder}
          autoComplete="email"
          ref={optimistic ? emailInput : undefined}
          inputMode={optimistic ? "email" : undefined}
          autoCapitalize={optimistic ? "off" : undefined}
          spellCheck={optimistic ? false : undefined}
          readOnly={optimistic && busy ? true : undefined}
          aria-invalid={optimistic && phase === "error" ? true : undefined}
          aria-describedby={optimistic ? statusId : successMessage ? `${emailId}-status` : undefined}
          onChange={optimistic ? () => {
            if (phase === "error") {
              setPhase("idle");
              setMessage(null);
            }
          } : undefined}
          className={cn(
            "w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/40",
            inputClassName,
          )}
        />
      </div>
      <button
        type="submit"
        disabled={!optimistic && status === "submitting"}
        aria-disabled={optimistic && busy ? true : undefined}
        className={cn(
          "w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-60",
          buttonClassName,
        )}
      >
        {optimistic
          ? busy ? "Opening…" : submitLabel
          : status === "submitting"
          ? "Sending..."
          : status === "error" && !successMessage
            ? "Error. Try again?"
            : submitLabel}
      </button>
      {!optimistic && successMessage && (
        <p id={`${emailId}-status`} aria-live="polite" className="col-span-full text-[13px] font-medium text-home-orange-ink empty:sr-only">
          {status === "success" && successMessage}
          {status === "error" && "We couldn’t sign you up. Please try again."}
        </p>
      )}
      {optimistic && (
        <p className="subscribe-status">
          {/* Reserve the height of every message while keeping the live region's text dynamic. */}
          {Object.entries(OPTIMISTIC_MESSAGES).map(([key, { text, error }]) => (
            <span key={key} aria-hidden="true" className={error ? "subscribe-status-error" : undefined}>
              {error && "! "}
              {text}
            </span>
          ))}
          <span id={statusId} role="status" aria-atomic="true" className={activeMessage?.error ? "subscribe-status-error" : undefined}>
            {activeMessage?.error && <span aria-hidden="true">! </span>}
            {activeMessage?.text}
          </span>
        </p>
      )}
    </form>
  );
}
