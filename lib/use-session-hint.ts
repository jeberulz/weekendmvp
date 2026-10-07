import { useSyncExternalStore } from "react";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";

// `document.cookie` has no change event. The hint is re-read on each render,
// and the server snapshot keeps hydration on the anonymous markup. The same
// read the marketing nav uses (`components/layout/NavAuthLinks.tsx`).
function subscribeToNothing() {
  return () => {};
}

function readSessionHint() {
  return hasSessionHintCookie(document.cookie);
}

function readServerSessionHint() {
  return false;
}

/**
 * Whether a session hint cookie is present, for wording and links only.
 * It is never an access decision: the idea page checks the real session
 * on the server, so a stale hint still lands the visitor on the right page.
 */
export function useSessionHint(): boolean {
  return useSyncExternalStore(subscribeToNothing, readSessionHint, readServerSessionHint);
}
