import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PreviewClaimStash } from "@/components/preview/PreviewClaimHandoff";
import { normalizeCapabilityToken } from "@/convex/platform/preview/capabilities";
import { safePlatformReturn } from "@/lib/auth-return";

export const metadata: Metadata = {
  title: "Login",
  robots: { index: false, follow: false },
  // `?claimPreview=` carries a live capability, and this page links to the
  // rest of the site. Middleware sends the same policy as a header.
  referrer: "no-referrer",
};

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string | string[];
    claimPreview?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const returnTo = safePlatformReturn(
    Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo,
  );

  // WP27-S5. Shape-check before any client stash — same normalizer as the
  // server claim path. Malformed values are dropped silently.
  const claimPreview = normalizeCapabilityToken(
    Array.isArray(params.claimPreview)
      ? params.claimPreview[0]
      : params.claimPreview,
  );

  // Middleware lets a signed-in visitor through only when a claim is present
  // (`authRouteDecision`), so the Convex round trip is paid only then.
  let continueTo: string | undefined;
  if (claimPreview !== null) {
    await connection();
    if (await isAuthenticatedNextjs()) {
      continueTo = returnTo;
    }
  }

  return (
    <AuthPageShell>
      {claimPreview !== null && <PreviewClaimStash token={claimPreview} continueTo={continueTo} />}
      <AuthCard mode="login" returnTo={returnTo} />
    </AuthPageShell>
  );
}
