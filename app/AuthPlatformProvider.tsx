import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { AuthConvexClientProvider } from "./AuthConvexClientProvider";

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
    <ConvexAuthNextjsServerProvider>
      <AuthConvexClientProvider>{children}</AuthConvexClientProvider>
    </ConvexAuthNextjsServerProvider>
  );
}
