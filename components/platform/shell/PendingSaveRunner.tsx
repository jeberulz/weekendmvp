"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { readPendingSave, persistPendingSave, dismissPendingSave, PENDING_SAVE_MAX_ATTEMPTS, type PendingSave } from "@/lib/pending-save";
import { trackDashboardEvent } from "@/lib/track";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

/**
 * WP44-S6. Completes a save an anonymous reader started on `/ideas/{slug}`
 * before signing up (`lib/pending-save.ts`). Runs once per dashboard load,
 * inside `WhenConvexReady`, and says what happened with a link back.
 */
export function PendingSaveRunner() {
  const setSaved = useMutation(api.platform.dashboard.setSaved);
  const { isAuthenticated } = useConvexAuth();
  const started = useRef(false);
  // Mounted behind WhenConvexReady, so this storage snapshot is browser-only.
  const [initialSave] = useState(() => {
    try { return readPendingSave(window.localStorage, Date.now()); } catch { return null; }
  });
  const [result, setResult] = useState<{ save: PendingSave; ok: boolean; replaced?: boolean } | null>(() =>
    initialSave && (initialSave.attempts ?? 0) >= PENDING_SAVE_MAX_ATTEMPTS ? { save: initialSave, ok: false } : null,
  );

  const [pending, setPending] = useState(false);
  const [dismissError, setDismissError] = useState("");
  const inFlight = useRef(false);
  const retryButton = useRef<HTMLButtonElement>(null);
  const ideaLink = useRef<HTMLAnchorElement>(null);

  function savePending(save: PendingSave) {
    if (inFlight.current || !isAuthenticated) return;
    inFlight.current = true;
    // The promise also turns blocked-storage exceptions into the same retry UI.
    void Promise.resolve().then(() => persistPendingSave(window.localStorage, save, Date.now(),
      (slug) => setSaved({ slug, saved: true })))
      .then((outcome) => {
        if (document.activeElement === retryButton.current) ideaLink.current?.focus();
        if (outcome === "replaced") { setResult({ save, ok: false, replaced: true }); return; }
        setResult({ save, ok: true });
        trackDashboardEvent({ name: "explore_state_changed", props: { flag: "saved", value: true, source: "idea_page" } });
      })
      .catch(() => setResult({ save, ok: false }))
      .finally(() => { inFlight.current = false; setPending(false); });
  }

  useEffect(() => {
    if (started.current || !isAuthenticated) return;
    started.current = true;
    const save = initialSave;
    if (!save || (save.attempts ?? 0) >= PENDING_SAVE_MAX_ATTEMPTS) return;
    // Only the first attempt is automatic, so a later account cannot silently inherit it. Manual
    // retry is explicit; the durable intent is acknowledged only on success.
    void savePending(save);
    // The initial intent is consumed once, independently of mutation identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSaved, initialSave, isAuthenticated]);

  return (
    // Mounted empty first, so the message is announced when it arrives.
    <div aria-live="polite">
      {result && (
        <div className="mx-auto w-full max-w-[1200px] px-5 pt-6 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-home-rule bg-home-card py-2 pl-4 pr-2 text-sm text-home-ink">
            <p className="min-w-0 flex-1 break-words">
              {result.replaced ? `The pending save for “${result.save.title}” changed in another tab. This request was not sent; any newer request is kept. `
                : result.ok ? `Saved “${result.save.title}”. ` : `We couldn’t save “${result.save.title}”. `}
              <Link
                ref={ideaLink}
                href={`/ideas/${result.save.slug}`}
                className={`font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink ${FOCUS}`}
              >
                {result.ok || result.replaced ? "Back to the idea" : "Open it and try again"}
              </Link>
            </p>
            {!result.ok && !result.replaced && <button ref={retryButton} type="button" aria-disabled={pending || !isAuthenticated} aria-busy={pending} onClick={() => { if (!pending && isAuthenticated) { setPending(true); void savePending(result.save); } }}
              className={`min-h-11 rounded px-3 text-sm font-medium text-home-orange-ink ${FOCUS}`}>
              {pending ? "Saving…" : "Save to this account"}
            </button>}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                try {
                  dismissPendingSave(window.localStorage, result.save, Date.now());
                  document.getElementById("workspace-main")?.focus();
                  setResult(null); setDismissError("");
                } catch { setDismissError("This browser could not dismiss the saved request. Try again."); }
              }}
              className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-home-ink-2 hover:bg-home-sunk hover:text-home-ink ${FOCUS}`}
            >
              <X aria-hidden className="size-4" />
              <span className="sr-only">Dismiss</span>
            </button>
            {dismissError && <p role="alert" className="basis-full text-home-clay-ink">{dismissError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
