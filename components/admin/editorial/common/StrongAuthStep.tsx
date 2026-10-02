"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { demoConfirmStrongAuthAction } from "@/app/admin/editorial/_actions/demo";
import { authCallbackTarget } from "@/lib/auth-return";
import { smallButtonClass } from "../workspace/ui";
import { useStepUp, type StepUp } from "./StepUpContext";

/** True when a refusal means "confirm your sign-in first". */
export function isReauthMessage(message: string | null): boolean {
  return message !== null && /strong authentication|confirm it['’]s you/i.test(message);
}

export type StrongAuthContext = { fresh: boolean; mechanism: string };

type StepProps = { fresh: boolean; mechanism: string; onConfirmed(): void };

/**
 * The recent sign-in confirmation that publishing, retrying, rolling back,
 * unpublishing and trashing need. In the live workspace it is a fresh sign-in
 * with the account's own method (WP46-E4e); in the local demo it is
 * SIMULATED. Neither ever asks for a password or code here.
 */
export function StrongAuthStep(props: StepProps) {
  const stepUp = useStepUp();
  return stepUp ? <LiveStrongAuthStep {...props} stepUp={stepUp} /> : <SimulatedStrongAuthStep {...props} />;
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div role="group" aria-label="Recent sign-in confirmation" className="flex flex-col gap-2 rounded-md border border-(--ed-border) px-3 py-2 text-sm">
      <p className="font-medium">Recent sign-in confirmation</p>
      {children}
    </div>
  );
}

/**
 * Where the sign-in comes back to. A Google return target stays inside the
 * auth backend, so it keeps the page as it is now. An email link sits in a
 * mailbox and passes through the mail provider, so it carries the page only,
 * without revision ids or view state.
 */
export function stepUpReturnTarget(method: "google" | "email", location: Pick<Location, "pathname" | "search">): string {
  return method === "google" ? `${location.pathname}${location.search}` : location.pathname;
}

function LiveStrongAuthStep({ fresh, mechanism, stepUp, onConfirmed }: StepProps & { stepUp: StepUp }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "starting" | "sent" | "failed">("idle");
  const [checking, startCheck] = useTransition();

  if (fresh) {
    return (
      <Frame>
        <p className="text-(--ed-success)">Confirmed within the last 10 minutes.</p>
      </Frame>
    );
  }

  const startSignIn = async () => {
    if (phase === "starting") return;
    setPhase("starting");
    try {
      if (stepUp.method === "google") {
        // Leaves the page for Google and comes back through the callback.
        await signIn("google", { redirectTo: authCallbackTarget(stepUpReturnTarget("google", window.location)) });
      } else if (stepUp.method === "email" && stepUp.email) {
        await signIn("email", { email: stepUp.email, redirectTo: stepUpReturnTarget("email", window.location) });
        setPhase("sent");
      }
    } catch {
      setPhase("failed");
    }
  };

  const checkAgain = () =>
    startCheck(() => {
      router.refresh();
      onConfirmed();
    });

  return (
    <Frame>
      <p className="text-(--ed-text-2)">
        This action needs you to have signed in within the last 10 minutes. Sign in again with this account to confirm it’s you.
      </p>
      <p className="text-xs text-(--ed-text-2)">{mechanism}</p>
      {stepUp.method === "google" ? (
        <button
          type="button"
          className={`${smallButtonClass} self-start`}
          aria-disabled={phase === "starting" || undefined}
          onClick={() => void startSignIn()}
        >
          {phase === "starting" ? "Opening Google…" : "Sign in again with Google"}
        </button>
      ) : stepUp.method === "email" && stepUp.email ? (
        phase === "sent" ? (
          <>
            <p role="status" className="text-(--ed-text)">
              We sent a sign-in link to {stepUp.email}. Open it in this browser, then come back here.
            </p>
            <button
              type="button"
              className={`${smallButtonClass} self-start`}
              aria-disabled={checking || undefined}
              onClick={() => {
                if (!checking) checkAgain();
              }}
            >
              {checking ? "Checking…" : "I’ve signed in again"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${smallButtonClass} self-start`}
            aria-disabled={phase === "starting" || undefined}
            onClick={() => void startSignIn()}
          >
            {phase === "starting" ? "Sending…" : "Email me a sign-in link"}
          </button>
        )
      ) : (
        <p className="text-(--ed-text-2)">Sign out, sign in again with this account, then come back to this page.</p>
      )}
      {phase === "failed" ? (
        <p role="alert" className="text-(--ed-danger)">
          The sign-in could not be started. Try again.
        </p>
      ) : null}
    </Frame>
  );
}

function SimulatedStrongAuthStep({ fresh, mechanism, onConfirmed }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Frame>
      {fresh ? (
        <p className="text-(--ed-success)">Confirmed within the last 10 minutes.</p>
      ) : (
        <>
          <p className="text-(--ed-text-2)">
            This action needs a sign-in confirmation from the last 10 minutes. The local demo simulates it; no password or code is asked
            for.
          </p>
          <p className="text-xs text-(--ed-text-2)">{mechanism}</p>
          <button
            type="button"
            className={`${smallButtonClass} self-start`}
            aria-disabled={busy || undefined}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              const result = await demoConfirmStrongAuthAction({}).catch(() => null);
              setBusy(false);
              if (!result) setError("The server could not be reached.");
              else if (!result.ok) setError(result.error.message);
              else {
                setError(null);
                onConfirmed();
              }
            }}
          >
            {busy ? "Confirming…" : "Confirm it’s me (simulated)"}
          </button>
          {error ? (
            <p role="alert" className="text-(--ed-danger)">
              {error}
            </p>
          ) : null}
        </>
      )}
    </Frame>
  );
}
