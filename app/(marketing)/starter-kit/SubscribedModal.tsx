"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Info, MailCheck, X } from "lucide-react";

import { IconButton } from "@/components/primitives/IconButton";

/**
 * "Check your inbox" confirmation modal. Mounts only after a successful
 * Beehiiv submit redirect (`?subscribed=true`), then cleans the query string.
 * Direct loads of /starter-kit never render the dialog.
 * Must be rendered inside <Suspense> (uses useSearchParams).
 */
export function SubscribedModal() {
  const searchParams = useSearchParams();
  const subscribed = searchParams.get("subscribed") === "true";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!subscribed) return;
    // Small delay so the open transition can run, then clean the URL.
    const t = setTimeout(() => setOpen(true), 100);
    window.history.replaceState({}, document.title, window.location.pathname);
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-container relative w-full max-w-md rounded-[2.5rem] border border-neutral-200 bg-white p-10 shadow-2xl">
        <IconButton
          aria-label="Close modal"
          className="absolute top-8 right-8 text-neutral-400 transition-colors hover:text-black"
          onClick={close}
        >
          <X size={20} />
        </IconButton>

        <div className="flex flex-col items-center text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-600">
            <MailCheck size={40} aria-hidden="true" />
          </div>

          <h3
            id="inbox-modal-title"
            className="mb-4 text-2xl font-medium tracking-tight"
          >
            Check your inbox!
          </h3>
          <p className="mb-8 text-sm leading-relaxed text-neutral-500">
            The Weekend MVP Starter Kit is on its way. Please check your{" "}
            <span className="font-semibold text-black">Inbox</span>,{" "}
            <span className="font-semibold text-black">Spam</span>, or{" "}
            <span className="font-semibold text-black">Promotions</span> folder.
          </p>

          <div className="mb-8 w-full rounded-2xl border border-neutral-100 bg-neutral-50 p-6 text-left">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Search for this subject:
            </p>
            <p className="select-all text-sm font-medium text-black">
              Your Weekend MVP Starter Kit is here
            </p>
          </div>

          <div className="mb-8 flex items-start gap-3 rounded-2xl bg-blue-50/50 p-4 text-left">
            <Info
              className="mt-0.5 text-blue-500"
              size={18}
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-blue-800">
              If it landed in <span className="font-bold">SPAM</span>, please
              drag it to your <span className="font-bold">primary inbox</span>{" "}
              so you don&apos;t miss future guides.
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            className="w-full rounded-full bg-black py-4 text-sm font-semibold text-white shadow-lg transition-all hover:bg-neutral-800"
          >
            Got it, I&apos;ll check now
          </button>
        </div>
      </div>
    </div>
  );
}
