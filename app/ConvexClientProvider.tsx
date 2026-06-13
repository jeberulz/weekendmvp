"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, useContext, useEffect, useState } from "react";

const ConvexReadyContext = createContext(false);

/** True once the reactive Convex client is mounted (client-side only). */
export function useConvexReady() {
  return useContext(ConvexReadyContext);
}

/**
 * Mounts the reactive Convex client after hydration. Construction is deferred
 * to the browser because ConvexReactClient uses Math.random(), which Cache
 * Components forbids during static prerender. Server-side data loading uses
 * fetchQuery/preloadQuery and does not need this provider; client components
 * that call useQuery must gate on useConvexReady().
 */
export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return;
    const c = new ConvexReactClient(url);
    setClient(c);
    return () => {
      void c.close();
    };
  }, []);

  if (!client) {
    return (
      <ConvexReadyContext.Provider value={false}>
        {children}
      </ConvexReadyContext.Provider>
    );
  }

  return (
    <ConvexReadyContext.Provider value={true}>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </ConvexReadyContext.Provider>
  );
}
