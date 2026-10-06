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
 * (shared with the idea-page EmailGate). Signed-in members unlock via the
 * WP44 session hint cookie; anonymous visitors still see the lead-capture gate.
 */

import * as React from "react";
import { ArrowRight, Check, Code, Loader2, Rocket, Search, X } from "lucide-react";

import { Container, Em, Eyebrow } from "@/components/home/ui";
import { trackEvent } from "@/lib/track";
import {
  isValidEmail,
  resolveAccess,
  subscribeToIdeas,
} from "@/components/ideas/gate-access";

type GateState = "checking" | "locked" | "unlocked";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

const INPUT =
  "h-[52px] w-full rounded-full border border-home-ink-3 bg-home-card px-5 text-base text-home-ink placeholder:text-home-ink-3 " +
  FOCUS;

const FIELD_LABEL =
  "font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-2";

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
    <form
      id={id}
      className="email-form flex flex-col gap-4 rounded-2xl border border-home-rule bg-home-card p-5 text-left md:p-6"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-first-name`} className={FIELD_LABEL}>
          First name
        </label>
        <input
          id={`${id}-first-name`}
          type="text"
          name="first_name"
          required
          autoComplete="given-name"
          placeholder="Your first name"
          className={`gate-first-name ${INPUT}`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-email`} className={FIELD_LABEL}>
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="Your email address"
          className={`gate-email ${INPUT}`}
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className={`gate-submit-btn group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-home-ink px-6 text-base font-semibold text-home-paper transition-colors duration-150 ease-out hover:bg-home-ink-2 disabled:opacity-70 motion-reduce:transition-none ${FOCUS}`}
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>Unlocking...</span>
          </>
        ) : (
          <>
            <span>Unlock Ideas</span>
            <ArrowRight
              size={18}
              strokeWidth={1.75}
              className="transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </>
        )}
      </button>
      {error ? (
        <p className="text-sm text-home-clay-ink" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-[13px] text-home-ink-3">
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

/** "This is for you if" / "Not for you if" — a ruled list with mono marks. */
function FitList({
  id,
  heading,
  items,
  fit,
}: {
  id: string;
  heading: string;
  items: string[];
  fit: boolean;
}) {
  const Mark = fit ? Check : X;
  return (
    <div className="flex flex-col gap-5">
      <h2
        id={id}
        className="font-editorial text-[26px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink md:text-[30px]"
      >
        {heading}
      </h2>
      <ul aria-labelledby={id} className="border-t border-home-ink">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 border-b border-home-rule py-4 text-[15px] leading-[1.5] text-home-ink-2 md:text-base"
          >
            <Mark
              size={18}
              strokeWidth={1.75}
              className={`mt-0.5 shrink-0 ${fit ? "text-home-orange-ink" : "text-home-ink-3"}`}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
        <section id="email-gate" aria-labelledby="email-gate-title">
          {/* Hero */}
          <div className="relative overflow-hidden">
            <div
              aria-hidden="true"
              className="home-dots absolute inset-0 opacity-60 [mask-image:linear-gradient(#000_45%,transparent)]"
            />
            <Container className="relative flex flex-col items-center gap-6 pb-16 pt-28 text-center md:pb-20 md:pt-36">
              <Eyebrow>New ideas added regularly</Eyebrow>
              <h1
                id="email-gate-title"
                className="max-w-[900px] font-editorial text-[42px] font-normal leading-[1.02] tracking-[-0.03em] text-balance text-home-ink md:text-[60px] lg:text-[72px] lg:leading-none"
              >
                Startup Ideas <Em>you can build this weekend.</Em>
              </h1>
              <p className="max-w-[640px] text-pretty text-base leading-[1.55] text-home-ink-2 md:text-xl">
                Research-backed ideas for busy professionals who want to ship
                something real without quitting their day job.
              </p>

              {/* Hero Email Form */}
              <div className="mt-2 w-full max-w-md">
                <GateEmailForm id="hero-email-form" onUnlocked={handleUnlocked} />
              </div>
            </Container>
          </div>

          {/* Who This Is For */}
          <div className="py-14 lg:py-20">
            <Container className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-14">
              <FitList id="gate-for-you" heading="This is for you if:" items={FOR_YOU} fit />
              <FitList
                id="gate-not-for-you"
                heading="Not for you if:"
                items={NOT_FOR_YOU}
                fit={false}
              />
            </Container>
          </div>

          {/* What You Get */}
          <div className="border-t border-home-rule py-14 lg:py-20">
            <Container className="flex flex-col gap-10">
              <div className="flex flex-col gap-3">
                <h2
                  id="gate-what-you-get"
                  className="max-w-[820px] font-editorial text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-balance text-home-ink md:text-[44px]"
                >
                  What you get <Em>with each idea</Em>
                </h2>
                <p className="max-w-[640px] text-pretty text-base leading-[1.55] text-home-ink-2 md:text-[17px]">
                  Everything you need to go from &quot;that sounds
                  interesting&quot; to &quot;I shipped it.&quot;
                </p>
              </div>

              <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {WHAT_YOU_GET.map(({ icon: Icon, title, body }) => (
                  <li
                    key={title}
                    className="flex flex-col gap-3 rounded-[14px] border border-home-rule bg-home-card p-6"
                  >
                    <Icon
                      size={22}
                      strokeWidth={1.75}
                      className="text-home-orange-ink"
                      aria-hidden="true"
                    />
                    <h3 className="font-editorial text-[22px] font-normal leading-[1.2] text-home-ink">
                      {title}
                    </h3>
                    <p className="text-[15px] leading-[1.55] text-home-ink-2">
                      {body}
                    </p>
                  </li>
                ))}
              </ul>
            </Container>
          </div>

          {/* Email Gate CTA */}
          <div className="border-t border-home-rule bg-home-sunk py-16 lg:py-24">
            <Container className="flex flex-col items-center gap-5 text-center">
              <h2
                id="gate-access"
                className="max-w-[720px] font-editorial text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-balance text-home-ink md:text-[44px]"
              >
                Get instant access <Em>to all ideas</Em>
              </h2>
              <p className="max-w-[560px] text-pretty text-base leading-[1.55] text-home-ink-2 md:text-[17px]">
                Enter your email and unlock the full library of research-backed
                startup ideas.
              </p>

              <div className="mt-3 w-full max-w-md">
                <GateEmailForm
                  id="bottom-email-form"
                  onUnlocked={handleUnlocked}
                />
              </div>
            </Container>
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
