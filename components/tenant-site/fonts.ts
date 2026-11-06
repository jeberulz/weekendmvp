import {
  Archivo, Bricolage_Grotesque, Caprasimo, DM_Sans, DM_Serif_Display, Familjen_Grotesk, Figtree, Fraunces, Gloock,
  Hanken_Grotesk, IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Sans, Instrument_Serif, Karla, Literata, Manrope, Newsreader,
  Onest, Public_Sans, Red_Hat_Display, Red_Hat_Text, Schibsted_Grotesk, Spectral, Syne, Work_Sans, Young_Serif,
} from "next/font/google";
import type { TypePairId } from "@/lib/workspace/contracts/artifacts";

/**
 * next/font cannot pick a family at render time: every loader is a module-scope call with literal options. So one
 * loader per family sits here (`TYPE_PAIRS` lists each family once), `TENANT_FONTS` maps a pair id to its loaders'
 * class names and CSS variables, and a page applies only the chosen pair's classes. `preload: false` means no
 * `<link rel=preload>`, and the browser fetches a face only when the page uses it. The weights below are literals
 * (next/font requires it) and `tests/platform/wp75-tenant-theme.test.ts` checks them against `TYPE_PAIRS`.
 */
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-fraunces", weight: ["300", "400", "500", "600", "700", "800", "900"] });
const newsreader = Newsreader({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-newsreader", weight: ["400", "500", "600"] });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-instrument-serif", weight: ["400"] });
const instrumentSans = Instrument_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-instrument-sans", weight: ["400", "500", "600"] });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-dm-serif", weight: ["400"] });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-dm-sans", weight: ["400", "500", "600"] });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-bricolage", weight: ["500", "600", "700", "800"] });
const figtree = Figtree({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-figtree", weight: ["400", "500", "600"] });
const syne = Syne({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-syne", weight: ["600", "700", "800"] });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-manrope", weight: ["400", "500", "600"] });
const archivo = Archivo({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-archivo", weight: ["400", "500", "600", "700", "800", "900"] });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-plex-sans", weight: ["400", "500", "600", "700"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-plex-mono", weight: ["400", "500"] });
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-schibsted", weight: ["600", "700", "800"] });
const literata = Literata({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-literata", weight: ["400", "500"] });
const youngSerif = Young_Serif({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-young-serif", weight: ["400"] });
const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-public-sans", weight: ["400", "500", "600"] });
const caprasimo = Caprasimo({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-caprasimo", weight: ["400"] });
const karla = Karla({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-karla", weight: ["400", "500", "600"] });
const gloock = Gloock({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-gloock", weight: ["400"] });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-work-sans", weight: ["400", "500"] });
const redHatDisplay = Red_Hat_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-red-hat-display", weight: ["600", "700", "800", "900"] });
const redHatText = Red_Hat_Text({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-red-hat-text", weight: ["400", "500"] });
const hanken = Hanken_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-hanken", weight: ["600", "700", "800"] });
const spectral = Spectral({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-spectral", weight: ["400", "500"] });
const familjen = Familjen_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-familjen", weight: ["500", "600", "700"] });
const onest = Onest({ subsets: ["latin"], display: "swap", preload: false, variable: "--tsr-onest", weight: ["400", "500"] });

/** `className` (next/font's `.variable` class) defines `cssVar`; `cssVar` must equal the loader's `variable` option (tested). */
type Face = { readonly className: string; readonly cssVar: string };
const f = (loaded: { variable: string }, cssVar: string): Face => ({ className: loaded.variable, cssVar });
export type TenantFontPair = {
  /** Classes to put on the root: they define the CSS variables below. Only this pair's. */
  readonly classNames: string;
  /** `font-family` values built from the variables and a generic fallback. */
  readonly heading: string;
  readonly body: string;
  readonly mono: string;
};

const stack = (face: Face, generic: "serif" | "sans-serif" | "monospace") => `var(${face.cssVar}), ${generic}`;
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const pair = (heading: Face, headingGeneric: "serif" | "sans-serif", body: Face, bodyGeneric: "serif" | "sans-serif", mono?: Face): TenantFontPair => ({
  classNames: [heading, body, mono].filter((face): face is Face => face !== undefined).map((face) => face.className).filter((name, i, all) => all.indexOf(name) === i).join(" "),
  heading: stack(heading, headingGeneric),
  body: stack(body, bodyGeneric),
  mono: mono ? stack(mono, "monospace") : MONO,
});

export const TENANT_FONTS: Readonly<Record<TypePairId, TenantFontPair>> = {
  fraunces_newsreader: pair(f(fraunces, "--tsr-fraunces"), "serif", f(newsreader, "--tsr-newsreader"), "serif"),
  instrument_serif_instrument_sans: pair(f(instrumentSerif, "--tsr-instrument-serif"), "serif", f(instrumentSans, "--tsr-instrument-sans"), "sans-serif"),
  dm_serif_display_dm_sans: pair(f(dmSerif, "--tsr-dm-serif"), "serif", f(dmSans, "--tsr-dm-sans"), "sans-serif"),
  bricolage_grotesque_figtree: pair(f(bricolage, "--tsr-bricolage"), "sans-serif", f(figtree, "--tsr-figtree"), "sans-serif"),
  syne_manrope: pair(f(syne, "--tsr-syne"), "sans-serif", f(manrope, "--tsr-manrope"), "sans-serif"),
  archivo_archivo: pair(f(archivo, "--tsr-archivo"), "sans-serif", f(archivo, "--tsr-archivo"), "sans-serif"),
  ibm_plex: pair(f(plexSans, "--tsr-plex-sans"), "sans-serif", f(plexSans, "--tsr-plex-sans"), "sans-serif", f(plexMono, "--tsr-plex-mono")),
  schibsted_grotesk_literata: pair(f(schibsted, "--tsr-schibsted"), "sans-serif", f(literata, "--tsr-literata"), "serif"),
  young_serif_public_sans: pair(f(youngSerif, "--tsr-young-serif"), "serif", f(publicSans, "--tsr-public-sans"), "sans-serif"),
  caprasimo_karla: pair(f(caprasimo, "--tsr-caprasimo"), "serif", f(karla, "--tsr-karla"), "sans-serif"),
  gloock_work_sans: pair(f(gloock, "--tsr-gloock"), "serif", f(workSans, "--tsr-work-sans"), "sans-serif"),
  red_hat_display_red_hat_text: pair(f(redHatDisplay, "--tsr-red-hat-display"), "sans-serif", f(redHatText, "--tsr-red-hat-text"), "sans-serif"),
  hanken_grotesk_spectral: pair(f(hanken, "--tsr-hanken"), "sans-serif", f(spectral, "--tsr-spectral"), "serif"),
  familjen_grotesk_onest: pair(f(familjen, "--tsr-familjen"), "sans-serif", f(onest, "--tsr-onest"), "sans-serif"),
};
