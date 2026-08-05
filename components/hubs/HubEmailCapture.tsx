"use client";

import * as React from "react";
import { ArrowRight, Mail } from "lucide-react";

import { subscribeViaApi } from "@/lib/beehiiv-client";
import { trackEvent, trackValidationEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

/**
 * Email capture panel for the hub pages.
 *
 * Posts through the existing `/api/subscribe` route via `subscribeViaApi`
 * (which reads the response as text before parsing, per
 * BEEHIIV_CURSOR_RULES.md) — no new API surface and no new Beehiiv
 * integration. The default automation behind that route is the Weekend MVP
 * welcome flow, so the copy passed in must describe the newsletter and
 * nothing that doesn't exist yet.
 *
 * The only client boundary on the page: every heading, idea, and CTA around
 * it stays server-rendered for crawlers.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "loading" | "success" | "error";

const MESSAGE_CLASS: Record<Status, string> = {
  idle: "text-neutral-400",
  loading: "text-neutral-400",
  success: "text-white",
  error: "text-amber-300",
};

export function HubEmailCapture({
  eyebrow,
  heading,
  body,
  buttonLabel = "Send me ideas",
  footnote = "Free. 2 emails a day. Unsubscribe in one click.",
  utmCampaign = "newsletter",
  trackingProps,
  panelClassName,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  buttonLabel?: string;
  footnote?: string;
  /** Must be an allowlisted campaign in app/api/subscribe/route.ts. */
  utmCampaign?: string;
  /** Extra GA/Pixel event props (e.g. tool_name, surface). */
  trackingProps?: Record<string, string>;
  /** Accent gradient/border for the panel (literal Tailwind classes). */
  panelClassName?: string;
}) {
  const headingId = React.useId();
  const emailId = React.useId();
  const footnoteId = React.useId();
  const messageId = React.useId();

  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [message, setMessage] = React.useState("");

  const isSubmitting = status === "loading";
  const isDone = status === "success";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isDone) return;

    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email address, for example you@example.com.");
      return;
    }

    setStatus("loading");
    setMessage("Signing you up…");
    trackEvent("signup_form_submitted", {
      ...trackingProps,
      email_domain: trimmed.split("@")[1] ?? "unknown",
    });

    const result = await subscribeViaApi({ email: trimmed, utmCampaign });

    if (result.ok) {
      setEmail("");
      setStatus("success");
      setMessage("You're in. Check your inbox to confirm your subscription.");
      trackEvent("signup_form_success", { ...trackingProps });
      trackValidationEvent("newsletter_subscribed", {
        ...trackingProps,
        source_surface: "hub_email_capture",
        cta_id: "newsletter-subscribe",
      });
      return;
    }

    setStatus("error");
    setMessage(result.message);
  }

  return (
    <section className="mt-24" aria-labelledby={headingId}>
      <div
        className={cn(
          "p-8 md:p-12 rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent",
          panelClassName,
        )}
      >
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-300">
            <Mail size={14} aria-hidden="true" />
            {eyebrow}
          </p>
          <h2
            id={headingId}
            className="mt-4 text-2xl md:text-3xl font-medium text-white tracking-tight"
          >
            {heading}
          </h2>
          <p className="mt-3 text-neutral-400 leading-relaxed">{body}</p>

          <form onSubmit={handleSubmit} noValidate className="mt-8">
            <label
              htmlFor={emailId}
              className="block text-sm font-medium text-neutral-200"
            >
              Email address
            </label>
            <div className="mt-2 flex flex-col sm:flex-row gap-3">
              <input
                id={emailId}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={isDone}
                aria-invalid={status === "error"}
                aria-describedby={`${footnoteId} ${messageId}`}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (status === "error") {
                    setStatus("idle");
                    setMessage("");
                  }
                }}
                /* border-white/40 keeps the field boundary at 3:1 against
                   the panel (WCAG 1.4.11 non-text contrast). */
                className="flex-1 rounded-full border border-white/40 bg-white/10 px-5 py-4 text-sm text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/60 focus:border-white transition-colors disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isSubmitting || isDone}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-black rounded-full text-sm font-semibold hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>
                  {isSubmitting
                    ? "Signing you up…"
                    : isDone
                      ? "Subscribed ✓"
                      : buttonLabel}
                </span>
                {isDone ? null : <ArrowRight size={14} aria-hidden="true" />}
              </button>
            </div>
            <p id={footnoteId} className="mt-3 text-xs text-neutral-400">
              {footnote}
            </p>
            <p
              id={messageId}
              role="status"
              aria-live="polite"
              className={cn("mt-2 min-h-5 text-sm", MESSAGE_CLASS[status])}
            >
              {message}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
