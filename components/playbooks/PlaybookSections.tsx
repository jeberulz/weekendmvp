/**
 * Server-rendered playbook sections.
 *
 * These are the crawlable, screenshot-able bands of a playbook page — the
 * whole reason the framework is NOT behind the email gate. Nothing here is a
 * client component and nothing here is an image: the diagrams are flex/grid
 * structures made of real text, so they stay selectable, translatable,
 * legible to crawlers, and readable by a screen reader in source order.
 *
 * Colours read from `tokensFor("cream", "orange")`. The inverted surfaces
 * (the emphasised loop node, the top stack layer, the stat tiles, the CTA
 * card) are deliberately dark-on-cream and carry their own ink classes.
 *
 * Accent contrast rule for this surface (cream #fcfaf7):
 *   - `#cc5500` is 4.1:1 on cream — fine for borders, rules, icons and large
 *     display text (WCAG 1.4.11 / 1.4.3 large), NOT for body-size text.
 *   - `#A03D00` is 6.4:1 on cream and 6.4:1 behind white — used for every
 *     small accent label and every solid accent button.
 * Both values are already in the codebase (`shipable/page.tsx:211`).
 *
 * Every Tailwind class below is written as a source literal, so the v4
 * scanner sees it without a `tailwind:` manifest — no class here is
 * assembled from a variable.
 */

import * as React from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { tokensFor } from "@/components/marketing/section-theme";
import { CopyPromptButton } from "@/app/(marketing)/starter-kit/CopyPromptButton";
import type {
  LoopStep,
  PlaybookLayer,
  PlaybookPrompt,
  PlaybookStat,
} from "./types";

const t = tokensFor("cream", "orange");

/** Shared page gutter + measure so every band lines up. */
export const SHELL = "w-full px-5 md:px-8";
export const INNER = "max-w-3xl mx-auto";

/** The one ink surface used for every inverted element on the cream canvas. */
export const INK = "bg-[#1c1917] text-[#faf7f2]";

/** Body-size accent text and solid accent buttons (6.4:1 on cream). */
export const ACCENT_TEXT = "text-[#A03D00]";

