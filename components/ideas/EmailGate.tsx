"use client";

/**
 * Email gate for idea pages — a verbatim port of the ideas/gate.js state
 * machine into a single client component.
 *
 * R4 (CLAUDE.md / migration plan): the idea body is SERVER-RENDERED VISIBLE
 * BY DEFAULT so AI crawlers (no JS) always see full content. This component
 * wraps the server-rendered children and, ONLY after hydration, applies a
 * client-side overlay when the localStorage probe says "not subscribed".
 * The body is never conditionally rendered — when locked it stays in the
 * DOM under a blur/clip applied via a data attribute. A brief flash of
 * content before the lock resolves is accepted by design (SEO over polish).
 *
 * Access resolution order (gate.js `resolveAccess`, + explicit localhost
 * bypass):
 *   1. localStorage 'ideas_email' present            → unlocked
 *   2. ?e=<email> → POST /api/ideas-verify, ok       → store + unlock
 *      (the ?e param is stripped via history.replaceState either way)
 *   3. ?utm_source=beehiiv                           → store '__newsletter__' + unlock
 *   4. hostname localhost / 127.0.0.1                → unlocked (dev bypass)
 *   5. otherwise                                     → locked (overlay + form)
 * Form submit → POST /api/ideas-subscribe → store email + unlock.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { trackEvent } from "@/lib/track";

const STORAGE_KEY = "ideas_email";
const NEWSLETTER_PLACEHOLDER = "__newsletter__";

type GateState = "checking" | "locked" | "unlocked";

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isLocalhost(): boolean {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

/** Remove a query param without reloading (gate.js stripParam). */
function stripParam(paramName: string) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(paramName)) return;
    url.searchParams.delete(paramName);
    const newSearch = url.searchParams.toString();
    const newUrl =
      url.pathname + (newSearch ? "?" + newSearch : "") + url.hash;
    window.history.replaceState({}, "", newUrl);
  } catch {
    /* ignore */
  }
}

/** gate.js verifyEmailWithBeehiiv: localhost is trusted, else /api/ideas-verify. */
async function verifyEmailWithBeehiiv(email: string): Promise<boolean> {
  if (isLocalhost()) return true;
  try {
    const res = await fetch("/api/ideas-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data?.ok === true;
  } catch {
    return false;
  }
}

async function resolveAccess(): Promise<boolean> {
  // 1. Already unlocked on this device.
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return true;

  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("e");
  const isBeehiivClick = params.get("utm_source") === "beehiiv";

  // 2. Newsletter deep link with ?e=<email> — verify against Beehiiv.
  if (emailParam && isValidEmail(emailParam)) {
    const ok = await verifyEmailWithBeehiiv(emailParam);
    stripParam("e");
    if (ok) {
      localStorage.setItem(STORAGE_KEY, emailParam);
      return true;
    }
  }

  // 3. Trusted Beehiiv click without the email param.
  if (isBeehiivClick) {
    localStorage.setItem(STORAGE_KEY, NEWSLETTER_PLACEHOLDER);
    return true;
  }

  // 4. Local development bypass.
  if (isLocalhost()) return true;

  // 5. Locked.
  return false;
}

export function EmailGate({
  slug,
  title,
  description,
  children,
}: {
  slug: string;
  title: string;
  description: string;
  /** Server-rendered idea content — always present in the HTML. */
  children: React.ReactNode;
}) {
  // Server render + first client render are "checking": content visible,
  // no overlay in the HTML (R4).
  const [state, setState] = React.useState<GateState>("checking");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    resolveAccess().then((hasAccess) => {
      if (!cancelled) setState(hasAccess ? "unlocked" : "locked");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = (
      form.elements.namedItem("email") as HTMLInputElement | null
    )?.value;
    const firstName =
      (form.elements.namedItem("first_name") as HTMLInputElement | null)
        ?.value ?? "";
    if (!isValidEmail(email)) return;

    setSubmitting(true);
    setError(null);
    try {
      if (!isLocalhost()) {
        const response = await fetch("/api/ideas-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, first_name: firstName }),
        });
        const data = (await response
          .json()
          .catch(() => ({}))) as { success?: boolean; error?: string };
        if (!response.ok && !data.success) {
          throw new Error(data.error || "Failed to subscribe");
        }
      }

      localStorage.setItem(STORAGE_KEY, email);
      trackEvent("signup_form_success", {
        form_id: "ideas_gate",
        idea_slug: slug,
      });
      setState("unlocked");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Subscription error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const locked = state === "locked";

  return (
    <div className="relative">
      {/* Idea content: server-rendered, never conditionally removed. When
          locked, a data attribute drives a CSS blur + clip on this sibling
          wrapper — the gate overlay sits on top. */}
      <div
        data-gate-content
        data-locked={locked ? "" : undefined}
        aria-hidden={locked ? true : undefined}
        className="data-locked:blur-sm data-locked:pointer-events-none data-locked:select-none data-locked:max-h-svh data-locked:overflow-hidden"
      >
        {children}
      </div>

      {locked ? (
        <section
          id="email-gate"
          className="absolute inset-0 z-30 flex items-start justify-center px-6 bg-gradient-to-b from-[#fcfaf7]/75 via-[#fcfaf7]/95 to-[#fcfaf7]"
        >
          <div className="text-center max-w-2xl mx-auto min-h-svh flex flex-col items-center justify-center pt-[7.5rem] pb-16">
            <Link
              href="/startup-ideas"
              className="inline-flex items-center gap-2 text-neutral-500 text-sm mb-8 hover:text-black transition-colors"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              All Startup Ideas
            </Link>

            <h2 className="text-3xl md:text-5xl font-medium text-black tracking-tight leading-[1.1] mb-4">
              {title}
            </h2>

            <p className="text-lg text-neutral-500 font-light tracking-tight max-w-xl mx-auto leading-relaxed mb-10">
              {description}
            </p>

            {/* Email Form (legacy #ideas-email-form markup) */}
            <div className="max-w-md mx-auto w-full">
              <form
                id="ideas-email-form"
                className="space-y-4"
                onSubmit={handleSubmit}
              >
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    id="gate-first-name"
                    name="first_name"
                    required
                    placeholder="Your first name"
                    aria-label="First name"
                    className="bg-white border border-neutral-200 rounded-xl px-4 py-3.5 text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/30 transition-all text-sm"
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      id="gate-email"
                      name="email"
                      required
                      placeholder="Your email address"
                      aria-label="Email address"
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-3.5 text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/30 transition-all text-sm"
                    />
                    <button
                      type="submit"
                      id="gate-submit-btn"
                      disabled={submitting}
                      className="group relative inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-all whitespace-nowrap disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-black/30"
                    >
                      {submitting ? (
                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                            aria-hidden="true"
                          />
                          <span>Unlocking...</span>
                        </>
                      ) : (
                        <>
                          <span>Unlock Idea</span>
                          <ArrowRight size={16} aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {error ? (
                  <p className="text-xs text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}
                <p className="text-xs text-neutral-400">
                  Free access. No spam.
                </p>
              </form>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
