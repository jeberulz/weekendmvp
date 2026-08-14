"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await signOut();
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className={cn(
        "min-h-11 w-full rounded-2xl border border-stone-900/15 px-4 text-left text-sm text-stone-800 transition hover:border-stone-900/30 hover:bg-white disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
