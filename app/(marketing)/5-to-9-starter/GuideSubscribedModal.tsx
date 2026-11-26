"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Info, MailCheck, X } from "lucide-react";

import { IconButton } from "@/components/primitives/IconButton";

/**
 * "Check your inbox" confirmation modal for the 5-to-9 Starter guide.
 * Modelled on the Starter Kit SubscribedModal: mounts only after a
 * successful Beehiiv submit redirect (`?subscribed=true`), then cleans the
 * query string. Direct loads of /5-to-9-starter never render the dialog.
 * Must be rendered inside <Suspense> (uses useSearchParams).
 */
export function GuideSubscribedModal() {
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
        <IconButton
          aria-label="Close modal"
          className="absolute top-8 right-8 text-home-ink-3 transition-colors hover:text-home-ink"
          onClick={close}
        >
          <X size={20} />
        </IconButton>

        <div className="flex flex-col items-center text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-home-paper text-home-orange-ink">
            <MailCheck size={40} aria-hidden="true" />
          </div>

          <h3
            id="inbox-modal-title"
            className="mb-4 font-editorial text-2xl tracking-tight"
          >
            You&apos;re in — Day 1 is on its way!
          </h3>
          <p className="mb-8 text-sm leading-relaxed text-home-ink-3">
            Day 1 arrives in a few minutes. Please check your{" "}
            <span className="font-semibold text-home-ink">Inbox</span>,{" "}
            <span className="font-semibold text-home-ink">Spam</span>, or{" "}
            <span className="font-semibold text-home-ink">Promotions</span> folder.
          </p>

          <div className="mb-8 w-full rounded-[10px] border border-home-rule bg-home-paper p-6 text-left">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink">
              Search for this subject:
            </p>
            <p className="select-all text-sm font-medium text-home-ink">
              Day 1: Your 5-to-9 idea is already in your 9-to-5
            </p>
          </div>

          <div className="mb-8 flex items-start gap-3 rounded-[10px] bg-home-paper p-4 text-left">
            <Info
              className="mt-0.5 text-home-orange-ink"
              size={18}
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-home-ink-3">
              If it landed in <span className="font-bold">SPAM</span>, please
              drag it to your <span className="font-bold">primary inbox</span>{" "}
              so you don&apos;t miss the next four days.
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
