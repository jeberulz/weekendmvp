"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useId,
  useState,
} from "react";
import { Em } from "@/components/home/ui";
import { Logo } from "@/components/primitives/Logo";
import { authCallbackTarget, safePlatformReturn } from "@/lib/auth-return";

export type AuthCardMode = "login" | "signup";

const RESEND_COOLDOWN_SECONDS = 30;

const COPY: Record<
  AuthCardMode,
  {
    title: string;
    subtitle: string;
    emailCta: string;
    emailFailed: string;
    crossPrompt: string;
    crossLabel: string;
    crossHref: string;
  }
> = {
  login: {
    title: "Welcome back!",
    subtitle:
      "We'll email you a link that signs you in. No password needed.",
    emailCta: "Email me a sign-in link",
    emailFailed: "We could not send a sign-in link. Please try again.",
    crossPrompt: "Don't have an account?",
    crossLabel: "Sign up",
    crossHref: "/signup",
  },
  signup: {
    title: "Create your free account",
    subtitle:
      "We'll email you a link that signs you in. No password needed.",
    emailCta: "Email me a sign-in link",
    emailFailed: "We could not send a sign-in link. Please try again.",
    crossPrompt: "Already have an account?",
    crossLabel: "Login",
    crossHref: "/login",
  },
};

export function AuthCard({
  mode,
  returnTo,
  embedded = false,
}: {
  mode: AuthCardMode;
  returnTo: string;
  embedded?: boolean;
}) {
  const [currentMode, setCurrentMode] = useState(mode);
  const copy = COPY[currentMode];
  const { signIn } = useAuthActions();
  const emailFieldId = useId();
  const statusId = useId();
  const [googlePending, setGooglePending] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [emailState, setEmailState] = useState<
    "idle" | "pending" | "sent" | "failed"
  >("idle");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

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

  async function sendSignInLink(targetEmail: string) {
    setEmailState("pending");
    try {
      await signIn("email", {
        email: targetEmail,
        redirectTo: safePlatformReturn(returnTo),
      });
      setEmail(targetEmail);
      setSentEmail(targetEmail);
      setEmailState("sent");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setEmailState("failed");
    }
  }

  async function requestEmailLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.normalize("NFKC").trim().toLowerCase();
    await sendSignInLink(normalizedEmail);
  }

  async function resendSignInLink() {
    if (resendCooldown > 0 || emailState === "pending" || !sentEmail) return;
    await sendSignInLink(sentEmail);
  }

  function useDifferentEmail() {
    setEmailState("idle");
    setSentEmail("");
    setResendCooldown(0);
    setEmail("");
  }

  const busy = googlePending || emailState === "pending";
  const titleWords = copy.title.split(" ");
  const titleTail = titleWords.pop();

  const showSentPanel = Boolean(sentEmail) && emailState !== "idle";

  if (showSentPanel) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-home-rule bg-home-card p-8 text-home-ink sm:p-10">
          {embedded ? (
            <h2 className="text-balance text-center font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.02em] text-home-ink sm:text-[38px]">
              Check your <Em>inbox</Em>
            </h2>
          ) : (
            <h1 className="text-balance text-center font-editorial text-[40px] font-normal leading-[1.05] tracking-[-0.02em] text-home-ink sm:text-[44px]">
              Check your <Em>inbox</Em>
            </h1>
          )}
          <p className="mt-3 text-center text-[15px] leading-[1.55] text-home-ink-2">
            We sent a sign-in link to{" "}
            <span className="font-medium text-home-ink break-all">
              {sentEmail}
            </span>
            . It comes from hello@switchtoux.com. Open it on this device.
          </p>

          <div
            id={statusId}
            aria-live="polite"
            className="mt-8 flex flex-col gap-3"
          >
            <button
              type="button"
              onClick={resendSignInLink}
              disabled={busy || resendCooldown > 0}
              className="flex h-[52px] w-full items-center justify-center rounded-full bg-home-ink px-4 text-base font-semibold text-home-d1 transition-colors hover:bg-home-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            >
              {emailState === "pending"
                ? "Sending…"
                : resendCooldown > 0
                  ? `Resend link (${resendCooldown}s)`
                  : "Resend link"}
            </button>
            <button
              type="button"
              onClick={useDifferentEmail}
              disabled={busy}
              className="flex h-[52px] w-full items-center justify-center rounded-full border border-home-ink bg-home-card px-4 text-base font-medium text-home-ink transition-colors hover:bg-home-ink hover:text-home-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
            >
              Use a different email
            </button>
          </div>

          {emailState === "failed" ? (
            <p role="alert" className="mt-4 text-center text-sm leading-6 text-destructive">
              {copy.emailFailed}
            </p>
          ) : null}

          <p className="mt-6 text-center text-sm leading-6 text-home-ink-3">
            Not there? Check Promotions or Spam.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <Logo className="h-4 w-28 text-home-ink-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-home-rule bg-home-card p-8 text-home-ink sm:p-10">
        {embedded ? (
          <h2 className="text-balance text-center font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.02em] text-home-ink sm:text-[38px]">
            {titleWords.join(" ")} <Em>{titleTail}</Em>
          </h2>
        ) : (
          <h1 className="text-balance text-center font-editorial text-[40px] font-normal leading-[1.05] tracking-[-0.02em] text-home-ink sm:text-[44px]">
            {titleWords.join(" ")} <Em>{titleTail}</Em>
          </h1>
        )}
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
          {emailState === "failed" ? (
            <p role="alert" className="mt-4 text-sm leading-6 text-destructive">
              {copy.emailFailed}
            </p>
          ) : null}
        </div>

        <p className="mt-8 text-center text-sm text-home-ink-2">
          {copy.crossPrompt}{" "}
          {embedded ? (
            <button
              type="button"
              onClick={() => {
                setCurrentMode(currentMode === "signup" ? "login" : "signup");
                setEmailState("idle");
              }}
              className="font-medium text-home-orange-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
            >
              {copy.crossLabel}
            </button>
          ) : (
            <Link
              href={withReturnTo(copy.crossHref, returnTo)}
              className="font-medium text-home-orange-ink underline underline-offset-4 transition-colors hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink motion-reduce:transition-none"
            >
              {copy.crossLabel}
            </Link>
          )}
        </p>
        {currentMode === "signup" ? (
          <p className="mt-5 text-center text-xs leading-5 text-home-ink-3">
            New accounts are added to the Weekend MVP newsletter. Beehiiv will
            ask you to confirm your email separately; account access starts when
            your site account is verified.{" "}
            <Link
              href="/privacy-policy#email-collection"
              className="underline underline-offset-2"
            >
              Privacy Policy
            </Link>
          </p>
        ) : null}
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
