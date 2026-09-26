import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthConvexClientProvider } from "./AuthConvexClientProvider";

function AuthPlatformFallback({ className }: { className: string }) {
  return <div className={`min-h-screen ${className}`} aria-hidden="true" />;
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
  fallbackClassName = "bg-black",
}: {
  children: React.ReactNode;
  /** Background shown while auth resolves. The light dashboard passes paper. */
  fallbackClassName?: string;
}) {
  return (
    <Suspense fallback={<AuthPlatformFallback className={fallbackClassName} />}>
      <RequestTimeAuthProvider>{children}</RequestTimeAuthProvider>
    </Suspense>
  );
}
