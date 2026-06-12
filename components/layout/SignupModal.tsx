"use client";

import * as React from "react";
import { ArrowRight, CheckCircle, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/primitives/IconButton";
import {
  DEFAULT_AUTOMATION_ID,
  subscribeViaApi,
  type AllowedAutomationId,
} from "@/lib/beehiiv-client";

type SignupModalProps = {
  /** Which allowlisted Beehiiv automation to enroll into. */
  automationId?: AllowedAutomationId;
  utmCampaign?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Beehiiv signup dialog, ported from partials/signup-modal.html onto
 * shadcn Dialog (Escape, backdrop click, and focus return handled by Radix).
 */
export function SignupModal({
  automationId = DEFAULT_AUTOMATION_ID,
  utmCampaign,
  open,
  onOpenChange,
}: SignupModalProps) {
  const firstNameId = React.useId();
  const emailId = React.useId();
  const errorId = React.useId();

  const [status, setStatus] = React.useState<Status>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  // Reset to the form view each time the dialog is (re)opened.
  React.useEffect(() => {
    if (open) {
      setStatus("idle");
      setErrorMessage("");
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const firstName = String(formData.get("first_name") ?? "").trim();

    setStatus("submitting");
    setErrorMessage("");

    const result = await subscribeViaApi({
      email,
      firstName: firstName || undefined,
      automationIds: [automationId],
      utmCampaign,
    });

    if (result.ok) {
      try {
        localStorage.setItem("weekendmvp_subscribed", "true");
      } catch {
        // localStorage unavailable (private mode) — non-fatal.
      }
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMessage(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md rounded-3xl border border-white/10 bg-neutral-950 p-8 text-white shadow-2xl sm:max-w-md"
      >
        <DialogClose asChild>
          <IconButton
            aria-label="Close modal"
            className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
          >
            <X size={20} />
          </IconButton>
        </DialogClose>

        {status === "success" ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-6">
              <CheckCircle size={32} aria-hidden="true" />
            </div>
            <DialogTitle className="text-2xl font-medium text-white tracking-tight mb-2">
              Check your inbox!
            </DialogTitle>
            <DialogDescription className="text-neutral-400 text-sm mb-8">
              The Weekend MVP Starter Kit is on its way to you.
            </DialogDescription>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm font-semibold text-white hover:underline decoration-white/30 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <DialogTitle className="text-2xl font-medium text-white tracking-tight mb-2">
                Get the Starter Kit
              </DialogTitle>
              <DialogDescription className="text-neutral-400 text-sm">
                Enter your details and we&apos;ll send the kit right over.
              </DialogDescription>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor={firstNameId}
                  className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 ml-1"
                >
                  First Name
                </label>
                <input
                  type="text"
                  id={firstNameId}
                  name="first_name"
                  placeholder="Jane"
                  maxLength={50}
                  autoComplete="given-name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor={emailId}
                  className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 ml-1"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id={emailId}
                  name="email"
                  required
                  placeholder="jane@example.com"
                  autoComplete="email"
                  aria-describedby={status === "error" ? errorId : undefined}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
                />
              </div>

              {status === "error" && (
                <p
                  id={errorId}
                  role="alert"
                  className="text-sm text-red-400"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="group relative w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-black rounded-xl text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all mt-4 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>
                  {status === "submitting" ? "Sending..." : "Send me the kit"}
                </span>
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>

              <p className="text-[10px] text-neutral-600 text-center mt-6">
                By joining, you agree to receive the kit and occasional
                updates.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
