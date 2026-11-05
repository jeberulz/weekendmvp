import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BTN_SECONDARY } from "./styles";

export function EmptyState({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      data-state="empty"
      className={cn(
        "rounded-xl border border-dashed border-home-d2 px-4 py-6 text-center text-sm text-home-ink-2",
        className,
      )}
    >
      {title ? <p className="mb-1 font-medium text-home-ink">{title}</p> : null}
      <p>{children}</p>
    </div>
  );
}

/** The spinner stops under prefers-reduced-motion; the text label always stays. */
export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      data-state="loading"
      className={cn("flex items-center gap-2 px-4 py-6 text-sm text-home-ink-2", className)}
    >
      <Loader2
        aria-hidden="true"
        className="size-4 animate-spin text-home-orange-ink motion-reduce:animate-none"
      />
      <span>{label}</span>
    </div>
  );
}

/** `onRetry` is a function prop: render this from a client component when you pass it. */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-state="error"
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-home-clay-ink/30 bg-home-clay px-4 py-4 text-sm text-home-clay-ink",
        className,
      )}
    >
      <p className="flex items-start gap-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{message}</span>
      </p>
      {onRetry ? (
        <button type="button" className={BTN_SECONDARY} onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
