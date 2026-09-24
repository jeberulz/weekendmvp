import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PreviewClaimStash } from "@/components/preview/PreviewClaimHandoff";
import { normalizeCapabilityToken } from "@/convex/platform/preview/capabilities";
import { safePlatformReturn } from "@/lib/auth-return";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function SignupPage({
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

  const claimPreview = normalizeCapabilityToken(
    Array.isArray(params.claimPreview)
      ? params.claimPreview[0]
      : params.claimPreview,
  );

  return (
    <AuthPageShell>
      {claimPreview !== null && <PreviewClaimStash token={claimPreview} />}
      <AuthCard mode="signup" returnTo={returnTo} />
    </AuthPageShell>
  );
}
