"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Info, MailCheck, X } from "lucide-react";

import { IconButton } from "@/components/primitives/IconButton";
import { cn } from "@/lib/utils";

/**
 * "Check your inbox" confirmation modal, ported from the #inbox-modal block in
 * starter-kit.html. Opens when the page is visited with `?subscribed=true`
 * (the Beehiiv form redirect target), then cleans the query string.
 * Must be rendered inside <Suspense> (uses useSearchParams).
 */
export function SubscribedModal() {
  const searchParams = useSearchParams();
  const subscribed = searchParams.get("subscribed") === "true";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!subscribed) return;
    // Small delay to ensure the DOM is ready so transitions can trigger
    // (legacy behavior), then clean up the URL.
    const t = setTimeout(() => setOpen(true), 100);
    window.history.replaceState({}, document.title, window.location.pathname);
    return () => clearTimeout(t);
  }, [subscribed]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div
      id="inbox-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inbox-modal-title"
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all duration-500",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={cn(
          "modal-container relative w-full max-w-md bg-white border border-neutral-200 rounded-[2.5rem] p-10 shadow-2xl transform transition-transform duration-500",
          open ? "scale-100" : "scale-95",
        )}
      >
        <IconButton
          aria-label="Close modal"
          className="absolute top-8 right-8 text-neutral-400 hover:text-black transition-colors"
          onClick={close}
        >
          <X size={20} />
        </IconButton>

        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-8">
            <MailCheck size={40} aria-hidden="true" />
          </div>

          <h3
            id="inbox-modal-title"
            className="text-2xl font-medium tracking-tight mb-4"
          >
            Check your inbox!
          </h3>
          <p className="text-neutral-500 text-sm leading-relaxed mb-8">
            The Weekend MVP Starter Kit is on its way. Please check your{" "}
            <span className="text-black font-semibold">Inbox</span>,{" "}
            <span className="text-black font-semibold">Spam</span>, or{" "}
            <span className="text-black font-semibold">Promotions</span>{" "}
            folder.
          </p>

          <div className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl p-6 mb-8 text-left">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">
              Search for this subject:
            </p>
            <p className="text-sm font-medium text-black select-all">
              Your Weekend MVP Starter Kit is here
            </p>
          </div>

          <div className="flex items-start gap-3 text-left bg-blue-50/50 rounded-2xl p-4 mb-8">
            <Info
              className="text-blue-500 mt-0.5"
              size={18}
              aria-hidden="true"
            />
            <p className="text-xs text-blue-800 leading-relaxed">
              If it landed in <span className="font-bold">SPAM</span>, please
              drag it to your <span className="font-bold">primary inbox</span>{" "}
              so you don&apos;t miss future guides.
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            className="w-full py-4 bg-black text-white rounded-full text-sm font-semibold hover:bg-neutral-800 transition-all shadow-lg"
          >
            Got it, I&apos;ll check now
          </button>
        </div>
      </div>
    </div>
  );
}
