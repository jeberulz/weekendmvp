/**
 * Workshop accent tokens (shipable + dare).
 *
 * The workshop family uses arbitrary brand colors (burnt orange #CC5500
 * and ink blue #1D4ED8) that aren't part of the generic `Accent` union in
 * `section-theme.ts`. We keep these literal hex tokens local to the
 * workshop sections so the cream + dark canvases stay byte-equivalent to
 * the legacy shipable.html / dare.html markup.
 *
 * tailwind:
 *   bg-[#CC5500] bg-[#e9a06a] bg-[#A03D00]
 *   bg-[#1D4ED8] bg-[#1E40AF] bg-[#A7C0F2] bg-[#C9D8F7] bg-[#f0f3fa]
 *   text-[#CC5500] text-[#e9a06a] text-[#A03D00]
 *   text-[#1D4ED8] text-[#1E40AF] text-[#A7C0F2] text-[#C9D8F7]
 *   border-[#A03D00]/40 border-[#1E40AF]/40
 *   decoration-[#CC5500]/70 decoration-[#1D4ED8]/70
 *   hover:bg-[#f0b380] hover:bg-[#bdd0f6]
 */

export type WorkshopAccent = "orange" | "ink-blue";

export type WorkshopTokens = {
  /** Heading + body accent (italic phrases, large display). */
  accentText: string;
  /** Eyebrow / small-text accent on cream (passes WCAG AA). */
  eyebrowText: string;
  /** Soft accent on dark surfaces (chip text, italic on dark cards). */
  softText: string;
  /** Solid accent dot / divider (1px tinted line). */
  solidBg: string;
  /** Accent pulse dot color (used in live badges). */
  pulseDot: string;
  /** Bonus row chip border + text. */
  bonusBorder: string;
  /** Strike-through decoration color over the value total. */
  strikeDecoration: string;
  /** Sticky bar CTA bg (hover variant). */
  stickyCtaBg: string;
  stickyCtaHoverBg: string;
};

export const WORKSHOP_TOKENS: Record<WorkshopAccent, WorkshopTokens> = {
  orange: {
    accentText: "text-[#CC5500]",
    eyebrowText: "text-[#A03D00]",
    softText: "text-[#e9a06a]",
    solidBg: "bg-[#CC5500]",
    pulseDot: "bg-[#e9a06a]",
    bonusBorder: "border-[#A03D00]/40 text-[#A03D00]",
    strikeDecoration: "decoration-[#CC5500]/70",
    stickyCtaBg: "bg-[#e9a06a] text-[#1a1a1a]",
    stickyCtaHoverBg: "hover:bg-[#f0b380]",
  },
  "ink-blue": {
    accentText: "text-[#1D4ED8]",
    eyebrowText: "text-[#1E40AF]",
    softText: "text-[#A7C0F2]",
    solidBg: "bg-[#1D4ED8]",
    pulseDot: "bg-[#1D4ED8]",
    bonusBorder: "border-[#1E40AF]/40 text-[#1E40AF]",
    strikeDecoration: "decoration-[#1D4ED8]/70",
    stickyCtaBg: "bg-[#A7C0F2] text-[#1a1a1a]",
    stickyCtaHoverBg: "hover:bg-[#bdd0f6]",
  },
};
