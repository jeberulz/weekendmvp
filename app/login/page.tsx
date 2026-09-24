import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { PreviewClaimStash } from "@/components/preview/PreviewClaimHandoff";
import { normalizeCapabilityToken } from "@/convex/platform/preview/capabilities";
import { safePlatformReturn } from "@/lib/auth-return";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16">
      {claimPreview !== null && <PreviewClaimStash token={claimPreview} />}
      <AuthCard mode="login" returnTo={returnTo} />
    </main>
  );
}
