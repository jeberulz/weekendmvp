/**
 * Marketing section theme + accent variant tokens.
 *
 * Mirrors the proven pattern in `components/hubs/hub-theme.ts`: every
 * Tailwind class is spelled out as a literal so the v4 source scan can
 * see it. Sections read tokens at render via `tokensFor(theme, accent)`
 * instead of building class strings with template literals.
 *
 * tailwind:
 *   text-orange-400 text-emerald-400 text-blue-400 text-purple-400
 *   text-amber-400 text-rose-400 text-violet-400 text-teal-400
 *   text-fuchsia-400
 *   text-[#CC5500] text-[#1D4ED8] text-[#A7C0F2] text-[#e9a06a]
 *
 *   bg-orange-500/5 bg-orange-500/10 bg-orange-500/20
 *   bg-emerald-500/5 bg-emerald-500/10 bg-emerald-500/20
 *   bg-blue-500/5 bg-blue-500/10 bg-blue-500/20
 *   bg-purple-500/5 bg-purple-500/10 bg-purple-500/20
 *   bg-amber-500/5 bg-amber-500/10 bg-amber-500/20
 *   bg-rose-500/5 bg-rose-500/10 bg-rose-500/20
 *   bg-violet-500/5 bg-violet-500/10 bg-violet-500/20
 *   bg-teal-500/5 bg-teal-500/10 bg-teal-500/20
 *   bg-fuchsia-500/5 bg-fuchsia-500/10 bg-fuchsia-500/20
 *   bg-blue-700/5 bg-blue-700/10 bg-blue-700/20
 *
 *   border-orange-500/20 border-emerald-500/20 border-blue-500/20
 *   border-purple-500/20 border-amber-500/20 border-rose-500/20
 *   border-violet-500/20 border-teal-500/20 border-fuchsia-500/20
 *   border-blue-700/20
 *
 *   focus:ring-orange-500/40 focus:ring-emerald-500/40 focus:ring-blue-500/40
 *   focus:ring-purple-500/40 focus:ring-amber-500/40 focus:ring-rose-500/40
 *   focus:ring-violet-500/40 focus:ring-teal-500/40 focus:ring-fuchsia-500/40
 *   focus:ring-blue-700/40
 *
 *   from-orange-500/30 from-emerald-500/30 from-blue-500/30
 *   from-purple-500/30 from-amber-500/30 from-rose-500/30
 *   from-violet-500/30 from-teal-500/30 from-fuchsia-500/30
 *   from-blue-700/30
 *   to-orange-500/0 to-emerald-500/0 to-blue-500/0
 *   to-purple-500/0 to-amber-500/0 to-rose-500/0
 *   to-violet-500/0 to-teal-500/0 to-fuchsia-500/0
 *   to-blue-700/0
 *
 *   bg-[#050505] bg-[#fcfaf7] bg-[#faf7f2] bg-[#0a0a0a] bg-[#1a1a1a]
 *   bg-[#f5f2ed]
 *   bg-white/5 bg-white/[0.03] bg-white bg-black/[0.03] bg-black/[0.05]
 *
 *   text-white text-neutral-300 text-neutral-500 text-[#1c1917]
 *   text-stone-700 text-stone-500 text-[#1a1a1a]
 *
 *   border-white/10 border-black/10
 *
 *   focus:ring-white/40 focus:ring-black/30
 */

export type Theme = "dark" | "cream" | "ink-blue";
export type Accent =
  | "orange"
  | "emerald"
  | "blue"
  | "purple"
  | "amber"
  | "rose"
  | "lavender"
  | "mint"
  | "aubergine";

export type AccentTokens = {
  /** Accent text color (icons, labels, eyebrows). */
  text: string;
  /** 5% tinted background (subtle hover, soft chip). */
  bg5: string;
  /** 10% tinted background (badges, icon boxes). */
  bg10: string;
  /** 20% tinted background (stronger pills, step circles). */
  bg20: string;
  /** Accent border at 20% opacity (chips, ringed cards). */
  border: string;
  /** Focus ring class (Tailwind focus: prefix). */
  ring: string;
  /** Gradient start utility (for from-* in bg-gradient-to-*). */
  gradientFrom: string;
  /** Gradient end utility (for to-* in bg-gradient-to-*). */
  gradientTo: string;
};

export type ThemeTokens = {
  /** Page background utility (e.g. `bg-[#050505]`). */
  pageBg: string;
  /** Card / surface background (e.g. `bg-white/5`). */
  surface: string;
  /** Muted surface variation (deeper card / subtle band). */
  surfaceMuted: string;
  /** Primary text color (h1/h2/body emphasis). */
  textPrimary: string;
  /** Secondary text color (body copy). */
  textSecondary: string;
  /** Muted text color (eyebrows, meta). */
  textMuted: string;
  /** Divider / hairline border. */
  divider: string;
  /** Focus ring class for neutral controls on this theme. */
  focusRing: string;
};

