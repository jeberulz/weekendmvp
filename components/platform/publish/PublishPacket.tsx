"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { slugFieldError, suggestedTenantSlug } from "@/components/platform/projects/cockpit";
import { PLATFORM_HOST_SUFFIX } from "@/lib/tenant-host";
import { SIGNED_IN_HREF } from "@/lib/signed-in-chrome";
import { PUBLISH_PACK_ID, publishPriceLabel } from "@/lib/signed-in-home";

type PacketFrame = "ready" | "hold" | "clash" | "closed";

function slugStorageKey(projectId: string) {
  return `signed-in:publish-slug:${projectId}`;
}

function checkoutKey(projectId: string) {
  return `signed-in:publish-checkout:${projectId}`;
}

export function PublishPacket({
  projectId,
  title,
  sourceSlug,
  publishable,
  paid,
}: {
  projectId: Id<"projects">;
  title: string;
  sourceSlug?: string;
  publishable: boolean;
  paid: boolean;
}) {
  const publishSite = useMutation(api.platform.sites.publish.publish);
  const slugInputId = useId();
  const [slug, setSlug] = useState(() => {
    if (typeof window === "undefined") {
      return suggestedTenantSlug(sourceSlug) || "";
    }
    try {
      return (
        window.sessionStorage.getItem(slugStorageKey(projectId)) ??
        suggestedTenantSlug(sourceSlug) ??
        ""
      );
    } catch {
      return suggestedTenantSlug(sourceSlug) || "";
    }
  });
  const [frame, setFrame] = useState<PacketFrame>(paid ? "hold" : "ready");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (!paid || !publishable || attempted.current) return;
    attempted.current = true;
    const nextSlug = slug.trim().toLowerCase();
    if (slugFieldError(nextSlug)) return;
    void (async () => {
      try {
        await publishSite({ projectId, slug: nextSlug });
        setFrame("closed");
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (text.includes("SITE_SLUG_UNAVAILABLE")) {
          setFrame("clash");
          setMessage("That address is not available. Pick another.");
          return;
        }
        setFrame("hold");
        setMessage("Paid. This site is not live yet.");
      }
    })();
  }, [paid, publishable, projectId, publishSite, slug]);

  const price = publishPriceLabel();
  const slugError = slugFieldError(slug);

  async function confirm() {
    if (slugError) {
      setMessage(slugError);
      return;
    }
    const nextSlug = slug.trim().toLowerCase();
    try {
      window.sessionStorage.setItem(slugStorageKey(projectId), nextSlug);
    } catch {
      // Continue; checkout still runs.
    }

    if (paid) {
      setBusy(true);
      setMessage("");
      try {
        await publishSite({ projectId, slug: nextSlug });
        setFrame("closed");
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (text.includes("SITE_SLUG_UNAVAILABLE")) {
          setFrame("clash");
          setMessage("That address is not available. Pick another.");
        } else {
          setFrame("hold");
          setMessage("Paid. This site is not live yet.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setMessage("");
    let idempotencyKey = "";
    try {
      idempotencyKey =
        window.sessionStorage.getItem(checkoutKey(projectId)) ?? "";
      if (!idempotencyKey) {
        idempotencyKey = `checkout:${crypto.randomUUID()}`;
        window.sessionStorage.setItem(checkoutKey(projectId), idempotencyKey);
      }
    } catch {
      idempotencyKey = `checkout:${crypto.randomUUID()}`;
    }

    try {
      const response = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packId: PUBLISH_PACK_ID,
          projectId,
          idempotencyKey,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; url?: string };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error("Checkout could not be started.");
      }
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") {
        throw new Error("Checkout returned an unexpected destination.");
      }
      window.location.assign(url.href);
    } catch {
      setMessage("Checkout is not available. Nothing was charged.");
      setBusy(false);
    }
  }

  return (
    <aside className="rounded-3xl border border-stone-900/10 bg-[#e8e4d9] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
        Publish
      </p>
      <p className="mt-2 text-sm font-semibold text-stone-950">{title}</p>
      {sourceSlug ? (
        <Link
          href={`/ideas/${sourceSlug}`}
          className="mt-2 inline-block text-sm text-stone-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
        >
          Read the research
        </Link>
      ) : null}

      {frame === "hold" ? (
        <p className="mt-4 text-sm leading-6 text-stone-700" role="status">
          {message || "Paid. This site is not live yet."}
        </p>
      ) : null}

      {frame === "clash" ? (
        <p className="mt-4 text-sm leading-6 text-stone-700" role="alert">
          {message}
        </p>
      ) : null}

      <div className="mt-4">
        <label htmlFor={slugInputId} className="block text-sm text-stone-700">
          Address
        </label>
        <div className="mt-1 flex min-h-11 items-center rounded-2xl border border-stone-900/15 bg-white px-3 font-mono text-sm">
          <input
            id={slugInputId}
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2 outline-none"
          />
          <span className="shrink-0 text-stone-500">{PLATFORM_HOST_SUFFIX}</span>
        </div>
      </div>

      <p className="mt-4 text-sm text-stone-700">
        {price} to take this live. One charge.
      </p>

      <button
        type="button"
        disabled={busy || !publishable || slugError !== null}
        onClick={() => void confirm()}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-[#f3f1eb] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-800"
      >
        {busy ? "Working…" : paid ? "Publish this address" : `Publish for ${price}`}
      </button>
      {message && frame === "ready" ? (
        <p className="mt-3 text-sm text-stone-700" role="alert">
          {message}
        </p>
      ) : null}
      <Link
        href={SIGNED_IN_HREF.library}
        className="mt-4 block text-sm text-stone-600 underline-offset-4 hover:underline"
      >
        Not this one? Browse the library
      </Link>
    </aside>
  );
}
