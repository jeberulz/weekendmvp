"use client";

import * as React from "react";
import { X } from "lucide-react";

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
import { useConsent } from "./ConsentProvider";

type ConsentCustomizeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Cookie Preferences" dialog, ported from the legacy
 * `#cookie-customize-modal` markup onto shadcn Dialog (Escape, backdrop
 * click, focus trap, and focus return handled by Radix).
 */
export function ConsentCustomizeModal({
  open,
  onOpenChange,
}: ConsentCustomizeModalProps) {
  const { consent, setConsent } = useConsent();
  const toggleId = React.useId();
  const descriptionId = React.useId();
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState(false);

  // Mirror legacy behavior: each time the dialog opens, the toggle reflects
  // the currently stored consent.
  React.useEffect(() => {
    if (open) {
      setAnalyticsEnabled(consent === true);
    }
  }, [open, consent]);

  function handleSave() {
    setConsent(analyticsEnabled);
    onOpenChange(false);
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
            aria-label="Close cookie preferences"
            className="absolute top-5 right-5 rounded-full text-home-ink-3 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
          >
            <X size={20} />
          </IconButton>
        </DialogClose>

        <div className="mb-6">
          <DialogTitle className="mb-2 font-editorial text-[30px] font-normal leading-tight tracking-[-0.02em] text-home-ink">
            Cookie Preferences
          </DialogTitle>
          <DialogDescription className="text-sm leading-[1.55] text-home-ink-2">
            Choose which cookies you want to allow.
          </DialogDescription>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex items-start justify-between gap-4 border-y border-home-rule py-4">
            <div className="flex-1">
              <label
                htmlFor={toggleId}
                className="mb-1 block text-sm font-semibold text-home-ink"
              >
                Analytics
              </label>
              <p id={descriptionId} className="text-[13px] leading-[1.5] text-home-ink-2">
                Help us understand how visitors interact with our site.
              </p>
            </div>
            <span className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                id={toggleId}
                role="switch"
                aria-checked={analyticsEnabled}
                aria-describedby={descriptionId}
                checked={analyticsEnabled}
                onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="h-6 w-11 rounded-full bg-home-ink-3 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-home-card after:transition-transform after:content-[''] peer-checked:bg-home-orange-ink peer-checked:after:translate-x-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-home-orange-ink motion-reduce:transition-none motion-reduce:after:transition-none"
              />
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-home-ink px-6 text-sm font-semibold text-home-paper transition-colors hover:bg-home-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
          >
            Save Preferences
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
