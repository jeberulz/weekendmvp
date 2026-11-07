/**
 * WP67 employee pages — "Ask Wren about {name}". A page puts a question into
 * the Wren composer without sending it: the chat column opens (it is a drawer
 * below `xl`) and the composer takes the text and focus. Wren is the only chat
 * in the workspace, so this is the one way a page talks to it.
 */

export const WREN_PREFILL_EVENT = "workspace:wren-prefill";

/** Puts `text` in the Wren composer and focuses it. Never sends. */
export function askWren(text: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(WREN_PREFILL_EVENT, { detail: text }));
}

/** Subscribes to prefill requests; returns the unsubscribe. */
export function onWrenPrefill(handler: (text: string) => void): () => void {
  const listener = (event: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === "string") handler(event.detail);
  };
  window.addEventListener(WREN_PREFILL_EVENT, listener);
  return () => window.removeEventListener(WREN_PREFILL_EVENT, listener);
}
