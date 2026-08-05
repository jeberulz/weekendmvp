import { Check, Cloud, Loader2 } from "lucide-react";

export function IntakeProgress({ step }: { step: "shape" | "review" }) {
  return (
    <nav aria-label="Intake progress" className="mb-8 text-sm">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <li
          aria-current={step === "shape" ? "step" : undefined}
          className="flex items-center gap-2"
        >
          <span
            className="flex size-6 items-center justify-center rounded-full border border-white/15 text-xs text-zinc-200"
            aria-hidden="true"
          >
            {step === "review" ? <Check className="size-3.5" /> : "1"}
          </span>
          <span className={step === "shape" ? "font-medium text-zinc-100" : "text-zinc-400"}>
            Shape the brief
            {step === "shape" ? <span className="sr-only"> — current step</span> : null}
          </span>
        </li>
        <li aria-hidden="true" className="hidden text-zinc-700 sm:block">/</li>
        <li
          aria-current={step === "review" ? "step" : undefined}
          className="flex items-center gap-2"
        >
          <span
            className="flex size-6 items-center justify-center rounded-full border border-white/15 text-xs text-zinc-200"
            aria-hidden="true"
          >
            2
          </span>
          <span className={step === "review" ? "font-medium text-zinc-100" : "text-zinc-400"}>
            Review and confirm
            {step === "review" ? <span className="sr-only"> — current step</span> : null}
          </span>
        </li>
      </ol>
    </nav>
  );
}

export function ResumeNotice() {
  return (
    <p className="mt-4 text-sm text-amber-200" role="status">
      Resumed your server-saved draft. Confirmed versions are never overwritten.
    </p>
  );
}

export function DraftMessage({ message }: { message: string }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="mt-4 min-h-6 text-sm text-red-300"
    >
      {message}
    </div>
  );
}

export function SaveStatus({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  return (
    <p className="flex min-h-5 items-center gap-2 text-sm text-zinc-400" aria-live="polite">
      {status === "saving" ? (
        <>
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Saving draft…
        </>
      ) : status === "saved" ? (
        <>
          <Cloud className="size-4" aria-hidden="true" />
          Draft saved
        </>
      ) : status === "error" ? (
        "Draft not saved"
      ) : (
        "Your answers stay private until you confirm."
      )}
    </p>
  );
}
