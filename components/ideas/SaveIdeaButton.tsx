"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { hasSessionHintCookie } from "@/lib/auth-session-cookie";
import { signupForPendingSave, stashPendingSave } from "@/lib/pending-save";
import { trackDashboardEvent } from "@/lib/track";
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
      <span className="text-sm text-neutral-500 max-sm:hidden">Free account. Keep a shortlist of ideas.</span>
    </>
  );
}

type SavedState = "loading" | "saved" | "unsaved" | "signed-out" | "hidden";

function SignedInSave({ slug, title }: { slug: string; title: string }) {
  const [state, setState] = useState<SavedState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/platform/saved?slug=${encodeURIComponent(slug)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: { signedIn: boolean; saved: boolean | null }) => {
        if (!data.signedIn) setState("signed-out");
        else if (data.saved === null) setState("hidden");
        else setState(data.saved ? "saved" : "unsaved");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("hidden");
      });
    return () => controller.abort();
  }, [slug]);

  if (state === "signed-out") return <SignUpToSave slug={slug} title={title} />;
  if (state === "hidden") return null;

  const pressed = state === "saved";
  async function toggle() {
    const next = !pressed;
    setState(next ? "saved" : "unsaved");
    try {
      const response = await fetch("/api/platform/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, saved: next }),
      });
      if (response.status === 401) {
        setState("signed-out");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      setMessage(next ? `Saved ${title}.` : `Removed ${title} from Saved.`);
      trackDashboardEvent({
        name: "explore_state_changed",
        props: { flag: "saved", value: next, source: "idea_page" },
      });
    } catch {
      setState(next ? "unsaved" : "saved");
      setMessage("Could not update Saved. Try again.");
    }
  }

  return (
    <>
      <button
        type="button"
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
      {pressed && (
        <Link
          href="/dashboard/saved"
          className={cn("text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-black", FOCUS)}
        >
          See your saved ideas
        </Link>
      )}
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}

/**
 * WP44-S6 Save island for `/ideas/{slug}`. Renders nothing on the server or
 * the first paint. After hydration: signed-in readers (per the readable
 * session hint) get the Save toggle, and everyone else gets a sign-up link
 * that completes the save once they are in.
 */
export function SaveIdeaButton({ slug, title }: { slug: string; title: string }) {
  const hint = useSyncExternalStore(subscribeToNothing, readHint, readServerHint);
  if (hint === null) return null;
  return hint === "in" ? <SignedInSave slug={slug} title={title} /> : <SignUpToSave slug={slug} title={title} />;
}
