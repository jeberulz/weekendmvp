"use client";

/**
 * Email gate for /startup-ideas — port of the legacy startup-ideas.html
 * #email-gate / #ideas-content swap driven by ideas/gate.js.
 *
 * SEO contract (same as legacy): the ideas content (children) is
 * SERVER-RENDERED VISIBLE BY DEFAULT so crawlers always see every idea card
 * in the raw HTML; the gate hero only exists client-side after hydration
 * decides the visitor is not subscribed. When locked, the content wrapper
 * gets the `hidden` class — exactly how gate.js toggled the two sections.
 *
 * Access resolution + subscribe flow live in components/ideas/gate-access.ts
 * (shared with the idea-page EmailGate).
 */

import * as React from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Code,
  Loader2,
  Rocket,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { trackEvent } from "@/lib/track";
import {
  isValidEmail,
  resolveAccess,
  subscribeToIdeas,
} from "@/components/ideas/gate-access";

type GateState = "checking" | "locked" | "unlocked";

/** Legacy .email-form (hero + bottom variants share identical markup). */
function GateEmailForm({
  id,
  onUnlocked,
}: {
  id: string;
  onUnlocked: () => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      await subscribeToIdeas(email, firstName);
      trackEvent("signup_form_success", {
        form_id: "ideas_gate",
        page: "startup-ideas",
      });
      onUnlocked();
    } catch (err) {
      console.error("Subscription error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id={id} className="email-form space-y-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3">
        <input
          type="text"
          name="first_name"
          required
          placeholder="Your first name"
          aria-label="First name"
          className="gate-first-name bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all text-sm"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="Your email address"
            aria-label="Email address"
            className="gate-email flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="gate-submit-btn group relative inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-black rounded-xl text-sm font-semibold tracking-tight hover:bg-neutral-200 transition-all whitespace-nowrap disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>Unlocking...</span>
              </>
            ) : (
              <>
                <span>Unlock Ideas</span>
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-neutral-600">
        Free access. No spam. Unsubscribe anytime.
      </p>
    </form>
  );
}

const FOR_YOU = [
  "You have a 9-5 but want a side project that could become something more",
  "You're a dev, designer, or PM with skills but no idea what to build",
  "You want validated ideas, not random brainstorms from ChatGPT",
  "You have weekends, not months, to prove an idea works",
];

const NOT_FOR_YOU = [
  'You want "the next billion dollar idea" (these are small, shippable MVPs)',
  "You're looking for ideas that require funding or a team to execute",
];

const WHAT_YOU_GET = [
  {
    icon: Search,
    title: "Research & Validation",
    body: "Market data, competitor landscape, and proof that real people have this problem.",
  },
  {
    icon: Code,
    title: "Build Prompts",
    body: "Copy-paste AI prompts to help you build the MVP with Claude, Cursor, or any AI tool.",
  },
  {
    icon: Rocket,
    title: "Done-For-You Option",
    body: "Don't want to build it yourself? Book a consult and I'll build it for you.",
  },
];

export function StartupIdeasGate({
  children,
}: {
  /** Server-rendered ideas content — always present in the HTML. */
  children: React.ReactNode;
}) {
  // Server render + first client render are "checking": content visible,
  // no gate hero in the HTML (matches the legacy hidden #email-gate).
  const [state, setState] = React.useState<GateState>("checking");

  React.useEffect(() => {
    let cancelled = false;
    resolveAccess().then((hasAccess) => {
      if (!cancelled) setState(hasAccess ? "unlocked" : "locked");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUnlocked() {
    setState("unlocked");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const locked = state === "locked";

  return (
    <>
      {locked ? (
        <section id="email-gate" className="relative z-10">
          {/* Hero */}
          <div className="pt-32 pb-20 px-6">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-medium mb-8">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                  aria-hidden="true"
                />
                <span className="sr-only">Active:</span>
                New ideas added regularly
              </div>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-medium text-white tracking-tighter leading-[1.1] mb-6">
                Startup Ideas
                <br />
                <span className="text-neutral-400">
                  you can build this weekend.
                </span>
              </h1>

              <p className="text-lg md:text-xl text-neutral-400 font-light tracking-tight max-w-2xl mx-auto leading-relaxed mb-10">
                Research-backed ideas for busy professionals who want to ship
                something real without quitting their day job.
              </p>

              {/* Hero Email Form */}
              <div className="max-w-md mx-auto">
                <GateEmailForm id="hero-email-form" onUnlocked={handleUnlocked} />
              </div>
            </div>
          </div>

          {/* Who This Is For */}
          <div className="py-20 px-6 border-t border-white/5">
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-xl font-medium text-white mb-8 flex items-center gap-3">
                    <CheckCircle2
                      size={20}
                      className="text-white"
                      aria-hidden="true"
                    />
                    This is for you if:
                  </h3>
                  <ul className="space-y-4">
                    {FOR_YOU.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-sm text-neutral-400"
                      >
                        <Check
                          size={16}
                          className="text-neutral-600 mt-0.5 min-w-[16px]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-medium text-white mb-8 flex items-center gap-3">
                    <XCircle
                      size={20}
                      className="text-neutral-600"
                      aria-hidden="true"
                    />
                    Not for you if:
                  </h3>
                  <ul className="space-y-4">
                    {NOT_FOR_YOU.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-sm text-neutral-400"
                      >
                        <X
                          size={16}
                          className="text-neutral-600 mt-0.5 min-w-[16px]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* What You Get */}
          <div className="py-20 px-6 border-t border-white/5">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-medium text-white tracking-tight mb-4 text-center">
                What you get with each idea
              </h2>
              <p className="text-neutral-400 text-center mb-12 max-w-xl mx-auto">
                Everything you need to go from &quot;that sounds
                interesting&quot; to &quot;I shipped it.&quot;
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {WHAT_YOU_GET.map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-white">
                      <Icon size={20} aria-hidden="true" />
                    </div>
                    <h3 className="text-white font-medium mb-2">{title}</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Email Gate CTA */}
          <div className="py-24 px-6 border-t border-white/5 bg-gradient-to-b from-transparent to-[#0A0A0A]/50">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
                Get instant access to all ideas
              </h2>
              <p className="text-lg text-neutral-400 font-light mb-10 max-w-xl mx-auto">
                Enter your email and unlock the full library of research-backed
                startup ideas.
              </p>

              <div className="max-w-md mx-auto">
                <GateEmailForm
                  id="bottom-email-form"
                  onUnlocked={handleUnlocked}
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Ideas content: server-rendered visible by default, swapped out
          with the `hidden` class while the gate is up (gate.js showGate). */}
      <div id="ideas-content" className={locked ? "hidden" : undefined}>
        {children}
      </div>
    </>
  );
}
