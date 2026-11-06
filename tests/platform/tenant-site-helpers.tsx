import {
  DIRECTION_LAYOUTS,
  TYPE_PAIRS,
  TYPE_PAIR_IDS,
  type ArtDirection,
  type BrandKit,
  type LandingSpec,
  type PaletteRole,
} from "@/lib/workspace/contracts/artifacts";
import { hydrotrailBrandKit, hydrotrailLandingSpec } from "@/lib/workspace/contracts/fixtures/hydrotrail";

const LOADERS = [
  "Archivo", "Bricolage_Grotesque", "Caprasimo", "DM_Sans", "DM_Serif_Display", "Familjen_Grotesk", "Figtree", "Fraunces",
  "Gloock", "Hanken_Grotesk", "IBM_Plex_Mono", "IBM_Plex_Sans", "Instrument_Sans", "Instrument_Serif", "Karla", "Literata",
  "Manrope", "Newsreader", "Onest", "Public_Sans", "Red_Hat_Display", "Red_Hat_Text", "Schibsted_Grotesk", "Spectral", "Syne",
  "Work_Sans", "Young_Serif",
];

/** Records every next/font loader call; a stand-in for what Next's build transform does with them. */
export function fontMockModule(calls: { family: string; options: Record<string, unknown> }[]) {
  return Object.fromEntries(
    LOADERS.map((name) => [
      name,
      (options: Record<string, unknown>) => {
        calls.push({ family: name.replaceAll("_", " "), options });
        return { className: `font-${name}`, variable: `var-${name}`, style: { fontFamily: name } };
      },
    ]),
  );
}

export const pairFor = (direction: ArtDirection) => TYPE_PAIR_IDS.find((id) => TYPE_PAIRS[id].directions.includes(direction)) ?? TYPE_PAIR_IDS[0];

export function kitFor(direction: ArtDirection, palette?: Partial<Record<PaletteRole, string>>): BrandKit {
  const base = hydrotrailBrandKit;
  const colours = Object.fromEntries(
    (Object.keys(base.palette) as PaletteRole[]).map((role) => [role, { ...base.palette[role], hex: palette?.[role] ?? base.palette[role].hex }]),
  ) as BrandKit["palette"];
  return { ...base, palette: colours, visualSystem: { ...base.visualSystem, direction }, type: { ...base.type, pair: pairFor(direction) } };
}

export type Layouts = { hero?: string; promises?: string; how_it_works?: string; app_preview?: string; waitlist?: string; footer?: string };

/** The hydrotrail spec with each section on the direction's first allowed layout, then `layouts` on top. */
export function specWith(direction: ArtDirection, layouts: Layouts = {}): LandingSpec {
  const s = hydrotrailLandingSpec;
  const first = (section: keyof Layouts) => layouts[section] ?? DIRECTION_LAYOUTS[direction][section][0];
  return {
    ...s,
    hero: { ...s.hero, layout: first("hero") as LandingSpec["hero"]["layout"] },
    promises: s.promises && { ...s.promises, layout: first("promises") as NonNullable<LandingSpec["promises"]>["layout"] },
    how_it_works: s.how_it_works && { ...s.how_it_works, layout: first("how_it_works") as NonNullable<LandingSpec["how_it_works"]>["layout"] },
    app_preview: s.app_preview && { ...s.app_preview, layout: first("app_preview") as NonNullable<LandingSpec["app_preview"]>["layout"] },
    waitlist: { ...s.waitlist, layout: first("waitlist") as LandingSpec["waitlist"]["layout"] },
    footer: { ...s.footer, layout: first("footer") as LandingSpec["footer"]["layout"] },
  };
}

/** Every (direction, section, layout) the contract allows, as one spec each. */
export const MATRIX = (Object.keys(DIRECTION_LAYOUTS) as ArtDirection[]).flatMap((direction) =>
  (Object.entries(DIRECTION_LAYOUTS[direction]) as [keyof Layouts, readonly string[]][]).flatMap(([section, layouts]) =>
    layouts.map((layout) => ({ name: `${direction} / ${section} / ${layout}`, direction, layouts: { [section]: layout } as Layouts })),
  ),
);
