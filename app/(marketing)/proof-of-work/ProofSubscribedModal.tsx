"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Icon } from "@/components/home/icons";

/**
 * "Check your inbox" confirmation modal for Proof of Work.
 * Modelled on the 5-to-9 Starter GuideSubscribedModal: mounts only after a
 * successful Beehiiv submit redirect (`?subscribed=true`), then cleans the
 * query string. Direct loads of /proof-of-work never render the dialog.
 * Must be rendered inside <Suspense> (uses useSearchParams).
 *
 * TODO-PROOF-AUTOMATION: the Proof of Work Beehiiv automation does not exist
 * yet, so no download email is sent today. Before launch, create the
 * automation, wire its id into the form (see _sections.tsx), and update this
 * modal with the real email subject line and the download URL.
 */
export function ProofSubscribedModal() {
  const searchParams = useSearchParams();
  const subscribed = searchParams.get("subscribed") === "true";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!subscribed) return;
    // Small delay so the open transition can run, then clean the URL.
    const t = setTimeout(() => {
      setOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }, 100);
    return () => clearTimeout(t);
  }, [subscribed]);

  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Only mount after a successful submit redirect — never on a direct load.
  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <div
      id="inbox-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inbox-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-home-ink/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-container relative max-h-full w-full max-w-md overflow-y-auto rounded-[10px] border border-home-rule bg-home-card p-6 sm:p-10">
        <button
          type="button"
          aria-label="Close modal"
          className="absolute top-8 right-8 text-home-ink-3 transition-colors hover:text-home-ink"
          onClick={close}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-home-paper text-home-orange-ink">
            <Icon name="check" size={40} strokeWidth={2} />
          </div>

          <h3
            id="inbox-modal-title"
            className="mb-4 font-editorial text-2xl tracking-tight"
          >
            You&apos;re in — the download link is on its way!
          </h3>
          <p className="mb-8 text-sm leading-relaxed text-home-ink-3">
            Check your{" "}
            <span className="font-semibold text-home-ink">Inbox</span>,{" "}
            <span className="font-semibold text-home-ink">Spam</span>, or{" "}
            <span className="font-semibold text-home-ink">Promotions</span>{" "}
            folder for an email from Weekend MVP with your Proof of Work
            download link.
          </p>

          <div className="mb-8 flex items-start gap-3 rounded-[10px] bg-home-paper p-4 text-left">
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-home-orange-ink"
            >
              <circle cx="12" cy="12" r="8.75" />
              <path d="M12 11v5" />
              <circle cx="12" cy="7.75" r="0.9" fill="currentColor" stroke="none" />
            </svg>
            <p className="text-xs leading-relaxed text-home-ink-3">
              If it landed in <span className="font-bold">SPAM</span>, please
              drag it to your <span className="font-bold">primary inbox</span>{" "}
              so you don&apos;t miss it.
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            className="w-full rounded-full border border-home-ink px-6 py-3 text-sm font-semibold text-home-ink transition-colors hover:bg-home-ink hover:text-home-paper"
          >
            Got it, I&apos;ll check now
          </button>
        </div>
      </div>
    </div>
  );
}
