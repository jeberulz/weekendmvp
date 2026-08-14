"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { trackEvent } from "@/lib/track";

/**
 * WP27-S5. Carries a preview capability across the sign-in boundary.
 *
 * The token is held in `sessionStorage`, not in the sign-in URL's `returnTo`
 * and not in any server state. Two reasons:
 *
 * 1. `sessionStorage` is same-origin, per-tab, and never transmitted, so the
 *    capability does not end up in a magic-link email, a server access log,
 *    or a `Referer`. It is already in the visitor's address bar on
 *    `/preview/{token}`; this adds no new place for it to leak to.
 * 2. It degrades safely. If the magic link opens in a different browser the
 *    stash is simply absent, nothing is claimed, and the capability stays
 *    valid for its remaining lifetime — the visitor can reopen the preview
 *    link while signed in and claim from there. Losing a claim is a
 *    recoverable inconvenience; leaking a capability is not.
 *
 * Neither component here is the authorization boundary. `platform.preview.
 * claim.claim` derives identity server-side and is exactly-once on its own,
 * so the worst a tampered stash can do is ask to claim a token the caller
 * already possesses.
 */

const STASH_KEY = "wp27:claimPreview";

/**
 * Rendered on `/signin`. Records the capability so the post-authentication
 * landing can claim it. Renders nothing.
 */
export function PreviewClaimStash({ token }: { token: string }) {
  useEffect(() => {
    try {
      window.sessionStorage.setItem(STASH_KEY, token);
    } catch {
      // Private-mode or storage-disabled browsers: the claim simply does not
      // happen automatically. Never a hard failure on the sign-in path.
    }
  }, [token]);

  return null;
}

/**
 * There is deliberately no interim "claiming" state. Setting one would mean
 * calling `setState` synchronously inside the effect, which cascades an extra
 * render pass; deriving it from storage during render instead would read
 * `sessionStorage` on the server and mismatch on hydration. Every transition
 * below therefore happens after an `await`, and the dashboard renders
 * normally while the single mutation is in flight.
 */
type Status = "idle" | "claimed" | "failed";

/**
 * Rendered on the dashboard. Claims a stashed capability exactly once per
 * mount and announces the result.
 */
export function PreviewClaimRunner() {
  const claim = useMutation(api.platform.preview.claim.claim);
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    // Guards React's development double-invoke of effects. Claiming twice
    // would be harmless — the mutation is idempotent — but it would emit two
    // analytics events for one conversion.
    if (started.current) return;
    started.current = true;

    let token: string | null = null;
    try {
      token = window.sessionStorage.getItem(STASH_KEY);
    } catch {
      return;
    }
    if (!token) return;

    void (async () => {
      try {
        const graph = await claim({ token });
        // Cleared only after the server confirmed. Clearing first would lose
        // the capability on a transient network failure.
        window.sessionStorage.removeItem(STASH_KEY);
        setStatus("claimed");
        // Server-confirmed only, and `project_created` fires solely on a real
        // creation — a replayed claim must not inflate the funnel.
        trackEvent("signup_completed", { source: "preview" });
        if (graph.created) {
          trackEvent("project_created", { source: "preview" });
        }
        router.refresh();
      } catch {
        // An expired, unknown, or already-claimed-by-someone-else capability
        // all arrive here identically, which is the server's design. The
        // stash is dropped so the dashboard does not retry on every visit.
        try {
          window.sessionStorage.removeItem(STASH_KEY);
        } catch {
          // Nothing further to do; the message below still explains it.
        }
        setStatus("failed");
      }
    })();
  }, [claim, router]);

  return (
    // The live region is always mounted, even while idle, and only its
    // contents change. A region inserted together with its text is usually
    // not announced at all — assistive technology has to be observing the
    // node before the change happens. Polite rather than assertive: this
    // narrates a background step and must not interrupt what is being read.
    <div aria-live="polite">
      {status !== "idle" && (
        <div className="mb-6 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
          {status === "claimed" && "Your preview is saved to this workspace."}
          {status === "failed" &&
            "That preview link could not be added. Preview links are private and last seven days."}
        </div>
      )}
    </div>
  );
}
