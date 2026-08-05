"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { authCallbackTarget, safePlatformReturn } from "@/lib/auth-return";

export function SignInPanel({ returnTo }: { returnTo: string }) {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signInWithGoogle() {
    setPending(true);
    setFailed(false);
    try {
      await signIn("google", {
        redirectTo: authCallbackTarget(safePlatformReturn(returnTo)),
      });
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-8 text-zinc-100 shadow-2xl shadow-black/30">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-300">
        Weekend MVP
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Continue to your workspace
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Sign in to keep previews, validation work, and future projects attached
        to your account.
      </p>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={pending}
        className="mt-8 flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>

      {failed ? (
        <p role="alert" className="mt-4 text-sm text-red-300">
          We could not start sign-in. Please try again.
        </p>
      ) : null}

      <p className="mt-6 text-xs leading-5 text-zinc-500">
        Email magic links will appear here after the email delivery provider is
        approved and configured.
      </p>
    </div>
  );
}
