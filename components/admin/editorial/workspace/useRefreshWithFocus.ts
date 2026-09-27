"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";

/**
 * Refresh the page data in a transition and, once it settles, move keyboard
 * focus to a stable element. Used after commands whose own button
 * disappears, so focus never falls back to <body>.
 */
export function useRefreshWithFocus() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    if (refreshing || !focusAfter.current) return;
    const selector = focusAfter.current;
    focusAfter.current = null;
    document.querySelector<HTMLElement>(selector)?.focus();
  }, [refreshing]);

  return useCallback(
    (focusSelector: string) => {
      focusAfter.current = focusSelector;
      startRefresh(() => router.refresh());
    },
    [router],
  );
}
