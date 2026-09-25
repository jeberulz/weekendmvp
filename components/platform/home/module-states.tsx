"use client";

import { Component, type ReactNode } from "react";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { cn } from "@/lib/utils";
import { MODULE_ERROR_COPY } from "./home-copy";

/** Sized to the loaded module so nothing jumps. Announces itself once. */
export function ModuleSkeleton({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "animate-pulse rounded-[14px] bg-home-sunk motion-reduce:animate-none",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ModuleError({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-home-rule bg-home-card px-5 py-4",
        className,
      )}
    >
      <p className="text-sm text-home-ink-2">{MODULE_ERROR_COPY}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center rounded-[9px] border border-home-rule bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:border-home-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * One failed personal query shows a module-level error. The rest of Home,
 * including the server-rendered editorial modules, stays on screen.
 */
export class ModuleErrorBoundary extends Component<
  { children: ReactNode; className?: string },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // The technical detail stays in the console (PRD 6.8).
    console.error("Dashboard module failed to load", error);
  }

  private retry = () => {
    this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
  };

  render() {
    if (this.state.failed) {
      return <ModuleError onRetry={this.retry} className={this.props.className} />;
    }
    return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
  }
}

/** The gate every personal (Convex) module on Home sits behind. */
export function PersonalModule({
  skeleton,
  children,
  className,
}: {
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <WhenConvexReady fallback={skeleton} unavailable={<ModuleError className={className} />}>
      <ModuleErrorBoundary className={className}>{children}</ModuleErrorBoundary>
    </WhenConvexReady>
  );
}
