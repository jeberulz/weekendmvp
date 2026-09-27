"use client";

import { useSyncExternalStore } from "react";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";
import { IdeaNav } from "@/components/layout/IdeaNav";
import { IdeaMemberNav } from "./IdeaMemberNav";

// `document.cookie` has no change event. The server snapshot keeps hydration
// on the public IdeaNav so crawlers and anonymous readers stay unchanged.
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
 * Individual idea pages only: public IdeaNav for anonymous visitors, member
 * PRIMARY_NAV chrome when the WP44 session hint is set.
 */
export function IdeaPageNav({ withSidebar = false }: { withSidebar?: boolean }) {
  const signedIn = useSyncExternalStore(
    subscribeToNothing,
    readSessionHint,
    readServerSessionHint,
  );

  if (signedIn) {
    return <IdeaMemberNav />;
  }

  return <IdeaNav withSidebar={withSidebar} />;
}
