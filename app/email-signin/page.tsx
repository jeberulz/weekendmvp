import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmEmailSignIn } from "./ConfirmEmailSignIn";

export const metadata: Metadata = {
  title: "Confirm email sign in",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function EmailSignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16">
      <Suspense fallback={null}>
        <ConfirmEmailSignIn />
      </Suspense>
    </main>
  );
}
