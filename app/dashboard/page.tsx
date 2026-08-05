import type { Metadata } from "next";
import { SignOutButton } from "./SignOutButton";

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

export default function DashboardPlaceholderPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-300">
              Weekend MVP
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Workspace foundation
            </h1>
          </div>
          <SignOutButton />
        </div>
        <div className="mt-12 rounded-2xl border border-dashed border-white/15 p-8">
          <p className="text-sm leading-6 text-zinc-400">
            Authentication is connected. WP23 will replace this bounded
            placeholder with the approved dashboard and Explore experience.
          </p>
        </div>
      </div>
    </main>
  );
}
