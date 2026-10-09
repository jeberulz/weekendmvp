"use client";

import { useSyncExternalStore } from "react";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";
import { MegaNav } from "@/components/layout/MegaNav";
import { IdeaMemberNav } from "./IdeaMemberNav";

// `document.cookie` has no change event. The server snapshot keeps hydration
// on the shared public menu before the member hint is read.
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
 * Individual idea pages only: shared cream MegaNav for anonymous visitors, member
 * PRIMARY_NAV chrome when the WP44 session hint is set.
 */
export function IdeaPageNav() {
  const signedIn = useSyncExternalStore(
    subscribeToNothing,
    readSessionHint,
    readServerSessionHint,
  );

  if (signedIn) {
    return <IdeaMemberNav />;
  }

  return <MegaNav variant="cream" id="idea-site-header" />;
}
