"use client";

import { useState } from "react";
import Link from "next/link";
import { Lightbulb, X } from "lucide-react";
import { IdeaRequestPanel } from "./IdeaRequestPanel";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";

/**
 * Idea 4 — floating "Request an idea" widget. Bottom-right on the marketing
 * landing page (anonymous visitors) and on the signed-in dashboard, sharing
 * the same Convex backend (`convex/ideaRequests.ts`). The panel is
 * dismissible: closing it returns to the small floating button, which
 * reopens it. Renders nothing on the server — the mount point gates it
 * behind `WhenConvexReady`, so `useQuery` inside the panel never runs
 * before a Convex client exists.
 */
export function IdeaRequestWidget() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls="idea-request-panel"
        className={cn(
          "fixed bottom-4 right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-black px-4 text-sm font-medium text-white shadow-lg transition-colors hover:bg-neutral-800",
          FOCUS,
        )}
      >
        <Lightbulb aria-hidden className="size-4" />
        Request an idea
      </button>
    );
  }

  return (
    <section
      id="idea-request-panel"
      aria-label="Request a startup idea"
      className="fixed bottom-4 right-4 z-50 flex max-h-[75vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div>
          <h2 className="text-base font-medium text-neutral-900">Request an idea</h2>
          <p className="text-sm text-neutral-600">
            Tell us what to research next — vote for the ideas you want built.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close idea requests"
          className={cn(
            "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-black",
            FOCUS,
          )}
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="overflow-y-auto px-4 py-4">
        <IdeaRequestPanel limit={5} />
      </div>
      <div className="border-t border-neutral-100 px-4 py-3">
        <Link
          href="/ideas/requests"
          className={cn(
            "text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-black",
            FOCUS,
          )}
        >
          See all requests
        </Link>
      </div>
    </section>
  );
}
