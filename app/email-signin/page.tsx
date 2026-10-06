import type { Metadata } from "next";
import { Suspense } from "react";

import { newsreaderEditorial } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { ConfirmEmailSignIn } from "./ConfirmEmailSignIn";

export const metadata: Metadata = {
  title: "Confirm email sign in",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function EmailSignInPage() {
  return (
    <div
      className={cn(
        newsreaderEditorial.variable,
        "theme-desk relative min-h-screen overflow-x-clip bg-home-paper font-sans text-home-ink selection:bg-home-orange-light/40",
      )}
    >
      <div aria-hidden className="home-dots absolute inset-0 opacity-60" />
      <main className="relative flex min-h-screen items-center justify-center px-5 py-16">
        <Suspense fallback={null}>
          <ConfirmEmailSignIn />
        </Suspense>
      </main>
    </div>
  );
}
