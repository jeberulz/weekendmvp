"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

const browserClientCache = globalThis as typeof globalThis & {
  __weekendMvpAuthConvexClient?: ConvexReactClient;
};

function getBrowserClient() {
  if (typeof window === "undefined") return null;
  if (browserClientCache.__weekendMvpAuthConvexClient) {
    return browserClientCache.__weekendMvpAuthConvexClient;
  }

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;

  const client = new ConvexReactClient(url);
  browserClientCache.__weekendMvpAuthConvexClient = client;
  return client;
}

/** Authenticated Convex client, scoped to private/auth routes only. */
export function AuthConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = getBrowserClient();

  if (!client) return children;

  return (
    <ConvexAuthNextjsProvider client={client}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
