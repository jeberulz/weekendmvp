"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { demoRunWorkerAction } from "@/app/admin/editorial/_actions/demo";
import { smallButtonClass } from "../workspace/ui";

/**
 * LOCAL DEMO ONLY. Stands in for the release worker (WP46-E6): while a
 * release is in flight and this page is open, each tick moves every
 * in-flight release one stage and refreshes the page data. It can be paused
 * or stepped by hand. Nothing is deployed.
 */
export function SimulatedWorkerTicker({ active, intervalMs = 2_500 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const step = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const result = await demoRunWorkerAction({}).catch(() => null);
    running.current = false;
    if (!result) {
      setError("The simulated worker could not reach the server.");
      return;
    }
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(null);
    if (result.value.advanced > 0) router.refresh();
  }, [router]);

  useEffect(() => {
    if (!active || !auto) return;
    const handle = window.setInterval(() => void step(), intervalMs);
    return () => window.clearInterval(handle);
  }, [active, auto, intervalMs, step]);

  if (!active) return null;
  return (
    <div
      role="group"
      aria-label="Simulated release worker"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-(--ed-demo) bg-(--ed-demo-bg) px-3 py-2 text-sm text-(--ed-demo)"
    >
      <p className="min-w-0 flex-1 basis-64">
        <strong className="font-semibold">Simulated release worker.</strong> In-flight releases move one stage every few seconds while
        this page is open. Nothing is deployed.
      </p>
      <label className="flex min-h-9 items-center gap-2">
        <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} className="size-4 accent-(--ed-demo)" />
        Advance automatically
      </label>
      <button type="button" className={smallButtonClass} onClick={() => void step()}>
        Advance one stage
      </button>
      {error ? (
        <p role="alert" className="basis-full text-(--ed-danger)">
          {error}
        </p>
      ) : null}
    </div>
  );
}
