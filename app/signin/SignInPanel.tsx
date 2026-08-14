"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { type FormEvent, useState } from "react";
import { authCallbackTarget, safePlatformReturn } from "@/lib/auth-return";

export function SignInPanel({ returnTo }: { returnTo: string }) {
  const { signIn } = useAuthActions();
  const [googlePending, setGooglePending] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<
    "idle" | "pending" | "sent" | "failed"
  >("idle");

  async function signInWithGoogle() {
    setGooglePending(true);
    setGoogleFailed(false);
    try {
      await signIn("google", {
        redirectTo: authCallbackTarget(safePlatformReturn(returnTo)),
      });
    } catch {
      setGoogleFailed(true);
      setGooglePending(false);
    }
  }

  async function requestEmailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailState("pending");
    const normalizedEmail = email.normalize("NFKC").trim().toLowerCase();
    try {
      await signIn("email", {
        email: normalizedEmail,
        redirectTo: safePlatformReturn(returnTo),
      });
      setEmail(normalizedEmail);
      setEmailState("sent");
    } catch {
      setEmailState("failed");
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
        disabled={googlePending || emailState === "pending"}
        className="mt-8 flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
      >
        {googlePending ? "Opening Google…" : "Continue with Google"}
      </button>

      {googleFailed ? (
        <p role="alert" className="mt-4 text-sm text-red-300">
          We could not start sign-in. Please try again.
        </p>
      ) : null}

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.18em] text-zinc-600">
          or
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={requestEmailLink}>
        <label htmlFor="signin-email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailState !== "pending") setEmailState("idle");
          }}
          disabled={emailState === "pending" || googlePending}
          aria-describedby="email-signin-status"
          className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-black px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300 disabled:cursor-wait disabled:opacity-60"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={emailState === "pending" || googlePending}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/30 hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
        >
          {emailState === "pending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      <div id="email-signin-status" aria-live="polite">
        {emailState === "sent" ? (
          <p className="mt-4 text-sm leading-6 text-emerald-300">
            Check your inbox. The link expires in one hour and will ask you to
            confirm the account before signing in.
          </p>
        ) : null}
        {emailState === "failed" ? (
          <p role="alert" className="mt-4 text-sm leading-6 text-red-300">
            We could not send a sign-in link. Please try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}
