import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthConvexClientProvider } from "./AuthConvexClientProvider";

function AuthPlatformFallback() {
  return <div className="min-h-screen bg-black" aria-hidden="true" />;
}

async function RequestTimeAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Convex Auth reads cookie/session time inside third-party server code.
  // Next 16 Cache Components requires an explicit request boundary first.
  await connection();

  return (
    <ConvexAuthNextjsServerProvider>
      <AuthConvexClientProvider>{children}</AuthConvexClientProvider>
    </ConvexAuthNextjsServerProvider>
  );
}

/**
 * Keep cookie-backed auth state inside platform routes. Mounting this in the
 * root layout would make every canonical public content page dynamic.
 */
export function AuthPlatformProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AuthPlatformFallback />}>
      <RequestTimeAuthProvider>{children}</RequestTimeAuthProvider>
    </Suspense>
  );
}
