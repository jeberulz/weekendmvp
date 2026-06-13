/**
 * Shared theme tokens for the programmatic SEO hub pages (/ideas-for/*,
 * /build-with/*, /solve/*, /ideas/{collection}).
 *
 * Tailwind only generates classes it can see as literals, so every accent
 * color used by the legacy generators (scripts/generate-programmatic-pages.js
 * COLOR_MAP + AUDIENCE_COLORS, scripts/sync-build-with.js) is spelled out
 * here as full class strings instead of `bg-${color}-500/10` interpolation.
 */

export type HubColor =
  | "blue"
  | "yellow"
  | "green"
  | "purple"
  | "violet"
  | "orange"
  | "teal"
  | "slate"
  | "emerald"
  | "pink"
  | "rose"
  | "cyan"
  | "amber"
  | "white";

export type HubColorStyle = {
  /** `text-{color}-400` — icon + accent text */
  text: string;
  /** `bg-{color}-500/10` — icon boxes, badges */
  bg10: string;
  /** `bg-{color}-500/20` — stronger step circles */
  bg20: string;
  /** `border-{color}-500/20` — accent chips */
  border20: string;
  /** `bg-{c}-500/10 text-{c}-400` — category badge shorthand */
  badge: string;
};

export const COLOR_STYLES: Record<HubColor, HubColorStyle> = {
  blue: {
    text: "text-blue-400",
    bg10: "bg-blue-500/10",
    bg20: "bg-blue-500/20",
    border20: "border-blue-500/20",
    badge: "bg-blue-500/10 text-blue-400",
  },
  yellow: {
    text: "text-yellow-400",
    bg10: "bg-yellow-500/10",
    bg20: "bg-yellow-500/20",
    border20: "border-yellow-500/20",
    badge: "bg-yellow-500/10 text-yellow-400",
  },
  green: {
    text: "text-green-400",
    bg10: "bg-green-500/10",
    bg20: "bg-green-500/20",
    border20: "border-green-500/20",
    badge: "bg-green-500/10 text-green-400",
  },
  purple: {
    text: "text-purple-400",
    bg10: "bg-purple-500/10",
    bg20: "bg-purple-500/20",
    border20: "border-purple-500/20",
    badge: "bg-purple-500/10 text-purple-400",
  },
  violet: {
    text: "text-violet-400",
    bg10: "bg-violet-500/10",
    bg20: "bg-violet-500/20",
    border20: "border-violet-500/20",
    badge: "bg-violet-500/10 text-violet-400",
  },
  orange: {
    text: "text-orange-400",
    bg10: "bg-orange-500/10",
    bg20: "bg-orange-500/20",
    border20: "border-orange-500/20",
    badge: "bg-orange-500/10 text-orange-400",
  },
  teal: {
    text: "text-teal-400",
    bg10: "bg-teal-500/10",
    bg20: "bg-teal-500/20",
    border20: "border-teal-500/20",
    badge: "bg-teal-500/10 text-teal-400",
  },
  slate: {
    text: "text-slate-400",
    bg10: "bg-slate-500/10",
    bg20: "bg-slate-500/20",
    border20: "border-slate-500/20",
    badge: "bg-slate-500/10 text-slate-400",
  },
  emerald: {
    text: "text-emerald-400",
    bg10: "bg-emerald-500/10",
    bg20: "bg-emerald-500/20",
    border20: "border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-400",
  },
  pink: {
    text: "text-pink-400",
    bg10: "bg-pink-500/10",
    bg20: "bg-pink-500/20",
    border20: "border-pink-500/20",
    badge: "bg-pink-500/10 text-pink-400",
  },
  rose: {
    text: "text-rose-400",
    bg10: "bg-rose-500/10",
    bg20: "bg-rose-500/20",
    border20: "border-rose-500/20",
    badge: "bg-rose-500/10 text-rose-400",
  },
  cyan: {
    text: "text-cyan-400",
    bg10: "bg-cyan-500/10",
    bg20: "bg-cyan-500/20",
    border20: "border-cyan-500/20",
    badge: "bg-cyan-500/10 text-cyan-400",
  },
  amber: {
    text: "text-amber-400",
    bg10: "bg-amber-500/10",
    bg20: "bg-amber-500/20",
    border20: "border-amber-500/20",
    badge: "bg-amber-500/10 text-amber-400",
  },
  white: {
    text: "text-white",
    bg10: "bg-white/10",
    bg20: "bg-white/20",
    border20: "border-white/20",
    badge: "bg-white/10 text-white",
  },
};

/** Legacy COLOR_MAP — idea category → accent color (card badges). */
export const CATEGORY_COLORS: Record<string, HubColor> = {
  saas: "blue",
  productivity: "yellow",
  health: "green",
  marketplace: "purple",
  "ai-tools": "violet",
  automation: "orange",
  education: "teal",
  b2b: "slate",
  "developer-tools": "emerald",
  ecommerce: "pink",
  "creator-tools": "rose",
  fintech: "cyan",
};

/** Legacy CATEGORY_LABELS from scripts/sync-build-with.js. */
export const CATEGORY_LABELS: Record<string, string> = {
  saas: "SaaS",
  productivity: "Productivity",
  health: "Health",
  marketplace: "Marketplace",
  "ai-tools": "AI Tools",
  automation: "Automation",
  education: "Education",
  b2b: "B2B",
  "developer-tools": "Developer Tools",
  ecommerce: "E-Commerce",
  "creator-tools": "Creator Tools",
  fintech: "Fintech",
};

export function categoryLabel(slug: string): string {
  if (CATEGORY_LABELS[slug]) return CATEGORY_LABELS[slug];
  return String(slug || "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function categoryColor(slug: string): HubColorStyle {
  return COLOR_STYLES[CATEGORY_COLORS[slug] ?? "blue"];
}
