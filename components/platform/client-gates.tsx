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
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted || !isValidPlatformConvexUrl(process.env.NEXT_PUBLIC_CONVEX_URL)) {
    return fallback;
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
