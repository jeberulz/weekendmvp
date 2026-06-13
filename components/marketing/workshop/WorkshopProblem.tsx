import * as React from "react";

export type WorkshopProblemProps = {
  /** Headline (renders inside h2). */
  heading: React.ReactNode;
  /** Body content rendered inside the inner space-y stack. */
  children: React.ReactNode;
  /** "reveal" (shipable) or "reveal-fade" (dare). */
  revealClass?: string;
  /** Headline weight: shipable uses font-bold, dare uses font-semibold. */
  headingWeight?: "bold" | "semibold";
  /** Body text class (shipable uses neutral-800, dare uses neutral-700). */
  bodyClass?: string;
  /** Optional heading color class (shipable explicitly sets text-[#0a0a0a]; dare omits). */
  headingColorClass?: string;
};

/**
 * "The real problem" section: large headline + a max-w-3xl body stack.
 * Used by both shipable and dare. Children carry the page-specific bullets.
 */
export function WorkshopProblem({
  heading,
  children,
  revealClass = "reveal",
  headingWeight = "bold",
  bodyClass = "text-lg text-neutral-800",
  headingColorClass = "",
}: WorkshopProblemProps) {
  const weight = headingWeight === "bold" ? "font-bold" : "font-semibold";
  const color = headingColorClass ? ` ${headingColorClass}` : "";
  return (
    <section className={`px-5 py-20 md:py-28 max-w-3xl mx-auto ${revealClass}`}>
      <h2
        className={`text-4xl md:text-6xl ${weight} tracking-tight leading-[1.02]${color}`}
      >
        {heading}
      </h2>
      <div className={`mt-10 space-y-6 ${bodyClass}`}>{children}</div>
    </section>
  );
}
