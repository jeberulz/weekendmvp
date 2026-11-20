"use client";

import { Component, type ReactNode } from "react";
import { reportClientError } from "@/components/workspace/feedback/clientErrors";

type Props = {
  children: ReactNode;
  /**
   * What to show instead of the crashed subtree. Receives `reset`. Without it the
   * error is reported and then re-thrown, so the route's own `error.tsx` shows.
   */
  fallback?: (reset: () => void) => ReactNode;
  /** When this value changes (a navigation), a shown fallback clears. */
  resetKey?: string;
};

type State = { error: Error | null };

/**
 * WP95-S3. Reports a client render error (class, route and business only, via
 * `reportClientError`) and either shows `fallback` or hands the error up.
 */
export class ReportingBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error("Unknown") };
  }

  componentDidCatch(error: unknown) {
    reportClientError({ source: "boundary", error });
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error !== null && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (this.props.fallback === undefined) {
      // A boundary that throws while rendering is skipped by React, so its `componentDidCatch` never
      // commits. Report here, before handing the error up (repeats within a few seconds count once).
      reportClientError({ source: "boundary", error });
      throw error;
    }
    return this.props.fallback(this.reset);
  }
}
