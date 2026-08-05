"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { useEffect, useState } from "react";

/** Authenticated Convex client, scoped to private/auth routes only. */
export function AuthConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client] = useState<ConvexReactClient | null>(() => {
    if (typeof window === "undefined") return null;
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    return url ? new ConvexReactClient(url) : null;
  });

  useEffect(() => {
    if (!client) return;
    return () => {
      void client.close();
    };
  }, [client]);

  if (!client) return children;

  return (
    <ConvexAuthNextjsProvider client={client}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
