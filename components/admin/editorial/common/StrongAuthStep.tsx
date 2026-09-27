"use client";

import { useState } from "react";

import { demoConfirmStrongAuthAction } from "@/app/admin/editorial/_actions/demo";
import { smallButtonClass } from "../workspace/ui";

/** True when a refusal means "confirm your sign-in first". */
export function isReauthMessage(message: string | null): boolean {
  return message !== null && /strong authentication|confirm it['’]s you/i.test(message);
}

export type StrongAuthContext = { fresh: boolean; mechanism: string };

/**
 * The recent sign-in confirmation that publishing, retrying, rolling back,
 * unpublishing and trashing need. In the local demo it is SIMULATED: no
 * password, code or credential is ever asked for. The real step-up
 * mechanism arrives with the live adapter (WP46-E4).
 */
export function StrongAuthStep({
  fresh,
  mechanism,
  onConfirmed,
}: {
  fresh: boolean;
  mechanism: string;
  onConfirmed(): void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div role="group" aria-label="Recent sign-in confirmation" className="flex flex-col gap-2 rounded-md border border-(--ed-border) px-3 py-2 text-sm">
      <p className="font-medium">Recent sign-in confirmation</p>
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
    </div>
  );
}
