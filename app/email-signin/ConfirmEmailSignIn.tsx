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
    <div className="w-full max-w-md rounded-2xl border border-home-rule bg-home-card p-8 text-home-ink sm:p-10">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-home-orange-ink">
        Confirm sign in
      </p>
      <h1 className="mt-4 font-editorial text-[34px] font-normal leading-[1.08] tracking-[-0.02em] text-balance text-home-ink">
        Check the account first
      </h1>
      {ready ? (
        <>
          <p className="mt-3 text-[15px] leading-6 text-home-ink-2">
            This link will sign this browser in as:
          </p>
          <p className="mt-3 break-all rounded-xl border border-home-rule bg-home-paper px-4 py-3 text-sm text-home-ink">
            {email}
          </p>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="mt-6 flex h-[52px] w-full items-center justify-center rounded-full bg-home-ink px-4 text-base font-semibold text-home-d1 transition-colors hover:bg-home-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
          >
            {pending ? "Confirming…" : "Yes, sign me in"}
          </button>
        </>
      ) : (
        <p role="alert" className="mt-4 text-sm leading-6 text-destructive">
          This sign-in link is incomplete or invalid. Request a new link from
          the login page.
        </p>
      )}
      {failed ? (
        <p role="alert" className="mt-4 text-sm leading-6 text-destructive">
          This sign-in link is invalid, expired, or already used. Request a new
          link and try again.
        </p>
      ) : null}
    </div>
  );
}
