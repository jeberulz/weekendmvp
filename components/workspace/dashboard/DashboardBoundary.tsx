"use client";

import { Component, type ReactNode } from "react";

/**
 * Like `QuietErrorBoundary`, but it hands the error to the fallback so the page
 * can say "AI is switched off" rather than a generic failure.
 */
export class DashboardBoundary extends Component<
  { children: ReactNode; fallback: (error: unknown) => ReactNode },
  { failed: boolean; error: unknown }
> {
  state = { failed: false, error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }

  render() {
    return this.state.failed ? this.props.fallback(this.state.error) : this.props.children;
  }
}
