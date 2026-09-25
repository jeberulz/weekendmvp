"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export function useSignOut() {
  // Undefined when the Convex URL is missing and no auth provider mounts.
  // The shell must still render then, so signing out just leaves.
  const actions = useAuthActions() as
    | ReturnType<typeof useAuthActions>
    | undefined;
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = useCallback(async () => {
    setPending(true);
    try {
      await actions?.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }, [actions, router]);

  return { pending, run };
}

export function SignOutButton({ className }: { className?: string }) {
  const { pending, run } = useSignOut();

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className={cn(
        "min-h-11 rounded-lg border border-home-rule bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:border-home-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
