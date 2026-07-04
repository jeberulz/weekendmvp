"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";

/**
 * Per-idea content upgrade: the 48-Hour Validation Checklist
 * (/validation-checklist), offered at the bottom of every idea page.
 * Subscribing routes through /api/subscribe with the allowlisted
 * `validation-checklist` campaign; success reveals the checklist link.
 * Cream theme to match the idea-page chrome.
 */

type Status = "idle" | "loading" | "success" | "error";

export function ChecklistCta({ ideaTitle }: { ideaTitle: string }) {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          utm_campaign: "validation-checklist",
          utm_source: "idea-page",
          utm_medium: "website",
        }),
      });
      if (!res.ok) throw new Error("Subscribe failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-12 p-8 bg-neutral-100 border border-neutral-200 rounded-3xl">
      <div className="flex items-center gap-3 mb-3">
        <ClipboardCheck
          size={20}
          className="text-neutral-500"
          aria-hidden="true"
        />
        <h2 className="text-xl font-medium text-black tracking-tight">
          Validate this idea before you build it
        </h2>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed mb-6">
        Get the free 48-Hour Validation Checklist — 17 checks to confirm
        there&apos;s real demand for {ideaTitle} before you spend a weekend
        building it. We&apos;ll email it to you along with a researched idea
        every morning.
      </p>

      {status === "success" ? (
        <p className="text-sm text-neutral-800" role="status">
          Check your inbox — the checklist is on its way. You can also{" "}
          <Link
            href="/validation-checklist"
            className="font-medium underline underline-offset-4 hover:text-black"
          >
            read it right now
          </Link>
          .
        </p>
      ) : (
        <>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3"
            noValidate
          >
            <label htmlFor="checklist-email" className="sr-only">
              Email address
            </label>
            <input
              type="email"
              id="checklist-email"
              name="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              className="flex-1 bg-white border border-neutral-200 rounded-full px-5 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/30 transition-all"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-full text-sm font-semibold hover:bg-neutral-800 transition-all focus:outline-none focus:ring-2 focus:ring-black/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>
                {status === "loading" ? "Sending…" : "Email me the checklist"}
              </span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </form>
          <p
            className="mt-3 text-xs text-neutral-500"
            role="status"
            aria-live="polite"
          >
            {status === "error"
              ? "Please enter a valid email and try again."
              : "Free · No spam · Unsubscribe anytime"}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Prefer to read it here?{" "}
            <Link
              href="/validation-checklist"
              className="underline underline-offset-4 hover:text-neutral-600"
            >
              View the checklist
            </Link>
            <ArrowRight size={10} className="inline ml-1" aria-hidden="true" />
          </p>
        </>
      )}
    </div>
  );
}
