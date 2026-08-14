"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PreviewCustomisation } from "@/convex/platform/preview/customisation";
import { trackEvent } from "@/lib/track";

const FALLBACK_TEMPLATE = "editorial";

type Status =
  | { kind: "minting" }
  | { kind: "error"; message: string };

export function MintPreviewRedirect({
  slug,
  customisation,
}: {
  slug: string;
  customisation: PreviewCustomisation;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "minting" });

  useEffect(() => {
    let cancelled = false;

    async function mint() {
      setStatus({ kind: "minting" });
      trackEvent("preview_started", { template: FALLBACK_TEMPLATE });
      try {
        const response = await fetch("/api/platform/preview/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            templateId: FALLBACK_TEMPLATE,
            customisation,
          }),
        });
        const body = (await response.json()) as {
          ok?: boolean;
          token?: string;
        };
        if (cancelled) return;
        if (!response.ok || !body.ok || typeof body.token !== "string") {
          setStatus({
            kind: "error",
            message:
              response.status === 429
                ? "Too many previews just now. Wait a moment and try again."
                : "We could not open that preview. Try again.",
          });
          return;
        }
        trackEvent("preview_generated", { template: FALLBACK_TEMPLATE });
        router.replace(`/preview/${body.token}`);
      } catch {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: "We could not open that preview. Try again.",
          });
        }
      }
    }

    void mint();
    return () => {
      cancelled = true;
    };
  }, [attempt, customisation, router, slug]);

  if (status.kind === "error") {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center text-stone-800">
        <p>{status.message}</p>
        <button
          type="button"
          className="mt-6 min-h-11 rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-[#f3f1eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <p className="px-5 py-16 text-center text-stone-600" aria-live="polite">
      Opening the preview…
    </p>
  );
}
