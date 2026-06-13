import * as React from "react";

export type WorkshopTeacherProps = {
  /** Optional <picture> element + sources (shipable uses webp+jpg). If omitted, falls back to plain <img>. */
  pictureSlot?: React.ReactNode;
  /** Used when pictureSlot is not provided. */
  imgSrc?: string;
  imgAlt?: string;
  imgClass?: string;
  /** "John Iseghohi." */
  name: React.ReactNode;
  /** Eyebrow role (e.g. "Founder · Weekend MVP"). */
  role: React.ReactNode;
  roleColorClass: string;
  /** Body content (the paragraphs). */
  children: React.ReactNode;
  bodyColorClass: string;
  /** Tag chips. */
  chips: React.ReactNode[];
  chipColorClass: string;
  /** Name heading weight. */
  nameWeight?: "bold" | "semibold";
  /** Optional explicit name color (shipable=text-[#0a0a0a]). */
  nameColorClass?: string;
};

/**
 * "Meet your teacher" section — image + name + role + body + tag chips.
 */
export function WorkshopTeacher({
  pictureSlot,
  imgSrc,
  imgAlt,
  imgClass = "w-full rounded-3xl object-cover aspect-[4/3] bg-[#f5f2ed] mb-10",
  name,
  role,
  roleColorClass,
  children,
  bodyColorClass,
  chips,
  chipColorClass,
  nameWeight = "bold",
  nameColorClass = "",
}: WorkshopTeacherProps) {
  const weight = nameWeight === "bold" ? "font-bold" : "font-semibold";
  const nColor = nameColorClass ? ` ${nameColorClass}` : "";
  return (
    <section className="px-5 py-20 md:py-28 max-w-3xl mx-auto">
      {pictureSlot ?? (
        <img
          src={imgSrc}
          alt={imgAlt}
          className={imgClass}
        />
      )}
      <h2 className={`text-5xl ${weight} tracking-tight${nColor}`}>{name}</h2>
      <p
        className={`font-mono-eyebrow text-[11px] uppercase ${roleColorClass} mt-2`}
      >
        {role}
      </p>
      <div className={`mt-8 space-y-5 text-lg ${bodyColorClass}`}>{children}</div>
      <div className="mt-8 flex flex-wrap gap-3">
        {chips.map((chip, i) => (
          <span
            key={i}
            className={`rounded-full bg-[#f5f2ed] px-4 py-2 font-mono-eyebrow text-[10px] uppercase ${chipColorClass}`}
          >
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
}
