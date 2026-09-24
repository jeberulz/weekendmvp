import { redirect } from "next/navigation";
import { normalizeCapabilityToken } from "@/convex/platform/preview/capabilities";
import { safePlatformReturn } from "@/lib/auth-return";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const instant = false;

/**
 * Back-compat alias for `/login`. Preview claim stash and `returnTo` query
 * params are forwarded so existing `/signin?claimPreview=` links keep working.
 */
export default async function SignInRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string | string[];
    claimPreview?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();

  const returnTo = safePlatformReturn(
    Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo,
  );
  if (returnTo !== "/dashboard") {
    qs.set("returnTo", returnTo);
  }

  const claimPreview = normalizeCapabilityToken(
    Array.isArray(params.claimPreview)
      ? params.claimPreview[0]
      : params.claimPreview,
  );
  if (claimPreview !== null) {
    qs.set("claimPreview", claimPreview);
  }

  const query = qs.toString();
  redirect(query ? `/login?${query}` : "/login");
}
