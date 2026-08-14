import type { Metadata } from "next";
import { SignInPanel } from "./SignInPanel";
import { safePlatformReturn } from "@/lib/auth-return";
import { normalizeCapabilityToken } from "@/convex/platform/preview/capabilities";
import { PreviewClaimStash } from "@/components/preview/PreviewClaimHandoff";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function SignInPage({
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

  // WP27-S5. `/preview/{token}` sends its capability here so signing up keeps
  // the preview. Shape-checked with the same normalizer the server uses, so
  // an arbitrary query string can never reach client storage; anything else
  // is dropped silently rather than surfaced, because a malformed value is
  // indistinguishable from an unknown one everywhere else in this package.
  const claimPreview = normalizeCapabilityToken(
    Array.isArray(params.claimPreview)
      ? params.claimPreview[0]
      : params.claimPreview,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16">
      {claimPreview !== null && <PreviewClaimStash token={claimPreview} />}
      <SignInPanel returnTo={returnTo} />
    </main>
  );
}
