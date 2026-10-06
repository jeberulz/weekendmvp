"use client";

import * as React from "react";

import { Icon } from "@/components/home/icons";
import { Container, Eyebrow, buttonClass } from "@/components/home/ui";
import { subscribeViaApi } from "@/lib/beehiiv-client";
import { trackEvent } from "@/lib/track";
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
  idle: "text-home-ink-2",
  loading: "text-home-ink-2",
  success: "text-home-ink",
  error: "text-home-clay-ink",
};

export function HubEmailCapture({
  eyebrow,
  heading,
  body,
  buttonLabel = "Send me ideas",
  footnote = "Free. 2 emails a day. Unsubscribe in one click.",
  utmCampaign = "newsletter",
  trackingProps,
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
      return;
    }

    setStatus("error");
    setMessage(result.message);
  }

  return (
    <section className="py-10 lg:py-14" aria-labelledby={headingId}>
      <Container>
        <div className="grid grid-cols-1 gap-8 rounded-2xl border border-home-rule bg-home-card p-7 md:p-10 lg:grid-cols-2 lg:items-center lg:gap-14 lg:p-12">
          <div className="flex flex-col gap-3.5">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2
              id={headingId}
              className="font-editorial text-[30px] font-normal leading-[1.08] tracking-[-0.02em] text-balance text-home-ink md:text-[40px]"
            >
              {heading}
            </h2>
            <p className="text-pretty text-base leading-[1.55] text-home-ink-2 md:text-[17px]">{body}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor={emailId} className="block text-sm font-medium text-home-ink">
              Email address
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
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
                className="h-[52px] min-w-0 flex-1 rounded-full border border-home-ink bg-home-paper px-5 text-base text-home-ink placeholder:text-home-ink-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:opacity-60 motion-reduce:transition-none"
              />
              <button
                type="submit"
                disabled={isSubmitting || isDone}
                className={buttonClass("primary", "disabled:cursor-not-allowed disabled:opacity-60")}
              >
                <span>
                  {isSubmitting ? "Signing you up…" : isDone ? "Subscribed ✓" : buttonLabel}
                </span>
                {isDone ? null : <Icon name="arrow" size={18} strokeWidth={1.75} />}
              </button>
            </div>
            <p id={footnoteId} className="mt-3 text-xs text-home-ink-3">
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
      </Container>
    </section>
  );
}
