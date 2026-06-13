import * as React from "react";

export type WorkshopMoveItem = {
  /** Large glyph in the left column (e.g. "01", "D", "R+E"). */
  glyph: React.ReactNode;
  /** Glyph color class (shipable=text-neutral-200, dare=text-[#C9D8F7]). */
  glyphColorClass: string;
  /** Optional extra glyph class (dare adds w-24 + aria-hidden). */
  glyphAriaHidden?: boolean;
  /** Optional glyph extra class (e.g. "w-24"). */
  glyphExtraClass?: string;
  /** The h3 heading. */
  heading: React.ReactNode;
  /** Body paragraph. */
  body: React.ReactNode;
  /** Time chip (e.g. "~25 min"). */
  time: React.ReactNode;
  /** Time chip text color class (shipable=neutral-700, dare=neutral-500). */
  timeColorClass: string;
};

export type WorkshopMovesProps = {
  /** The h2 heading. */
  heading: React.ReactNode;
  items: WorkshopMoveItem[];
  /** Heading weight (shipable=bold, dare=semibold). */
  headingWeight?: "bold" | "semibold";
  /** Body paragraph text color (shipable=neutral-700, dare=neutral-600). */
  bodyTextClass?: string;
  /** Optional reveal class (shipable=reveal, dare=reveal-fade). */
  revealClass?: string;
  /** Optional heading color (shipable explicit). */
  headingColorClass?: string;
  /** Optional heading color on h3 inside each move (shipable=text-[#0a0a0a]). */
  moveHeadingColorClass?: string;
};

/**
 * The "Three moves" framework section. Three articles in a vertical
 * border-stack with a numeric/letter glyph in the left column.
 */
export function WorkshopMoves({
  heading,
  items,
  headingWeight = "bold",
  bodyTextClass = "text-lg text-neutral-700",
  revealClass = "reveal",
  headingColorClass = "",
  moveHeadingColorClass = "",
}: WorkshopMovesProps) {
  const weight = headingWeight === "bold" ? "font-bold" : "font-semibold";
  const hColor = headingColorClass ? ` ${headingColorClass}` : "";
  const moveHColor = moveHeadingColorClass ? ` ${moveHeadingColorClass}` : "";
  return (
    <section className="px-5 py-20 md:py-28 max-w-4xl mx-auto">
      <h2
        className={`text-4xl md:text-6xl ${weight} tracking-tight leading-[1.02] mb-14${hColor}`}
      >
        {heading}
      </h2>

      <div className="border-t border-black/10">
        {items.map((item, i) => (
          <article
            key={i}
            className={`grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-3 py-10 border-b border-black/10 ${revealClass}`}
          >
            <span
              className={`text-6xl md:text-7xl font-semibold ${item.glyphColorClass} leading-none${
                item.glyphExtraClass ? ` ${item.glyphExtraClass}` : ""
              }`}
              {...(item.glyphAriaHidden ? { "aria-hidden": "true" } : {})}
            >
              {item.glyph}
            </span>
            <div>
              <h3
                className={`text-2xl md:text-3xl font-semibold tracking-tight${moveHColor}`}
              >
                {item.heading}
              </h3>
              <p className={`mt-3 ${bodyTextClass}`}>{item.body}</p>
              <span
                className={`mt-4 inline-block rounded-full bg-[#f5f2ed] px-3 py-1 font-mono-eyebrow text-[10px] uppercase ${item.timeColorClass}`}
              >
                {item.time}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
