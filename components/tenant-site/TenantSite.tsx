import type { ReactNode } from "react";
import {
  SECTION_ANCHORS,
  TYPE_PAIRS,
  TYPE_PAIR_IDS,
  landingSections,
  type BrandKit,
  type LandingSpec,
  type TypePairId,
} from "@/lib/workspace/contracts/artifacts";
import { TENANT_FONTS } from "./fonts";
import { PLATFORM_TEXT } from "./platform-text";
import { AppPreview, Footer, HowItWorks, Hero, ICON_WEIGHTS, Nav, Promises, WaitlistSection, cx, resolveLayout } from "./sections";
import { tenantStyle } from "./styles";
import { deriveTheme } from "./theme";
import s from "./tenant-site.module.css";

export type TenantSiteProps = {
  spec: LandingSpec;
  kit: BrandKit;
  /** The footer year is the platform's: the route passes it so the component reads no clock. */
  platform: { year: number };
  /** S5b's waitlist form. Without it the section shows a disabled shell that posts nowhere. */
  waitlistSlot?: ReactNode;
  /** Also theme the page's scrollbar and `color-scheme` (the route sets this; a preview frame does not). */
  themeDocument?: boolean;
};

function typePairFor(kit: BrandKit, direction: string): TypePairId {
  const asked: unknown = kit.type?.pair;
  const known = TYPE_PAIR_IDS.find((id) => id === asked);
  return known ?? TYPE_PAIR_IDS.find((id) => TYPE_PAIRS[id].directions.some((d) => d === direction)) ?? TYPE_PAIR_IDS[0];
}

/**
 * A founder's landing page: a `LandingSpec` drawn through fixed section components in a brand kit's art direction.
 * A server component with no client JS, no HTML from the model and no script. The model's text only ever lands as
 * React text; links, layouts, type pair and icons are checked against closed lists; colours come from `deriveTheme`.
 *
 * Callers must pass values already parsed by `landingSpecSchema` and `brandKitSchema`: the renderer guards what
 * reaches HTML, CSS and links, but does not re-validate shape, and a missing `nav` or a null kit throws.
 */
export function TenantSite({ spec, kit, platform, waitlistSlot, themeDocument = false }: TenantSiteProps) {
  const theme = deriveTheme(kit);
  const pairId = typePairFor(kit, theme.direction);
  const style = tenantStyle(theme, TENANT_FONTS[pairId], TYPE_PAIRS[pairId].heading.defaultWeight, themeDocument);
  const { direction } = theme;
  const anchors = new Set<string>(landingSections(spec).map((key) => SECTION_ANCHORS[key]));
  const weight = ICON_WEIGHTS[direction];

  return (
    <div
      className={cx(s.root, TENANT_FONTS[pairId].classNames, style.scope)}
      data-direction={direction}
      data-shape={theme.shape}
      data-density={theme.density}
      data-theme={theme.mode}
    >
      <style>{style.css}</style>
      <a className={s.skip} href="#main">{PLATFORM_TEXT.skipLink}</a>
      <Nav nav={spec.nav} anchors={anchors} />
      <main id="main">
        <Hero hero={spec.hero} layout={resolveLayout("hero", spec.hero.layout, direction)} anchors={anchors} />
        {spec.promises ? <Promises promises={spec.promises} layout={resolveLayout("promises", spec.promises.layout, direction)} weight={weight} /> : null}
        {spec.how_it_works ? <HowItWorks how={spec.how_it_works} layout={resolveLayout("how_it_works", spec.how_it_works.layout, direction)} /> : null}
        {spec.app_preview ? <AppPreview app={spec.app_preview} layout={resolveLayout("app_preview", spec.app_preview.layout, direction)} anchors={anchors} /> : null}
        <WaitlistSection waitlist={spec.waitlist} layout={resolveLayout("waitlist", spec.waitlist.layout, direction)} slot={waitlistSlot} />
      </main>
      <Footer footer={spec.footer} layout={resolveLayout("footer", spec.footer.layout, direction)} year={platform.year} anchors={anchors} />
    </div>
  );
}
