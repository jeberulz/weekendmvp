"use client";

import { useCallback, useSyncExternalStore } from "react";

// Interim, per-browser dismissals until WP44-S12 stores them on the member
// (`user_preferences.dismissed`). Storage can be missing or blocked, so a
// dismissal still holds for the page view through the in-memory set.
const PREFIX = "wmvp:dismissed:";
const CHANGE_EVENT = "wmvp:dismissed-change";
const memory = new Set<string>();

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function isDismissed(id: string) {
  if (memory.has(id)) return true;
  try {
    return window.localStorage.getItem(PREFIX + id) === "1";
  } catch {
    return false;
  }
}

/** `[dismissed, dismiss]` for one card id. Reads as not dismissed on the server. */
export function useDismissed(id: string) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => isDismissed(id),
    () => false,
  );

  const dismiss = useCallback(() => {
    memory.add(id);
    try {
      window.localStorage.setItem(PREFIX + id, "1");
    } catch {
      // Blocked storage: the in-memory set keeps it hidden for this page view.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [id]);

  return [dismissed, dismiss] as const;
}
