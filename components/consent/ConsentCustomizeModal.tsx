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
        className="max-w-md rounded-3xl border border-white/10 bg-neutral-950 p-8 text-white shadow-2xl sm:max-w-md"
      >
        <DialogClose asChild>
          <IconButton
            aria-label="Close cookie preferences"
            className="absolute top-6 right-6 rounded text-neutral-500 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            <X size={20} />
          </IconButton>
        </DialogClose>

        <div className="mb-6">
          <DialogTitle className="mb-2 text-2xl font-medium tracking-tight text-white">
            Cookie Preferences
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-400">
            Choose which cookies you want to allow.
          </DialogDescription>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex-1">
              <label
                htmlFor={toggleId}
                className="mb-1 block text-sm font-medium text-white"
              >
                Analytics
              </label>
              <p id={descriptionId} className="text-xs text-neutral-500">
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
                className="h-6 w-11 rounded-full bg-neutral-800 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-white peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-white/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-neutral-950"
              />
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-neutral-950"
          >
            Save Preferences
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
