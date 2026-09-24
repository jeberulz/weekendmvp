/** Shared building blocks for the homepage sections. */
import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

/** `m` is an optional motion role (`data-m`, see components/home/motion/scenes.ts). */
export function Container({ className, children, m }: { className?: string; children: ReactNode; m?: string }) {
  return (
    <div data-m={m} className={cn("mx-auto w-full max-w-[1200px] px-5 md:px-10 xl:px-0", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] font-medium uppercase leading-[14px] tracking-[0.08em] md:text-xs md:leading-4",
        dark ? "text-home-orange-light" : "text-home-orange-ink",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Delay for a hero intro element (`.home-intro`, `.home-word`, `.home-paste`, `.home-press` in globals.css). */
export const introDelay = (seconds: number) => ({ "--d": `${seconds.toFixed(3)}s` }) as CSSProperties;

/**
 * Hero headline words that rise in turn. The words are hidden from assistive
 * tech, so the heading must carry the full sentence as its `aria-label`.
 */
export function IntroWords({ text, start, step = 0.045 }: { text: string; start: number; step?: number }) {
  return text.split(" ").map((word, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span aria-hidden className="home-word" style={introDelay(start + i * step)}>
        {word}
      </span>
    </Fragment>
  ));
}

/** The italic accent phrase inside a serif heading. Large type only (24px+). */
export function Em({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <em className={cn("italic", dark ? "text-home-orange-light" : "text-home-orange")}>{children}</em>;
}

/** Small mono label above a list or a number. */
export function Label({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <p className={cn("font-mono text-[11px] uppercase tracking-[0.08em]", dark ? "text-home-d3" : "text-home-ink-3", className)}>
      {children}
    </p>
  );
}

const METER_NOTE: Record<number, string> = {
  8: "Fits one Saturday",
  10: "Saturday + Sunday morning",
  12: "Saturday + half of Sunday",
  16: "The whole weekend",
};

export function meterNote(hours: number) {
  return METER_NOTE[hours] ?? (hours > 16 ? "More than one weekend" : `${hours} hours`);
}

/** Build time drawn as two days of eight one-hour cells. */
export function WeekendMeter({
  hours,
  dark = false,
  cell = 12,
  showNote = true,
  hoverInk = false,
  className,
}: {
  hours: number;
  dark?: boolean;
  cell?: number;
  showNote?: boolean;
  /** Inside a `group` link: switch to ink colours while the row is hovered or focused (wide screens). */
  hoverInk?: boolean;
  className?: string;
}) {
  const toInk = hoverInk ? "lg:group-hover:text-home-ink lg:group-focus-visible:text-home-ink" : "";
  const emptyToInk = hoverInk
    ? "lg:group-hover:shadow-[inset_0_0_0_1px_rgba(26,24,20,0.45)] lg:group-focus-visible:shadow-[inset_0_0_0_1px_rgba(26,24,20,0.45)]"
    : "";
  const days = [
    ["SAT", Math.min(hours, 8)],
    ["SUN", Math.max(0, Math.min(hours - 8, 8))],
  ] as const;
  return (
    <div
      role="img"
      aria-label={`Estimated build time ${hours} hours: ${meterNote(hours)}`}
      className={cn("flex flex-col gap-2.5", className)}
    >
      {showNote && (
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className={cn("font-mono text-[13px] font-medium", dark ? "text-home-d1" : "text-home-ink")}>{hours} hrs</span>
          <span className={cn("text-xs", dark ? "text-home-d2" : "text-home-ink-3")}>{meterNote(hours)}</span>
        </div>
      )}
      <div className="flex gap-3">
        {days.map(([day, filled]) => (
          <div key={day} className="flex flex-col gap-[5px]">
            <span className={cn("font-mono text-[10px] tracking-[0.08em]", dark ? "text-home-d2" : "text-home-ink-3", toInk)}>{day}</span>
            <div data-m="cells" className="flex" style={{ gap: cell > 9 ? 3 : 2 }}>
              {Array.from({ length: 8 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "block rounded-[2px]",
                    i < filled ? "bg-home-orange" : dark ? "shadow-[inset_0_0_0_1px_#3a362f]" : "shadow-[inset_0_0_0_1px_var(--color-home-rule)]",
                    i < filled && hoverInk && "lg:group-hover:bg-home-ink lg:group-focus-visible:bg-home-ink",
                    i >= filled && emptyToInk,
                  )}
                  style={{ width: cell, height: cell - 2 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TINT: Record<string, string> = {
  sage: "bg-home-sage text-home-sage-ink",
  ochre: "bg-home-ochre text-home-ochre-ink",
  sky: "bg-home-sky text-home-sky-ink",
  clay: "bg-home-clay text-home-clay-ink",
};
const CATEGORY_TINT: Record<string, string> = {
  saas: "sky",
  "creator-tools": "ochre",
  marketplace: "clay",
  education: "sky",
  health: "clay",
  "developer-tools": "sky",
  "ai-tools": "clay",
  ecommerce: "sage",
  productivity: "sage",
  fintech: "ochre",
  b2b: "ochre",
  automation: "sage",
};

export function CategoryTag({ slug, name }: { slug: string; name: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full px-[9px] font-mono text-[11px] font-medium uppercase tracking-[0.06em]",
        TINT[CATEGORY_TINT[slug] ?? "sky"],
      )}
    >
      {name}
    </span>
  );
}

/** Circular rubber stamp. Decorative; the text it repeats is always said nearby. */
export function Stamp({
  id,
  text,
  icon = "weekend",
  size = 120,
  rotate = -10,
  color = "var(--color-home-orange)",
  className,
}: {
  id: string;
  text: string;
  icon?: IconName;
  size?: number;
  rotate?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      style={{ transform: `rotate(${rotate}deg)`, flexShrink: 0 }}
    >
      <defs>
        <path id={id} d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="60" cy="60" r="36" fill="none" stroke={color} strokeWidth="1.25" />
      <text fontFamily="var(--font-geist-mono), monospace" fontSize="10.4" fontWeight={500} fill={color}>
        <textPath href={`#${id}`} textLength="286" lengthAdjust="spacing">
          {text}
        </textPath>
      </text>
      <svg x="42" y="42" width="36" height="36" viewBox="0 0 24 24">
        <Icon name={icon} size={24} color={color} accent={color} />
      </svg>
    </svg>
  );
}

type ButtonTone = "primary" | "secondary" | "dark" | "ghost-dark" | "white";

const BUTTON: Record<ButtonTone, string> = {
  primary: "bg-home-orange-ink text-white hover:bg-[#8f3f00]",
  secondary: "border border-home-ink text-home-ink hover:bg-home-ink hover:text-home-paper",
  dark: "bg-home-orange-light text-home-ink hover:bg-[#f5a266]",
  "ghost-dark": "border border-home-d2 text-home-d1 hover:border-home-d1 hover:bg-white/5",
  white: "bg-white text-home-ink hover:bg-home-paper",
};

export const buttonClass = (tone: ButtonTone, className?: string) =>
  cn(
    "inline-flex h-[52px] items-center justify-center gap-2.5 rounded-full px-6 text-base font-semibold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink",
    BUTTON[tone],
    className,
  );

export function ButtonLink({
  href,
  tone = "primary",
  icon,
  arrow = true,
  className,
  children,
}: {
  href: string;
  tone?: ButtonTone;
  icon?: IconName;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(tone, className)}>
      {icon && <Icon name={icon} size={20} accent={tone === "ghost-dark" ? "var(--color-home-orange-light)" : "currentColor"} />}
      {children}
      {arrow && !icon && <Icon name="arrow" size={18} strokeWidth={1.75} />}
    </Link>
  );
}

export function TextLink({
  href,
  dark = false,
  className,
  m,
  children,
}: {
  href: string;
  dark?: boolean;
  className?: string;
  m?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      data-m={m}
      className={cn(
        "inline-flex items-center gap-2 text-[15px] font-medium underline underline-offset-4 transition-colors",
        dark ? "text-home-d1 hover:text-home-orange-light" : "text-home-orange-ink hover:text-home-ink",
        className,
      )}
    >
      {children}
      <Icon name="arrow" size={16} strokeWidth={1.75} />
    </Link>
  );
}

/** Numbered list with italic serif numerals. */
export function StepList({ steps, dark = false, className }: { steps: string[]; dark?: boolean; className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {steps.map((step, i) => (
        <li key={step} className={cn("flex gap-3 text-[15px] leading-snug md:text-base", dark ? "text-home-d1" : "text-home-ink")}>
          <span aria-hidden className={cn("w-3.5 shrink-0 font-editorial italic", dark ? "text-home-orange-light" : "text-home-orange-ink")}>
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

export function ScoreCell({ label, value, dark = false }: { label: string; value: number; dark?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-[10px] px-3 py-2.5", dark ? "bg-home-panel" : "bg-home-paper")}>
      <span className={cn("font-mono text-[10px] tracking-[0.06em]", dark ? "text-home-d3" : "text-home-ink-3")}>{label}</span>
      <span className={cn("font-mono text-base font-medium", dark ? "text-home-d1" : "text-home-ink")}>
        <span data-m="count">{value}</span>
        <span className={cn("text-xs", dark ? "text-home-d3" : "text-home-ink-3")}>/10</span>
      </span>
    </div>
  );
}
