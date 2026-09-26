"use client";

import { Component, useSyncExternalStore, type ReactNode } from "react";
import { isValidPlatformConvexUrl } from "@/lib/platform-convex-url";

const emptySubscribe = () => () => undefined;

/**
 * Renders children only in the browser, and only when a Convex client can
 * exist. On the server `AuthConvexClientProvider` mounts no client, so any
 * `useQuery` or `useMutation` there throws and React drops the whole page to
 * client rendering. Wrap every Convex consumer that sits outside another gate.
 */
export function WhenConvexReady({
  children,
  fallback = null,
  unavailable,
}: {
  children: ReactNode;
  /** Shown on the server and during the first client render. */
  fallback?: ReactNode;
  /** Shown in the browser when the Convex URL is missing or invalid. Defaults to `fallback`. */
  unavailable?: ReactNode;
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return fallback;
  if (!isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) {
    return unavailable === undefined ? fallback : unavailable;
  }
  return children;
}

/**
 * For small, optional pieces (a nav count) whose failure must never take the
 * page down, for example when a session expires while the page is open.
 */
export class QuietErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
