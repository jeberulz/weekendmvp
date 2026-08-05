import type { Metadata } from "next";
import { SignInPanel } from "./SignInPanel";
import { safePlatformReturn } from "@/lib/auth-return";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = safePlatformReturn(
    Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16">
      <SignInPanel returnTo={returnTo} />
    </main>
  );
}
