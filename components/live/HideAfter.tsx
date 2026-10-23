"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders children on the server and the first client paint, then hides once
 * mounted if `Date.now() >= at`. Avoids hydration mismatch while still clearing
 * cached SSR HTML without a redeploy.
 */
export function HideAfter({
  at,
  children,
}: {
  at: number;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (Date.now() >= at) {
      setHidden(true);
      return;
    }
    const ms = at - Date.now();
    const id = window.setTimeout(() => setHidden(true), Math.min(ms, 2_147_483_647));
    return () => window.clearTimeout(id);
  }, [at]);

  if (hidden) return null;
  return children;
}