export const ACCENT_TOKENS: Record<Accent, AccentTokens> = {
  orange: {
    text: "text-orange-400",
    bg5: "bg-orange-500/5",
    bg10: "bg-orange-500/10",
    bg20: "bg-orange-500/20",
    border: "border-orange-500/20",
    ring: "focus:ring-orange-500/40",
    gradientFrom: "from-orange-500/30",
    gradientTo: "to-orange-500/0",
  },
  emerald: {
    text: "text-emerald-400",
    bg5: "bg-emerald-500/5",
    bg10: "bg-emerald-500/10",
    bg20: "bg-emerald-500/20",
    border: "border-emerald-500/20",
    ring: "focus:ring-emerald-500/40",
    gradientFrom: "from-emerald-500/30",
    gradientTo: "to-emerald-500/0",
  },
  blue: {
    text: "text-blue-400",
    bg5: "bg-blue-500/5",
    bg10: "bg-blue-500/10",
    bg20: "bg-blue-500/20",
    border: "border-blue-500/20",
    ring: "focus:ring-blue-500/40",
    gradientFrom: "from-blue-500/30",
    gradientTo: "to-blue-500/0",
  },
  purple: {
    text: "text-purple-400",
    bg5: "bg-purple-500/5",
    bg10: "bg-purple-500/10",
    bg20: "bg-purple-500/20",
    border: "border-purple-500/20",
    ring: "focus:ring-purple-500/40",
    gradientFrom: "from-purple-500/30",
    gradientTo: "to-purple-500/0",
  },
  amber: {
    text: "text-amber-400",
    bg5: "bg-amber-500/5",
    bg10: "bg-amber-500/10",
    bg20: "bg-amber-500/20",
    border: "border-amber-500/20",
    ring: "focus:ring-amber-500/40",
    gradientFrom: "from-amber-500/30",
    gradientTo: "to-amber-500/0",
  },
  rose: {
    text: "text-rose-400",
    bg5: "bg-rose-500/5",
    bg10: "bg-rose-500/10",
    bg20: "bg-rose-500/20",
    border: "border-rose-500/20",
    ring: "focus:ring-rose-500/40",
    gradientFrom: "from-rose-500/30",
    gradientTo: "to-rose-500/0",
  },
  // Lavender maps to Tailwind violet (closest neutral lavender at scale).
  lavender: {
    text: "text-violet-400",
    bg5: "bg-violet-500/5",
    bg10: "bg-violet-500/10",
    bg20: "bg-violet-500/20",
    border: "border-violet-500/20",
    ring: "focus:ring-violet-500/40",
    gradientFrom: "from-violet-500/30",
    gradientTo: "to-violet-500/0",
  },
  // Mint maps to Tailwind teal.
  mint: {
    text: "text-teal-400",
    bg5: "bg-teal-500/5",
    bg10: "bg-teal-500/10",
    bg20: "bg-teal-500/20",
    border: "border-teal-500/20",
    ring: "focus:ring-teal-500/40",
    gradientFrom: "from-teal-500/30",
    gradientTo: "to-teal-500/0",
  },
  // Aubergine maps to Tailwind fuchsia (deepest accessible purple-red).
  aubergine: {
    text: "text-fuchsia-400",
    bg5: "bg-fuchsia-500/5",
    bg10: "bg-fuchsia-500/10",
    bg20: "bg-fuchsia-500/20",
    border: "border-fuchsia-500/20",
    ring: "focus:ring-fuchsia-500/40",
    gradientFrom: "from-fuchsia-500/30",
    gradientTo: "to-fuchsia-500/0",
  },
};

export const THEME_TOKENS: Record<Theme, ThemeTokens> = {
  // Matches the legacy homepage and HubShell canvas.
  dark: {
    pageBg: "bg-[#050505]",
    surface: "bg-white/5",
    surfaceMuted: "bg-white/[0.03]",
    textPrimary: "text-white",
    textSecondary: "text-neutral-300",
    textMuted: "text-neutral-500",
    divider: "border-white/10",
    focusRing: "focus:ring-white/40",
  },
  // Matches shipable + dare + starter-kit cream canvas (#fcfaf7).
  cream: {
    pageBg: "bg-[#fcfaf7]",
    surface: "bg-white",
    surfaceMuted: "bg-black/[0.03]",
    textPrimary: "text-[#1c1917]",
    textSecondary: "text-stone-700",
    textMuted: "text-stone-500",
    divider: "border-black/10",
    focusRing: "focus:ring-black/30",
  },
  // Cream canvas + ink-blue accent (dare's brand). Neutrals mirror cream.
  "ink-blue": {
    pageBg: "bg-[#fcfaf7]",
    surface: "bg-white",
    surfaceMuted: "bg-black/[0.03]",
    textPrimary: "text-[#1c1917]",
    textSecondary: "text-stone-700",
    textMuted: "text-stone-500",
    divider: "border-black/10",
    focusRing: "focus:ring-black/30",
  },
};

/**
 * Accent override applied automatically when a section is rendered on the
 * `ink-blue` theme. The dare workshop uses Tailwind `blue-700` as the brand
 * accent instead of any of the named accents above. We keep this private
 * to the helper so `Accent` stays a stable public union.
 */
const INK_BLUE_ACCENT: AccentTokens = {
  text: "text-[#1D4ED8]",
  bg5: "bg-blue-700/5",
  bg10: "bg-blue-700/10",
  bg20: "bg-blue-700/20",
  border: "border-blue-700/20",
  ring: "focus:ring-blue-700/40",
  gradientFrom: "from-blue-700/30",
  gradientTo: "to-blue-700/0",
};

/**
 * Resolve the combined token set for a (theme, accent) pair. On the
 * `ink-blue` theme the accent is overridden to the workshop's blue-700
 * regardless of what the caller passed, so `theme="ink-blue"` always reads
 * as a coherent dare-styled variant.
 */
export function tokensFor(
  theme: Theme,
  accent: Accent,
): AccentTokens & ThemeTokens {
  const themeTokens = THEME_TOKENS[theme];
  const accentTokens =
    theme === "ink-blue" ? INK_BLUE_ACCENT : ACCENT_TOKENS[accent];
  return { ...themeTokens, ...accentTokens };
}
