"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { safePlatformReturn } from "@/lib/auth-return";

export function ConfirmEmailSignIn() {
  const params = useSearchParams();
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const email =
    params.get("email")?.normalize("NFKC").trim().toLowerCase() ?? "";
  const token = params.get("token") ?? "";
  const returnTo = safePlatformReturn(params.get("returnTo"));
  const ready = email !== "" && token !== "";

  async function confirm() {
    if (!ready) return;
    setPending(true);
    setFailed(false);
    try {
      await signIn("email", { code: token, email });
      router.replace(returnTo);
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-8 text-zinc-100 shadow-2xl shadow-black/30">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-amber-300">
        Confirm sign in
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Check the account first
      </h1>
      {ready ? (
        <>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            This link will sign this browser in as:
          </p>
          <p className="mt-3 break-all rounded-lg border border-white/10 bg-black px-4 py-3 text-sm text-zinc-100">
            {email}
          </p>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="mt-6 flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Confirming…" : "Yes, sign me in"}
          </button>
        </>
      ) : (
        <p role="alert" className="mt-4 text-sm leading-6 text-red-300">
          This sign-in link is incomplete or invalid. Request a new link from
          the sign-in page.
        </p>
      )}
      {failed ? (
        <p role="alert" className="mt-4 text-sm leading-6 text-red-300">
          This sign-in link is invalid, expired, or already used. Request a new
          link and try again.
        </p>
      ) : null}
    </div>
  );
}
