"use client";

/**
 * Client islands on a playbook page: the hero email capture, the gated pack,
 * and the tracked CTA link. Everything else on the page is server-rendered.
 *
 * The form is modelled on `components/hubs/HubEmailCapture.tsx` — same
 * `subscribeViaApi` call, same `role="status" aria-live="polite"` message
 * node, same "error clears as you type" behaviour, same terminal
 * "Subscribed ✓" state — retinted for the cream canvas.
 *
 * The `playbook` UTM campaign must stay allowlisted in
 * `app/api/subscribe/route.ts`; a campaign that is not on that list is
 * silently rewritten to `starter-kit`, which looks like success here but
 * loses the attribution.
 */

import * as React from "react";
import { ArrowRight, Check, Lock, Mail } from "lucide-react";

import { subscribeViaApi } from "@/lib/beehiiv-client";
import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import {
  grantPackAccess,
  hasPackAccess,
  isValidEmail,
  PLAYBOOK_UTM_CAMPAIGN,
} from "./playbook-access";
import {
  ACCENT_BUTTON,
  ACCENT_TEXT,
  INK,
  INNER,
  SHELL,
  playbookTokens as t,
} from "./PlaybookSections";
import type { PlaybookPackItem } from "./types";

type Status = "idle" | "loading" | "success" | "error";

const MESSAGE_CLASS: Record<Status, string> = {
  idle: "text-stone-500",
  loading: "text-stone-500",
  success: "text-[#1c1917]",
  error: "text-[#A03D00]",
};

/* ------------------------------------------------------------------ */
/* The form                                                            */
/* ------------------------------------------------------------------ */

function PlaybookEmailForm({
  slug,
  surface,
  buttonLabel,
  footnote,
  successMessage,
  onSuccess,
}: {
  slug: string;
  /** Distinguishes the hero capture from the pack unlock in GA. */
  surface: "playbook_hero" | "playbook_pack";
  buttonLabel: string;
  footnote: string;
  successMessage: string;
  onSuccess?: (email: string) => void;
}) {
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
    if (!isValidEmail(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email address, for example you@example.com.");
      return;
    }

    setStatus("loading");
    setMessage("Signing you up…");
    trackEvent("signup_form_submitted", {
      surface,
      playbook_slug: slug,
      email_domain: trimmed.split("@")[1] ?? "unknown",
    });

    const result = await subscribeViaApi({
      email: trimmed,
      utmCampaign: PLAYBOOK_UTM_CAMPAIGN,
    });

    if (result.ok) {
      setEmail("");
      setStatus("success");
      setMessage(successMessage);
      trackEvent("signup_form_success", { surface, playbook_slug: slug });
      onSuccess?.(trimmed);
      return;
    }

    setStatus("error");
    setMessage(result.message);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-7">
      <label
        htmlFor={emailId}
        className={cn("block text-sm font-medium", t.textPrimary)}
      >
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
          /* border-stone-500 keeps the field boundary at 4.8:1 against the
             white panel (WCAG 1.4.11 needs 3:1 for non-text). stone-400 is
             only 2.5:1 and fails. */
          className={cn(
            "flex-1 rounded-full border border-stone-500 bg-white px-5 py-4 text-sm",
            "text-[#1c1917] placeholder:text-stone-500 transition-colors",
            "focus:border-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#1c1917]",
            "disabled:opacity-60",
          )}
        />
        <button
          type="submit"
          disabled={isSubmitting || isDone}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full px-7 py-4",
            "text-sm font-semibold whitespace-nowrap",
            "disabled:cursor-not-allowed disabled:opacity-60",
            ACCENT_BUTTON,
          )}
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
      <p id={footnoteId} className={cn("mt-3 text-xs", t.textMuted)}>
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
  );
}

/* ------------------------------------------------------------------ */
/* Hero capture                                                        */
/* ------------------------------------------------------------------ */

export function PlaybookCapture({
  slug,
  heading,
  body,
  buttonLabel,
  footnote,
}: {
  slug: string;
  heading: string;
  body: string;
  buttonLabel: string;
  footnote: string;
}) {
  const headingId = React.useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "mt-10 rounded-3xl border p-6 md:p-8",
        t.surface,
        t.divider,
      )}
    >
      <p
        className={cn(
          "inline-flex items-center gap-2 font-mono-eyebrow text-[11px] font-semibold uppercase",
          ACCENT_TEXT,
        )}
      >
        <Mail size={14} aria-hidden="true" />
        Free
      </p>
      <h2
        id={headingId}
        className={cn(
          "mt-3 text-xl font-medium tracking-tight md:text-2xl",
          t.textPrimary,
        )}
      >
        {heading}
      </h2>
      <p className={cn("mt-2 leading-relaxed", t.textSecondary)}>{body}</p>

      <PlaybookEmailForm
        slug={slug}
        surface="playbook_hero"
        buttonLabel={buttonLabel}
        footnote={footnote}
        successMessage="You're in. Check your inbox to confirm your subscription."
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The gated pack                                                      */
/* ------------------------------------------------------------------ */

