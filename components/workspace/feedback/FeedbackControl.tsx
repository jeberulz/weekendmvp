"use client";

import { MessageSquare } from "lucide-react";
import { useRef, useState } from "react";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { FeedbackDialog } from "@/components/workspace/feedback/FeedbackDialog";
import { FOCUS } from "@/components/workspace/kit/styles";
import { SENT_COPY } from "@/components/workspace/feedback/feedbackForm";
import type { StepState } from "@/lib/feedback/contracts";
import type { FeedbackSurface } from "@/lib/feedback/contracts";
import { cn } from "@/lib/utils";

/**
 * WP95-S2. The "Send feedback" control. The button costs nothing until it is
 * used: the dialog (and its Convex hooks) mounts on the first click.
 *
 * Accessibility: the button is a real button with a visible label. After a
 * send the dialog closes, focus returns to the button and one polite status
 * line says it was sent.
 */
export function FeedbackControl({
  surface,
  projectId,
  extraStates,
  variant = "sidebar",
  className,
}: {
  surface: FeedbackSurface;
  /** The business, when there is one. */
  projectId?: string;
  /** Extra context states, e.g. the wizard step. Plain tokens only. */
  extraStates?: readonly StepState[];
  variant?: "sidebar" | "header";
  className?: string;
}) {
  // The route is read when the dialog opens, so the control needs no router hook.
  const [route, setRoute] = useState<string | null>(null);
  const open = route !== null;
  const [everOpened, setEverOpened] = useState(false);
  const [sent, setSent] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close(wasSent: boolean) {
    setRoute(null);
    if (wasSent) setSent(true);
    // The dialog is unmounting: put focus back where the founder started.
    triggerRef.current?.focus();
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setSent(false);
          setEverOpened(true);
          setRoute(window.location.pathname);
        }}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-md px-2.5 text-sm text-home-ink hover:bg-home-sunk",
          variant === "header" && "text-[13px] text-home-ink-3 underline-offset-2 hover:underline",
          FOCUS,
        )}
      >
        <MessageSquare aria-hidden="true" strokeWidth={1.7} className="size-4 shrink-0" />
        Send feedback
      </button>
      {/* Mounted at the first open, before the send, so its text change is announced. A page that never opens feedback has no extra live region. */}
      {everOpened ? (
        <p role="status" aria-live="polite" className={cn("px-2.5 text-[13px] text-home-ink-2", sent ? "" : "sr-only")}>
          {sent ? SENT_COPY : ""}
        </p>
      ) : null}
      {open ? (
        <WhenConvexReady>
          <FeedbackDialog
            surface={surface}
            route={route}
            projectId={projectId}
            extraStates={extraStates ?? []}
            onClose={close}
          />
        </WhenConvexReady>
      ) : null}
    </div>
  );
}
