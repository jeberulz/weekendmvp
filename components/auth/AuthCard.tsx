"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { type FormEvent, useId, useState } from "react";
import { Em } from "@/components/home/ui";
import { Logo } from "@/components/primitives/Logo";
import { authCallbackTarget, safePlatformReturn } from "@/lib/auth-return";

export type AuthCardMode = "login" | "signup";

const COPY: Record<
  AuthCardMode,
  {
    title: string;
    subtitle: string;
    emailCta: string;
    emailSent: string;
    emailFailed: string;
    crossPrompt: string;
    crossLabel: string;
    crossHref: string;
  }
> = {
  login: {
    title: "Welcome back!",
    subtitle:
      "Sign in with your email — we'll send a one-time code (magic link). No password needed.",
    emailCta: "Send One-Time Code",
    emailSent:
      "Check your inbox. The link expires in one hour and will ask you to confirm before signing in.",
    emailFailed: "We could not send a one-time code. Please try again.",
    crossPrompt: "Don't have an account?",
    crossLabel: "Sign up",
    crossHref: "/signup",
  },
  signup: {
    title: "Create your free account",
    subtitle:
      "Enter your email — we'll send a one-time code (magic link) to get you started. No password needed.",
    emailCta: "Send One-Time Code",
    emailSent:
      "Check your inbox. The link expires in one hour and will ask you to confirm before creating your account.",
    emailFailed: "We could not send a one-time code. Please try again.",
    crossPrompt: "Already have an account?",
    crossLabel: "Login",
    crossHref: "/login",
  },
};

export function AuthCard({
  mode,
  returnTo,
}: {
  mode: AuthCardMode;
  returnTo: string;
}) {
  const copy = COPY[mode];
  const { signIn } = useAuthActions();
  const emailFieldId = useId();
  const statusId = useId();
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

  const busy = googlePending || emailState === "pending";
  const titleWords = copy.title.split(" ");
  const titleTail = titleWords.pop();

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-home-rule bg-home-card p-8 text-home-ink sm:p-10">
        <h1 className="text-balance text-center font-editorial text-[40px] font-normal leading-[1.05] tracking-[-0.02em] text-home-ink sm:text-[44px]">
          {titleWords.join(" ")} <Em>{titleTail}</Em>
        </h1>
        <p className="mt-3 text-center text-[15px] leading-[1.55] text-home-ink-2">
          {copy.subtitle}
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="mt-8 flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full border border-home-ink bg-home-card px-4 text-base font-medium text-home-ink transition-colors hover:bg-home-ink hover:text-home-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
        >
          <GoogleGlyph />
          {googlePending ? "Opening Google…" : "Continue with Google"}
        </button>

        {googleFailed ? (
          <p role="alert" className="mt-4 text-center text-sm text-destructive">
            We could not start sign-in. Please try again.
          </p>
        ) : null}

        <div className="my-6 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-home-rule" />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
            Or
          </span>
          <span className="h-px flex-1 bg-home-rule" />
        </div>

        <form onSubmit={requestEmailLink} className="flex flex-col">
          <label
            htmlFor={emailFieldId}
            className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-2"
          >
            Email address
          </label>
          <input
            id={emailFieldId}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailState !== "pending") setEmailState("idle");
            }}
            disabled={busy}
            aria-describedby={statusId}
            className="h-[52px] w-full rounded-full border border-home-ink-3 bg-home-card px-5 text-base text-home-ink transition-colors placeholder:text-home-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
            placeholder="Enter your email"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-3 flex h-[52px] w-full items-center justify-center rounded-full bg-home-ink px-4 text-base font-semibold text-home-d1 transition-colors hover:bg-home-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
          >
            {emailState === "pending" ? "Sending…" : copy.emailCta}
          </button>
        </form>

        <div id={statusId} aria-live="polite" className="text-center">
          {emailState === "sent" ? (
            <p className="mt-4 text-sm leading-6 text-home-sage-ink">
              {copy.emailSent}
            </p>
          ) : null}
          {emailState === "failed" ? (
            <p role="alert" className="mt-4 text-sm leading-6 text-destructive">
              {copy.emailFailed}
            </p>
          ) : null}
        </div>

        <p className="mt-8 text-center text-sm text-home-ink-2">
          {copy.crossPrompt}{" "}
          <Link
            href={withReturnTo(copy.crossHref, returnTo)}
            className="font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
          >
            {copy.crossLabel}
          </Link>
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <Logo className="h-4 w-28 text-home-ink-3" />
      </div>
    </div>
  );
}

function withReturnTo(href: string, returnTo: string) {
  if (returnTo === "/dashboard") return href;
  return `${href}?returnTo=${encodeURIComponent(returnTo)}`;
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
