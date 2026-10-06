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
import { newsreaderEditorial } from "@/lib/fonts";
import { cn } from "@/lib/utils";
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
        className={cn(
          newsreaderEditorial.variable,
          "max-w-md rounded-2xl border border-home-ink bg-home-card p-7 font-sans text-home-ink sm:max-w-md sm:p-8",
        )}
      >
        <DialogClose asChild>
          <IconButton
            aria-label="Close modal"
            className="absolute top-5 right-5 rounded-full text-home-ink-3 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
          >
            <X size={20} />
          </IconButton>
        </DialogClose>

        {status === "success" ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-home-sage text-home-sage-ink">
              <CheckCircle size={32} aria-hidden="true" />
            </div>
            <DialogTitle className="mb-2 font-editorial text-[30px] font-normal leading-tight tracking-[-0.02em] text-home-ink">
              Check your inbox!
            </DialogTitle>
            <DialogDescription className="mb-8 text-sm leading-[1.55] text-home-ink-2">
              The Weekend MVP Starter Kit is on its way to you.
            </DialogDescription>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-11 items-center rounded-full border border-home-ink px-6 text-sm font-semibold text-home-ink transition-colors hover:bg-home-ink hover:text-home-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <DialogTitle className="mb-2 font-editorial text-[32px] font-normal leading-tight tracking-[-0.02em] text-home-ink">
                Get the <em className="italic text-home-orange">Starter Kit</em>
              </DialogTitle>
              <DialogDescription className="text-sm leading-[1.55] text-home-ink-2">
                Enter your details and we&apos;ll send the kit right over.
              </DialogDescription>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor={firstNameId}
                  className="mb-2 block font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-2"
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
                  className="h-[52px] w-full rounded-full border border-home-ink-3 bg-home-card px-5 text-base text-home-ink transition-colors placeholder:text-home-ink-3 focus-visible:border-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
                />
              </div>
              <div>
                <label
                  htmlFor={emailId}
                  className="mb-2 block font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-ink-2"
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
                  className="h-[52px] w-full rounded-full border border-home-ink-3 bg-home-card px-5 text-base text-home-ink transition-colors placeholder:text-home-ink-3 focus-visible:border-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
                />
              </div>

              {status === "error" && (
                <p
                  id={errorId}
                  role="alert"
                  className="text-sm text-[#b42318]"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="group relative mt-4 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-home-orange-ink px-8 text-base font-semibold text-white transition-colors hover:bg-[#8f3f00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>
                  {status === "submitting" ? "Sending..." : "Send me the kit"}
                </span>
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </button>

              <p className="mt-5 text-center text-xs text-home-ink-3">
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
