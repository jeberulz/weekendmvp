import type { ReactNode } from "react";

import { JsonLd } from "@/components/primitives/JsonLd";
import { newsreaderEditorial } from "@/lib/fonts";

import { GuideContents, GuideHero } from "./blocks";
import { GUIDE_BOOTSTRAP } from "./bootstrap";
import { slotText } from "./copy";
import { GuideGate, GuideNavigation } from "./GuideInteractions";
import { buildGuideSchema } from "./seo";
import type { GuideDeck, GuideNavSection, GuideSpec } from "./types";
import "./guide.css";

/** The serialisable slice of the sections list. Summaries can be functions, so they stay on the server. */
export function navSections(spec: GuideSpec): GuideNavSection[] {
  return spec.sections.map(({ id, title }) => ({ id, title }));
}

/**
 * Page frame shared by every guide: bootstrap, JSON-LD, skip link, navigation, hero, contents,
 * gate and the gated body. `opening` renders before the gate, `lessons` and `close` after it.
 */
export function GuideLayout({
  spec,
  deck,
  ideaCount,
  opening,
  lessons,
  close,
}: {
  spec: GuideSpec;
  deck: GuideDeck;
  ideaCount: number;
  opening: ReactNode;
  lessons: ReactNode;
  close: ReactNode;
}) {
  return (
    <div lang={spec.lang} className={`builder-guide bg-home-paper text-home-ink ${newsreaderEditorial.variable}`} suppressHydrationWarning>
      {/* Parser-blocking and before all visible guide markup. The flag belongs
          to this wrapper so client navigation cannot affect other routes. */}
      <script id="builder-guide-bootstrap" dangerouslySetInnerHTML={{ __html: GUIDE_BOOTSTRAP }} />
      <JsonLd schema={buildGuideSchema(spec)} />
      <a href="#builder-main" className="sr-only focus:not-sr-only guide-skip">Skip to content</a>
      <GuideNavigation title={spec.title} sections={navSections(spec)} />
      <main id="builder-main">
        <GuideHero spec={spec} />
        <div className="guide-measure">
          <GuideContents spec={spec} ideaCount={ideaCount} />
          {opening}
        </div>
        <GuideGate config={spec.gate} utmCampaign={spec.utmCampaign} finePrint={slotText(deck, spec.gate.finePrintSlot)} />
        <div className="guide-rest">
          {lessons}
          {close}
        </div>
        <span id="builder-guide-end" aria-hidden="true" />
      </main>
    </div>
  );
}
