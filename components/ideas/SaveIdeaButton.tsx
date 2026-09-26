"use client";

import { Bookmark, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { startPlanHref } from "@/components/platform/builds/plan-links";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";
import { signupForPendingSave, stashPendingSave } from "@/lib/pending-save";
import { trackDashboardEvent } from "@/lib/track";
import { createSaveQueue } from "@/components/platform/save-queue";
import { createVersionedSave } from "@/components/platform/versioned-save";
import { cn } from "@/lib/utils";

// `document.cookie` has no change event. The server snapshot is null, so the
// server HTML and the first paint carry no Save control at all: the page
// stays static and identical for every reader and crawler.
function subscribeToNothing() {
  return () => {};
}
function readHint(): "in" | "out" {
  return hasSessionHintCookie(document.cookie) ? "in" : "out";
}
function readServerHint() {
  return null;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
const BUTTON = cn(
  "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
  FOCUS,
);

function SignUpToSave({ slug, title }: { slug: string; title: string }) {
  return (
    <>
      <Link
        href={signupForPendingSave()}
        onClick={() => {
          try {
            stashPendingSave(window.localStorage, { slug, title, at: Date.now() });
          } catch {
            // Storage blocked: sign-up still works, the reader saves by hand.
          }
        }}
        className={cn(BUTTON, "border-neutral-300 bg-white text-black hover:border-neutral-500")}
      >
        <Bookmark aria-hidden className="size-4" strokeWidth={1.8} />
        Save idea
      </Link>
      {/* One line on phones, so the reserved slot height holds. */}
      <span className="text-sm text-neutral-600">Free account required.</span>
    </>
  );
}

type SavedState = "loading" | "saved" | "unsaved" | "signed-out" | "hidden";

function SignedInSave({ slug, title }: { slug: string; title: string }) {
  const [state, setState] = useState<SavedState>("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const queue = useRef<ReturnType<typeof createSaveQueue> | null>(null);
  const saveButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/platform/saved?slug=${encodeURIComponent(slug)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: { signedIn: boolean; saved: boolean | null; version: number }) => {
        if (!data.signedIn) setState("signed-out");
        else if (data.saved === null) setState("hidden");
        else {
          setState(data.saved ? "saved" : "unsaved");
          queue.current = createSaveQueue({
            initial: data.saved,
            ...createVersionedSave(slug, data.version),
            changed: (saved, busy) => {
              setState(saved ? "saved" : "unsaved");
              setPending(busy);
              if (busy) { setError(""); setMessage(""); }
            },
            settled: (saved) => {
              setMessage(saved ? `Saved ${title}.` : `Removed ${title} from Saved.`);
              trackDashboardEvent({ name: "explore_state_changed", props: { flag: "saved", value: saved, source: "idea_page" } });
            },
            failed: (cause) => {
              setError(cause instanceof Error && cause.message === "signed-out"
                ? "Your session ended. Sign in again to save this idea."
                : "Could not confirm your change to Saved. Retry your last choice.");
            },
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState("hidden");
          setError("Saved is unavailable. Reload this page to try again.");
        }
      });
    return () => { controller.abort(); queue.current?.dispose(); };
  }, [slug, title]);

  if (state === "signed-out") return <SignUpToSave slug={slug} title={title} />;
  if (state === "hidden") return error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null;

  const pressed = state === "saved";
  function toggle() { queue.current?.toggle(); }

  return (
    <>
      <button
        type="button"
        ref={saveButton}
        aria-pressed={pressed}
        disabled={state === "loading"}
        onClick={toggle}
        className={cn(
          BUTTON,
          "disabled:cursor-default disabled:opacity-60",
          pressed
            ? "border-black bg-black text-white"
            : "border-neutral-300 bg-white text-black hover:border-neutral-500",
        )}
      >
        <Bookmark
          aria-hidden
          className="size-4"
          strokeWidth={1.8}
          fill={pressed ? "currentColor" : "none"}
        />
        Save<span className="sr-only"> {title}</span>
      </button>
      {/* WP44-S9: the start page handles the one-plan limit. */}
      <Link
        href={startPlanHref(slug, "idea_page")}
        className={cn(BUTTON, "border-neutral-300 bg-white text-black hover:border-neutral-500")}
      >
        <CalendarDays aria-hidden className="size-4" strokeWidth={1.8} />
        Plan my weekend<span className="sr-only"> for {title}</span>
      </Link>
      {pressed && (
        <Link
          href="/dashboard/saved"
          className={cn("text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-black", FOCUS)}
        >
          See your saved ideas
        </Link>
      )}
      <span role="status" className="text-sm text-neutral-600">{error || (pending ? "Saving…" : message)}</span>
      {error && !error.includes("Sign in") && <button type="button" disabled={pending} onClick={() => { saveButton.current?.focus(); queue.current?.retry(); }} className="min-h-11 px-2 text-sm underline">Retry save</button>}
      {error.includes("Sign in") && <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-sm underline">Sign in</Link>}
    </>
  );
}

/**
 * WP44-S6 Save island for `/ideas/{slug}`. Renders nothing on the server or
 * the first paint. After hydration: signed-in readers (per the readable
 * session hint) get the Save toggle and "Plan my weekend" (S9), and everyone
 * else gets a sign-up link that completes the save once they are in.
 */
export function SaveIdeaButton({ slug, title }: { slug: string; title: string }) {
  const hint = useSyncExternalStore(subscribeToNothing, readHint, readServerHint);
  if (hint === null) return null;
  return hint === "in" ? <SignedInSave slug={slug} title={title} /> : <SignUpToSave slug={slug} title={title} />;
}
