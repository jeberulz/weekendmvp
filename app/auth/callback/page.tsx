import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Completing sign in",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16 text-zinc-100">
      <div className="max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-8">
        <h1 className="text-2xl font-semibold">Sign-in could not be completed</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          The link may be invalid or expired. No account changes were made.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-950"
        >
          Return to sign in
        </Link>
      </div>
    </main>
  );
}
