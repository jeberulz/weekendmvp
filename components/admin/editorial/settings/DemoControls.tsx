"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  demoBumpPolicyAction,
  demoConfirmStrongAuthAction,
  demoExpireStrongAuthAction,
  demoFailNextDeployAction,
  demoLoseNextAckAction,
  demoResetAction,
  demoSetKillSwitchAction,
} from "@/app/admin/editorial/_actions/demo";
import type { CommandResult } from "@/lib/editorial/contracts/errors";
import { buttonClass } from "../common/primitives";
import { EditorialDialog } from "../common/EditorialDialog";
import { DialogClose } from "@/components/ui/dialog";
import { smallButtonClass } from "../workspace/ui";

type Control = { key: string; label: string; done: string; run(): Promise<CommandResult<unknown>> };

/**
 * LOCAL DEMO ONLY: flip the simulated adapter's situations so every
 * recovery path can be tried. None of these touches credentials, a
 * deployment or the public site.
 */
export function DemoControls({ strongAuthFresh, killSwitchEngaged }: { strongAuthFresh: boolean; killSwitchEngaged: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const run = async (control: Control) => {
    setBusy(control.key);
    setError(null);
    const result = await control.run().catch(() => null);
    setBusy(null);
    if (!result) {
      setError("The server could not be reached.");
      return false;
    }
    if (!result.ok) {
      setError(result.error.message);
      return false;
    }
    setStatus(control.done);
    router.refresh();
    return true;
  };

  const controls: Control[] = [
    strongAuthFresh
      ? { key: "expire", label: "Expire sign-in confirmation", done: "Sign-in confirmation expired.", run: () => demoExpireStrongAuthAction({}) }
      : { key: "confirm", label: "Confirm sign-in (simulated)", done: "Sign-in confirmed (simulated).", run: () => demoConfirmStrongAuthAction({}) },
    {
      key: "kill",
      label: killSwitchEngaged ? "Release the kill switch" : "Engage the kill switch",
      done: killSwitchEngaged ? "Kill switch released." : "Kill switch engaged: new activations are blocked.",
      run: () => demoSetKillSwitchAction({ engaged: !killSwitchEngaged }),
    },
    { key: "fail", label: "Make the next deployment fail", done: "The next deployment will fail.", run: () => demoFailNextDeployAction({}) },
    {
      key: "ack",
      label: "Lose the next activation acknowledgement",
      done: "The next activation will be uncertain and need reconciliation.",
      run: () => demoLoseNextAckAction({}),
    },
    {
      key: "policy",
      label: "Publish a new quality policy version",
      done: "Policy version bumped: checks are out of date and approvals under the old policy lapse.",
      run: () => demoBumpPolicyAction({}),
    },
  ];

  return (
    <section aria-labelledby="demo-controls" className="flex flex-col gap-3 rounded-lg border border-(--ed-demo) bg-(--ed-surface) p-4">
      <h2 id="demo-controls" className="text-base font-semibold">
        Demo controls
      </h2>
      <p className="text-sm text-(--ed-text-2)">
        Local demo only. Each control flips a flag in the simulated adapter so a situation can be tried; none touches credentials, a
        deployment or the public site.
      </p>
      <div className="flex flex-wrap gap-2">
        {controls.map((control) => (
          <button key={control.key} type="button" className={smallButtonClass} disabled={busy !== null} onClick={() => void run(control)}>
            {busy === control.key ? "Working…" : control.label}
          </button>
        ))}
        <EditorialDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Reset the demo?"
          description="Every demo change is thrown away and the fictional data is seeded again."
          trigger={
            <button type="button" className={smallButtonClass} disabled={busy !== null}>
              Reset the demo…
            </button>
          }
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <button type="button" className={buttonClass.secondary}>
                Keep the demo
              </button>
            </DialogClose>
            <button
              type="button"
              className={buttonClass.danger}
              disabled={busy !== null}
              onClick={async () => {
                if (await run({ key: "reset", label: "Reset", done: "Demo reset.", run: () => demoResetAction({}) })) setResetOpen(false);
              }}
            >
              Reset the demo
            </button>
          </div>
        </EditorialDialog>
      </div>
      <p aria-live="polite" className="text-sm">
        {status}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-(--ed-danger)">
          {error}
        </p>
      ) : null}
    </section>
  );
}