export const ACCENT_BUTTON = cn(
  "bg-[#A03D00] text-[#faf7f2] hover:bg-[#8a3400] transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c1917]",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[#fcfaf7]",
);

export { t as playbookTokens };

/* ------------------------------------------------------------------ */
/* Section heading                                                     */
/* ------------------------------------------------------------------ */

export function PlaybookSectionHeading({
  id,
  heading,
  body,
}: {
  id: string;
  heading: string;
  body: string;
}) {
  return (
    <>
      <h2
        id={id}
        className={cn(
          "text-3xl md:text-4xl font-medium tracking-tight",
          t.textPrimary,
        )}
      >
        {heading}
      </h2>
      <p className={cn("mt-4 text-lg leading-relaxed", t.textSecondary)}>
        {body}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Loop comparison — the reframe                                       */
/* ------------------------------------------------------------------ */

/**
 * Vertical connector. Purely decorative — it lives INSIDE the <li> it
 * precedes, never as a sibling, so the list has exactly one item per real
 * step. (As its own <li> it padded the list with empty items and threw the
 * announced count and numbering out.)
 */
function LoopConnector({ dashed }: { dashed?: boolean }) {
  return (
    <span aria-hidden="true" className="flex justify-center py-1.5">
      <span
        className={cn(
          "block h-4 w-0 border-l",
          dashed ? "border-l-[#cc5500] border-dashed" : "border-l-stone-300",
        )}
      />
    </span>
  );
}

function LoopNode({
  children,
  emphasis,
  dashed,
  withConnector,
}: {
  children: React.ReactNode;
  emphasis?: boolean;
  dashed?: boolean;
  withConnector?: boolean;
}) {
  return (
    <li>
      {withConnector ? <LoopConnector dashed={dashed} /> : null}
      <span
        className={cn(
          "block rounded-xl border px-4 py-3 text-center text-sm",
          dashed
            ? "border-dashed border-[#cc5500] bg-orange-500/5 text-[#1c1917]"
            : emphasis
              ? "bg-[#1c1917] text-[#faf7f2] border-[#1c1917] font-semibold"
              : cn("bg-white", t.divider, t.textSecondary),
        )}
      >
        {children}
      </span>
    </li>
  );
}

function LoopChain({
  steps,
  feedback,
}: {
  steps: LoopStep[];
  feedback?: string;
}) {
  return (
    <ol className="mt-5">
      {steps.map((step, i) => (
        <LoopNode key={step.label} emphasis={step.emphasis} withConnector={i > 0}>
          {step.label}
        </LoopNode>
      ))}
      {/* The feedback arrow is real content — it closes the loop — so it is a
          list item, not decoration. */}
      {feedback ? (
        <LoopNode dashed withConnector>
          {feedback}
        </LoopNode>
      ) : null}
    </ol>
  );
}

export function PlaybookLoops({
  headingId,
  brokenLabel,
  brokenSteps,
  workingLabel,
  workingSteps,
  feedback,
  caption,
}: {
  headingId: string;
  brokenLabel: string;
  brokenSteps: string[];
  workingLabel: string;
  workingSteps: LoopStep[];
  feedback: string;
  caption: string;
}) {
  return (
    <figure
      aria-labelledby={headingId}
      className={cn("mt-10 rounded-3xl border p-6 md:p-10", t.surface, t.divider)}
    >
      {/* Stacks below md: two dense diagrams side by side on a phone would
          shrink past legibility, so each gets full width instead. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-8">
        <div>
          {/* Broken vs working is carried by the label text and node styling,
              never by colour alone (WCAG 1.4.1). */}
          <p
            className={cn(
              "font-mono-eyebrow text-[11px] font-semibold uppercase text-center",
              t.textMuted,
            )}
          >
            {brokenLabel}
          </p>
          <LoopChain steps={brokenSteps.map((label) => ({ label }))} />
        </div>

        <div>
          <p
            className={cn(
              "font-mono-eyebrow text-[11px] font-semibold uppercase text-center",
              ACCENT_TEXT,
            )}
          >
            {workingLabel}
          </p>
          <LoopChain steps={workingSteps} feedback={feedback} />
        </div>
      </div>

      <figcaption
        className={cn("mt-8 text-center text-sm md:text-base", t.textMuted)}
      >
        {caption}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Layer stack — the named IP                                          */
/* ------------------------------------------------------------------ */

export function PlaybookLayerStack({
  headingId,
  items,
  caption,
}: {
  headingId: string;
  items: PlaybookLayer[];
  caption: string;
}) {
  // Config is authored bottom-up (items[0] is the foundation); the diagram
  // reads top-down, so render the reverse while keeping the numbering.
  const numbered = items.map((item, i) => ({ ...item, position: i + 1 }));
  const topDown = [...numbered].reverse();
  const top = numbered.length;

  return (
    <figure
      aria-labelledby={headingId}
      className={cn("mt-10 rounded-3xl border p-6 md:p-10", t.surface, t.divider)}
    >
      {/* `reversed` so the implicit list numbering counts down to match the
          rendered layer numbers — the DOM runs 6→1, top-down. */}
      <ol reversed className="space-y-3">
        {topDown.map((item) => {
          const isTop = item.position === top;
          return (
            <li
              key={item.title}
              className={cn(
                "flex gap-4 rounded-2xl border px-5 py-4",
                isTop
                  ? "bg-[#1c1917] text-[#faf7f2] border-[#1c1917]"
                  : cn("bg-[#faf7f2]", t.divider),
              )}
            >
              <span
                className={cn(
                  "pt-0.5 font-mono text-sm font-semibold tabular-nums",
                  isTop ? "text-[#e9a06a]" : ACCENT_TEXT,
                )}
              >
                {item.position}
              </span>
              <span>
                <span
                  className={cn(
                    "block text-base font-semibold",
                    isTop ? "text-[#faf7f2]" : t.textPrimary,
                  )}
                >
                  {item.title}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-sm leading-relaxed",
                    isTop ? "text-stone-300" : t.textSecondary,
                  )}
                >
                  {item.body}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <figcaption className={cn("mt-6 text-center text-sm", t.textMuted)}>
        {caption}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Fan-out + stat tiles — the payoff                                   */
/* ------------------------------------------------------------------ */

export function PlaybookFanOut({
  headingId,
  inputLabel,
  inputSub,
  outputs,
}: {
  headingId: string;
  inputLabel: string;
  inputSub: string;
  outputs: string[];
}) {
  return (
    <figure
      aria-labelledby={headingId}
      className={cn("mt-10 rounded-3xl border p-6 md:p-10", t.surface, t.divider)}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
        <div
          className={cn(
            "rounded-2xl px-6 py-5 text-center md:shrink-0 md:text-left",
            INK,
          )}
        >
          <span className="block text-base font-semibold">{inputLabel}</span>
          <span className="mt-1 block text-sm text-stone-300">{inputSub}</span>
        </div>

        <ArrowRight
          size={20}
          aria-hidden="true"
          className="hidden shrink-0 text-[#cc5500] md:block"
        />

        <ul className="flex-1 space-y-2.5">
          {outputs.map((output) => (
            <li
              key={output}
              className={cn(
                "rounded-xl border bg-[#faf7f2] px-4 py-3 text-sm",
                t.divider,
                t.textSecondary,
              )}
            >
              {output}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function PlaybookStats({ items }: { items: PlaybookStat[] }) {
  // Deliberately not `components/marketing/sections/Stats.tsx`: that band is
  // a centered, light-surface row with accent-coloured numerals and uppercase
  // labels. These are inverted tiles with Newsreader numerals on cream.
  return (
    <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className={cn("rounded-3xl p-7", INK)}>
          <dt className="accent-italic text-4xl tracking-tight md:text-5xl">
            {item.value}
          </dt>
          <dd className="mt-3 text-sm leading-relaxed text-stone-300">
            {item.label}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Prompt files — the give                                             */
/* ------------------------------------------------------------------ */

export function PlaybookPromptFile({ filename, body }: PlaybookPrompt) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border", t.divider)}>
      <div className="flex items-center justify-between gap-4 bg-white px-5 py-3">
        <span className={cn("truncate font-mono text-sm", t.textSecondary)}>
          {filename}
        </span>
        {/* CopyPromptButton takes the literal string (PromptCopyButton takes a
            ref) — the right one for config-driven content. It renders an
            icon only and supplies its own aria-label. */}
        <CopyPromptButton
          text={body}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full p-2.5",
            ACCENT_BUTTON,
          )}
        />
      </div>
      <pre
        className={cn(
          "px-5 py-6 font-mono text-sm leading-relaxed whitespace-pre-wrap",
          INK,
        )}
      >
        {body}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Closing CTA                                                         */
/* ------------------------------------------------------------------ */

export function PlaybookCtaCard({
  headingId,
  heading,
  body,
  children,
}: {
  headingId: string;
  heading: string;
  body: string;
  /** The tracked CTA link — a client component supplied by the page. */
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} className={cn(SHELL, "py-14 md:py-20")}>
      <div className={cn(INNER, "rounded-[2rem] p-8 md:p-12", INK)}>
        <h2
          id={headingId}
          className="text-3xl font-medium tracking-tight md:text-4xl"
        >
          {heading}
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-stone-300">{body}</p>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
