import {
  ART_DIRECTIONS,
  BRAND_TEXT_PAIRS,
  MIN_TEXT_CONTRAST,
  THEME_MODES,
  VISUAL_DENSITIES,
  VISUAL_SHAPES,
  contrastRatio,
  relativeLuminance,
  type ArtDirection,
  type BrandKit,
  type PaletteRole,
} from "@/lib/workspace/contracts/artifacts";

/** WCAG 2.1 SC 1.4.11: focus rings, control borders and meaningful icons. */
export const MIN_NON_TEXT_CONTRAST = 3;

const HEX = /^#[0-9A-Fa-f]{6}$/;
const NEUTRAL = { primary: "#1a1a1a", secondary: "#c8c8c8", accent: "#b84a00", ground: "#ffffff", ink: "#111111" };

/** A colour that is exactly `#RRGGBB`, lowercased, or `fallback`. Nothing else ever reaches CSS. */
export function safeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : fallback;
}

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** `a` moved `t` (0 to 1) of the way to `b`, in sRGB. */
export function mixHex(a: string, b: string, t: number): string {
  const [ca, cb] = [channels(a), channels(b)];
  const mixed = ca.map((value, index) => Math.round(value + (cb[index] - value) * t));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const worstRatio = (colour: string, against: readonly string[]): number =>
  Math.min(...against.map((background) => contrastRatio(colour, background)));

/** `colour` unchanged when it reaches `min` on every background, else moved toward black or white until it does. */
export function ensureContrast(colour: string, against: readonly string[], min: number): string {
  if (worstRatio(colour, against) >= min) return colour;
  const target = worstRatio("#000000", against) >= worstRatio("#ffffff", against) ? "#000000" : "#ffffff";
  for (let step = 1; step < 20; step += 1) {
    const candidate = mixHex(colour, target, step / 20);
    if (worstRatio(candidate, against) >= min) return candidate;
  }
  return target;
}

const firstPassing = (candidates: readonly string[], against: readonly string[], min: number): string =>
  candidates.find((candidate) => worstRatio(candidate, against) >= min) ??
  ensureContrast(candidates[candidates.length - 1], against, min);

/** A text colour on a background as drawn, after the AA check. */
export type TextPair = { text: string; background: string; ratio: number; fellBack: boolean };

export type TenantTheme = {
  /** `--t-*` custom properties. Every value is a validated hex, a system colour keyword or a font variable. */
  vars: Readonly<Record<string, string>>;
  mode: "light" | "dark";
  direction: ArtDirection;
  shape: (typeof VISUAL_SHAPES)[number];
  density: (typeof VISUAL_DENSITIES)[number];
  /** The four `BRAND_TEXT_PAIRS`, as rendered. `fellBack` pairs show ink on ground instead. */
  pairs: { body: TextPair; link: TextPair; button: TextPair; inverse: TextPair };
  /** True when even the kit's ink on ground is under 4.5:1 and black or white is used instead. */
  degraded: boolean;
  surface: string;
  focus: string;
  focusInverse: string;
  control: string;
};

const pairKey = (text: PaletteRole, background: PaletteRole) => `${text}/${background}`;

/**
 * Turns a brand kit into the colours the renderer draws with, and AA-checks every text pair again here (never
 * trusting that the kit was graded): a pair under 4.5:1 is replaced by ink on ground, and when that fails too by
 * black or white on the ground. Text uses only ink, primary and ground, in the `BRAND_TEXT_PAIRS`; the accent is
 * never text (it draws underlines, marks and focus). Surfaces, rings, borders and controls are computed to at
 * least 3:1 where they carry information.
 */
export function deriveTheme(kit: BrandKit): TenantTheme {
  const palette = kit.palette as Partial<Record<PaletteRole, { hex?: unknown }>>;
  const colour = (role: PaletteRole): string => safeHex(palette?.[role]?.hex, NEUTRAL[role]);
  const [primary, secondary, accent, ground, ink] = (["primary", "secondary", "accent", "ground", "ink"] as const).map(colour);
  const hexOf: Record<PaletteRole, string> = { primary, secondary, accent, ground, ink };

  const inkOnGround = contrastRatio(ink, ground);
  const degraded = inkOnGround < MIN_TEXT_CONTRAST;
  const baseText = degraded && worstRatio("#000000", [ground]) >= worstRatio("#ffffff", [ground]) ? "#000000" : degraded ? "#ffffff" : ink;
  const base: TextPair = { text: baseText, background: ground, ratio: contrastRatio(baseText, ground), fellBack: degraded };

  const resolved = new Map<string, TextPair>();
  for (const { text, background } of BRAND_TEXT_PAIRS) {
    const ratio = contrastRatio(hexOf[text], hexOf[background]);
    resolved.set(
      pairKey(text, background),
      ratio >= MIN_TEXT_CONTRAST ? { text: hexOf[text], background: hexOf[background], ratio, fellBack: false } : { ...base, fellBack: true },
    );
  }
  const pairs = {
    body: { ...base },
    link: resolved.get(pairKey("primary", "ground")) as TextPair,
    button: resolved.get(pairKey("ground", "primary")) as TextPair,
    inverse: resolved.get(pairKey("ground", "ink")) as TextPair,
  };
  if (degraded) pairs.body.fellBack = true;

  // A tinted surface for panels: ink (and the link colour) must stay AA on it, so the tint backs off until they do.
  let surface = ground;
  for (let tint = 0.16; tint > 0; tint -= 0.02) {
    const candidate = mixHex(ground, secondary, tint);
    if (contrastRatio(pairs.body.text, candidate) >= MIN_TEXT_CONTRAST && contrastRatio(pairs.link.text, candidate) >= MIN_TEXT_CONTRAST) {
      surface = candidate;
      break;
    }
  }

  const zones = [ground, surface];
  const dark = pairs.inverse.background;
  const darkText = pairs.inverse.text;
  const focus = firstPassing([accent, primary, secondary, pairs.body.text], zones, MIN_NON_TEXT_CONTRAST);
  const focusInverse = firstPassing([accent, secondary, darkText], [dark], MIN_NON_TEXT_CONTRAST);
  const control = ensureContrast(mixHex(ground, pairs.body.text, 0.5), zones, MIN_NON_TEXT_CONTRAST);
  const controlInverse = ensureContrast(mixHex(dark, darkText, 0.5), [dark], MIN_NON_TEXT_CONTRAST);
  const icon = firstPassing([accent, primary, secondary, pairs.body.text], zones, MIN_NON_TEXT_CONTRAST);
  const iconInverse = firstPassing([accent, secondary, darkText], [dark], MIN_NON_TEXT_CONTRAST);
  // `.inverse .btn` sets its own border, so only the light zones matter here.
  const buttonBorder = firstPassing([pairs.button.background, pairs.body.text], zones, MIN_NON_TEXT_CONTRAST);

  // Selection: the button pair, unless that fell back to ground on ground (invisible), then the system colours.
  const selectable = !pairs.button.fellBack || pairs.button.background !== ground;
  const mode = relativeLuminance(ground) > relativeLuminance(ink) ? "light" : "dark";
  const vs = kit.visualSystem as Partial<Record<"direction" | "shape" | "density", unknown>> | undefined;
  const direction = isOneOf(ART_DIRECTIONS, vs?.direction) ? vs.direction : "warm_utility";
  const shape = isOneOf(VISUAL_SHAPES, vs?.shape) ? vs.shape : "soft";
  const density = isOneOf(VISUAL_DENSITIES, vs?.density) ? vs.density : "balanced";

  const vars: Record<string, string> = {
    "--t-ground": ground,
    "--t-surface": surface,
    "--t-ink": pairs.body.text,
    "--t-link": pairs.link.text,
    "--t-btn-bg": pairs.button.background,
    "--t-btn-text": pairs.button.text,
    "--t-btn-border": buttonBorder,
    "--t-dark": dark,
    "--t-dark-text": darkText,
    "--t-focus": focus,
    "--t-focus-inverse": focusInverse,
    "--t-control": control,
    "--t-control-inverse": controlInverse,
    "--t-hairline": mixHex(ground, pairs.body.text, 0.16),
    "--t-icon": icon,
    "--t-icon-inverse": iconInverse,
    "--t-primary": primary,
    "--t-secondary": secondary,
    "--t-accent": accent,
    "--t-sel-bg": selectable ? pairs.button.background : "Highlight",
    "--t-sel-text": selectable ? pairs.button.text : "HighlightText",
  };
  // `THEME_MODES` is the contract's list; `mode` is derived from the colours, which cannot disagree with them.
  if (!THEME_MODES.includes(mode)) throw new RangeError("unreachable theme mode");
  return { vars, mode, direction, shape, density, pairs, degraded, surface, focus, focusInverse, control };
}
