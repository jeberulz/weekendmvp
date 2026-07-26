import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Loud, single-destination conversion panel for a hub page.
 *
 * Distinct from HubCta (the closing starter-kit panel): this one owns the
 * primary internal path — /startup-ideas — which used to be an easily missed
 * 8th tile inside the "Explore Other Tools" grid on /build-with/{tool}.
 *
 * Server component; the heading, copy, and link are all crawlable.
 */
export function HubPrimaryCta({
  eyebrow,
  heading,
  body,
  href,
  ctaLabel,
  note,
  headingId = "primary-cta-heading",
  panelClassName,
  iconClassName,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  href: string;
  ctaLabel: string;
  /** Small supporting line under the button. */
  note?: string;
  headingId?: string;
  /** Accent gradient/border for the panel (literal Tailwind classes). */
  panelClassName?: string;
  /** Accent color for the icon (literal Tailwind classes). */
  iconClassName?: string;
}) {
  return (
    <section className="mt-24" aria-labelledby={headingId}>
      <div
        className={cn(
          "p-10 md:p-14 rounded-[3rem] border border-white/20 bg-gradient-to-br from-white/10 to-transparent text-center",
          panelClassName,
        )}
      >
        <span
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/10"
          aria-hidden="true"
        >
          <Lightbulb size={26} className={cn("text-white", iconClassName)} />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-neutral-300">
          {eyebrow}
        </p>
        <h2
          id={headingId}
          className="mt-4 text-3xl md:text-4xl font-medium text-white tracking-tight"
        >
          {heading}
        </h2>
        <p className="mt-4 mx-auto max-w-xl text-neutral-300 leading-relaxed">
          {body}
        </p>
        <Link
          href={href}
          className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full text-base font-semibold hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
        >
          <span>{ctaLabel}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        {note ? (
          <p className="mt-4 text-sm text-neutral-400">{note}</p>
        ) : null}
      </div>
    </section>
  );
}
