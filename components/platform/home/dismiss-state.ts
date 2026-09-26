"use client";

import { useSyncExternalStore } from "react";

// WP44-S4 kept offer dismissals in this browser. S12 stores them on the
// member (`user_preferences.dismissed`). These helpers only read the old
// keys, so a card closed before S12 stays closed and moves to the server.
const PREFIX = "wmvp:dismissed:";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function read(id: string | null) {
  if (id === null) return false;
  try {
    return window.localStorage.getItem(PREFIX + id) === "1";
  } catch {
    return false;
  }
}

/** Whether this browser dismissed `id` before S12. False on the server. */
export function useLegacyDismissed(id: string | null) {
  return useSyncExternalStore(
    subscribe,
    () => read(id),
    () => false,
  );
}

export function clearLegacyDismissal(id: string) {
  try {
    window.localStorage.removeItem(PREFIX + id);
  } catch {
    // Blocked storage: nothing to clear.
  }
}