export function PlaybookPack({
  slug,
  eyebrow,
  heading,
  body,
  items,
  buttonLabel,
  footnote,
  unlockedHeading,
  unlockedBody,
  unlockedHref,
  unlockedHrefLabel,
}: {
  slug: string;
  eyebrow: string;
  heading: string;
  body: string;
  items: PlaybookPackItem[];
  buttonLabel: string;
  footnote: string;
  unlockedHeading: string;
  unlockedBody: string;
  unlockedHref: string;
  unlockedHrefLabel: string;
}) {
  const headingId = React.useId();

  // Server render and first client render are both "locked", so there is no
  // hydration mismatch. Returning subscribers flip to unlocked on mount.
  // Only the pack is gated — the framework above it is always free.
  const [unlocked, setUnlocked] = React.useState(false);

  React.useEffect(() => {
    if (hasPackAccess()) setUnlocked(true);
  }, []);

  return (
    <section aria-labelledby={headingId} className={cn(SHELL, "py-14 md:py-20")}>
      <div className={cn(INNER, "rounded-[2rem] border p-8 md:p-12", t.surface, t.divider)}>
        <p
          className={cn(
            "inline-flex items-center gap-2 font-mono-eyebrow text-[11px] font-semibold uppercase",
            ACCENT_TEXT,
          )}
        >
          {unlocked ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Lock size={14} aria-hidden="true" />
          )}
          {eyebrow}
        </p>

        <h2
          id={headingId}
          className={cn(
            "mt-3 text-2xl font-medium tracking-tight md:text-3xl",
            t.textPrimary,
          )}
        >
          {unlocked ? unlockedHeading : heading}
        </h2>
        <p className={cn("mt-3 text-lg leading-relaxed", t.textSecondary)}>
          {unlocked ? unlockedBody : body}
        </p>

        <ul className="mt-7 space-y-3">
          {items.map((item) => (
            <li
              key={item.title}
              className={cn(
                "flex gap-3 rounded-2xl border bg-[#faf7f2] px-5 py-4",
                t.divider,
              )}
            >
              <Check
                size={16}
                aria-hidden="true"
                className={cn("mt-1 shrink-0", ACCENT_TEXT)}
              />
              <span>
                <span
                  className={cn("block text-sm font-semibold", t.textPrimary)}
                >
                  {item.title}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-sm leading-relaxed",
                    t.textSecondary,
                  )}
                >
                  {item.body}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {unlocked ? (
          <a
            href={unlockedHref}
            className={cn(
              "mt-7 inline-flex items-center gap-2 rounded-full px-7 py-4 text-sm font-semibold",
              ACCENT_BUTTON,
            )}
            onClick={() =>
              trackEvent("cta_button_clicked", {
                button_location: "playbook_pack_unlocked",
                button_text: unlockedHrefLabel,
                playbook_slug: slug,
              })
            }
          >
            {unlockedHrefLabel}
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        ) : (
          <PlaybookEmailForm
            slug={slug}
            surface="playbook_pack"
            buttonLabel={buttonLabel}
            footnote={footnote}
            successMessage="Unlocked. Check your inbox to confirm your subscription."
            onSuccess={(email) => {
              grantPackAccess(email);
              setUnlocked(true);
            }}
          />
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tracked CTA link                                                    */
/* ------------------------------------------------------------------ */

export function PlaybookCtaLink({
  slug,
  href,
  label,
}: {
  slug: string;
  href: string;
  label: string;
}) {
  const external = /^https?:\/\//.test(href);

  return (
    <a
      href={href}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      onClick={() =>
        trackEvent("cta_button_clicked", {
          button_location: "playbook_cta",
          button_text: label,
          playbook_slug: slug,
        })
      }
      /* Sits on the ink CTA card, so the accent flips: #e9a06a with ink text
         is 8:1, where white on #cc5500 would only be 4.1:1. #e9a06a is the
         same dark-surface orange used on /shipable. */
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-7 py-4 text-sm font-semibold",
        "bg-[#e9a06a] text-[#1c1917] transition-colors hover:bg-[#f2b384]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#faf7f2]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1917]",
      )}
    >
      {label}
      <ArrowRight size={16} aria-hidden="true" />
      {external ? <span className="sr-only">(opens in a new tab)</span> : null}
    </a>
  );
}
