"use client";

import { useMutation } from "convex/react";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { takePendingSave, type PendingSave } from "@/lib/pending-save";
import { trackDashboardEvent } from "@/lib/track";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

/**
 * WP44-S6. Completes a save an anonymous reader started on `/ideas/{slug}`
 * before signing up (`lib/pending-save.ts`). Runs once per dashboard load,
 * inside `WhenConvexReady`, and says what happened with a link back.
 */
export function PendingSaveRunner() {
  const setSaved = useMutation(api.platform.dashboard.setSaved);
  const started = useRef(false);
  const [result, setResult] = useState<{ save: PendingSave; ok: boolean } | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let pending: PendingSave | null = null;
    try {
      pending = takePendingSave(window.localStorage, Date.now());
    } catch {
      pending = null;
    }
    if (pending === null) return;
    const save = pending;
    setSaved({ slug: save.slug, saved: true })
      .then(() => {
        setResult({ save, ok: true });
        trackDashboardEvent({
          name: "explore_state_changed",
          props: { flag: "saved", value: true, source: "idea_page" },
        });
      })
      .catch((error: unknown) => {
        console.error("Pending save failed", error);
        setResult({ save, ok: false });
      });
  }, [setSaved]);

  return (
    // Mounted empty first, so the message is announced when it arrives.
    <div aria-live="polite">
      {result && (
        <div className="mx-auto w-full max-w-[1200px] px-5 pt-6 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-home-rule bg-home-card py-2 pl-4 pr-2 text-sm text-home-ink">
            <p>
              {result.ok ? `Saved “${result.save.title}”. ` : `We couldn’t save “${result.save.title}”. `}
              <Link
                href={`/ideas/${result.save.slug}`}
                className={`font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink ${FOCUS}`}
              >
                {result.ok ? "Back to the idea" : "Open it and try again"}
              </Link>
            </p>
            <button
              type="button"
              onClick={() => setResult(null)}
              className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-home-ink-2 hover:bg-home-sunk hover:text-home-ink ${FOCUS}`}
            >
              <X aria-hidden className="size-4" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
