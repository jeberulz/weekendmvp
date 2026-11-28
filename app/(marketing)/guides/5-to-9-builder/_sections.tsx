import { Fragment, type ReactNode } from "react";
import Link from "next/link";

import { Eyebrow } from "@/components/home/ui";

import {
  FaqBlock,
  FounderNote,
  GuideSection,
  HonestCatch as SharedHonestCatch,
  PullQuote,
  Receipt,
  RolesBlock,
  SkillsBlock,
  StepsBlock,
  UpsellCard,
  WeeksBlock,
} from "../_shared/blocks";
import { GuideCopy as SharedGuideCopy } from "../_shared/copy";
import { GuideChecklist, GuidePrompt, ContentsLinks } from "../_shared/GuideInteractions";
import { navSections } from "../_shared/GuideLayout";
import { guideRuntime } from "./guide.spec";
import type { BuilderGuide, SectionKind } from "@/lib/landing/read-builder-guide";

/* Section 1 stays guide-specific: its pull quotes and definition list are this guide's own words. */
export function GuideOpening({ guide }: { guide: BuilderGuide }) {
  const { spec, deck } = guide;
  return (
    <GuideSection spec={spec} index={0}>
      <SharedGuideCopy deck={deck} slot="The Shift · Lede" />
      <PullQuote>AI just made building an app free. It didn&apos;t make knowing what to build any easier.</PullQuote>
      <SharedGuideCopy deck={deck} slot="The Shift · Validation paragraph" />
      <h3>Your 9-to-5 is the edge</h3>
      <SharedGuideCopy deck={deck} slot="The Shift · Your expertise" />
      <h3>What a 5-to-9 builder is, and isn&apos;t</h3>
      <SharedGuideCopy deck={deck} slot="The Shift · Definition" />
      <ul className="guide-definition border-y border-home-rule">
        <li><span>Not</span> quitting</li>
        <li><span>Not</span> a course</li>
        <li><span>Not</span> “build an app in a weekend”</li>
      </ul>
      <PullQuote>Your 9-to-5 pays the bills. Your 5-to-9 builds the future.</PullQuote>
      <SharedHonestCatch deck={deck} section="The Shift" />
    </GuideSection>
  );
}

function GuideLessons({ guide, ideaCount, kinds, showRail }: {
  guide: BuilderGuide;
  ideaCount: number;
  kinds: readonly Exclude<SectionKind, "faq">[];
  showRail: boolean;
}) {
  const { spec, deck } = guide;
  const sections: Record<Exclude<SectionKind, "faq">, ReactNode> = {
    method: (
      <>
        <SharedGuideCopy deck={deck} slot="The Method · Lede" />
        <StepsBlock spec={spec} deck={deck} />
        <SharedHonestCatch deck={deck} section="The Method" />
      </>
    ),
    skills: (
      <>
        <SharedGuideCopy deck={deck} slot="The 6 Skills · Lede" />
        <SkillsBlock spec={spec} deck={deck} />
        <SharedHonestCatch deck={deck} section="The 6 Skills" />
      </>
    ),
    catch: (
      <>
        <SharedGuideCopy deck={deck} slot="The Catch · Lede" />
        {guide.catchTopics.map((heading) => (
          <div key={heading}><h3>{heading}</h3><SharedGuideCopy deck={deck} slot={heading} /></div>
        ))}
      </>
    ),
    roles: (
      <>
        <SharedGuideCopy deck={deck} slot="Where You're Starting From · Lede" />
        <RolesBlock spec={spec} deck={deck} />
        <SharedHonestCatch deck={deck} section="Where You're Starting From" />
      </>
    ),
    plan: (
      <>
        <SharedGuideCopy deck={deck} slot="The 30-Day Plan · Lede" />
        <WeeksBlock spec={spec} deck={deck} />
        <SharedHonestCatch deck={deck} section="The 30-Day Plan" />
      </>
    ),
    ideaBank: (
      <>
        <SharedGuideCopy deck={deck} slot="The Idea Bank · How to use the library" ideaCount={ideaCount} />
        <Receipt kind="Live count" amount={ideaCount} source="Weekend MVP idea library, live count">researched startup ideas in the library.</Receipt>
        <h3>One worked validation: Repair Estimate Translator</h3>
        <SharedGuideCopy deck={deck} slot="Repair Estimate Translator · Worked validation" />
        <Link href="/ideas/auto-repair-estimate-translator" className="guide-idea-link rounded-[10px] border border-home-rule bg-home-card">
          <Eyebrow>Idea page</Eyebrow>
          <strong>Repair Estimate Translator</strong>
          <span className="text-sm text-home-orange-ink">Open the idea page →</span>
        </Link>
        <SharedHonestCatch deck={deck} section="The Idea Bank" />
      </>
    ),
    firstSale: (
      <>
        <SharedGuideCopy deck={deck} slot="The First Sale · Lede" />
        <Receipt kind="Price" amount="$29" source="A working example, not a benchmark">first paid offer.</Receipt>
        {(["The offer", "The price", "The ask", "First-sale scripts"] as const).map((slot) => <SharedGuideCopy deck={deck} key={slot} slot={slot} />)}
        <h3>When nobody buys</h3>
        <SharedGuideCopy deck={deck} slot="The First Sale · When nobody buys" />
        <SharedHonestCatch deck={deck} section="The First Sale" />
      </>
    ),
    selfCheck: (
      <>
        <SharedGuideCopy deck={deck} slot="Self-Check · Lede" />
        <GuideChecklist items={guide.selfCheckItems} storageKey={spec.checklistKey} />
        <SharedHonestCatch deck={deck} section="Self-Check" />
      </>
    ),
    prompt: (
      <>
        <SharedGuideCopy deck={deck} slot="The Prompt · Lede" />
        <GuidePrompt prompt={deck["The Prompt · Prompt text"]} fileName={spec.promptFileName} />
        <SharedHonestCatch deck={deck} section="The Prompt" />
        <FounderNote spec={spec} deck={deck} />
      </>
    ),
  };
  return (
    <div className="guide-reading-grid">
      <article className="guide-measure">
        {kinds.map((kind) => (
          <Fragment key={kind}>
            <GuideSection spec={spec} index={guide.sectionOrder.indexOf(kind) + 1}>{sections[kind]}</GuideSection>
            {kind === "plan" && <UpsellCard spec={spec} placement="mid" copy={guide.cards.mid} />}
          </Fragment>
        ))}
      </article>
      {showRail && (
        <aside className="guide-rail">
          <Eyebrow>What&apos;s inside</Eyebrow>
          <ContentsLinks sections={navSections(spec)} />
        </aside>
      )}
    </div>
  );
}

export function GuideGatedSections({ guide, ideaCount }: { guide: BuilderGuide; ideaCount: number }) {
  const faqPosition = guide.sectionOrder.indexOf("faq");
  const before = guide.sectionOrder.slice(0, faqPosition).filter((kind) => kind !== "faq");
  const after = guide.sectionOrder.slice(faqPosition + 1).filter((kind) => kind !== "faq");
  return (
    <>
      {before.length > 0 && <GuideLessons guide={guide} ideaCount={ideaCount} kinds={before} showRail />}
      <GuideClose guide={guide} ideaCount={ideaCount} index={faqPosition + 1} />
      {after.length > 0 && <GuideLessons guide={guide} ideaCount={ideaCount} kinds={after} showRail={!before.length} />}
    </>
  );
}

function GuideClose({ guide, ideaCount, index }: { guide: BuilderGuide; ideaCount: number; index: number }) {
  const { spec, deck } = guide;
  return (
    <div className="guide-dark guide-close">
      <div className="guide-measure">
        <section aria-labelledby="builder-close-title" className="guide-section">
          <Eyebrow dark>{spec.title}</Eyebrow>
          <h2 id="builder-close-title">Turn your 9-to-5 expertise into a tested side income.</h2>
          <p className="guide-lede">One tested idea, then one first sale.</p>
          <div className="guide-swap guide-day-one [&_a]:underline [&_a]:underline-offset-4">
            <span className="guide-pending">Day 1 of the <Link href="/5-to-9-starter">5-to-9 Starter</Link> should be in your inbox in a few minutes.</span>
            <span className="guide-confirmed">Day 1 of the <Link href="/5-to-9-starter">5-to-9 Starter</Link> is on its way.</span>
            <span className="guide-returning">The <Link href="/5-to-9-starter">5-to-9 Starter</Link>: five daily emails, one action a day.</span>
          </div>
          <div className="guide-card-grid">
            <UpsellCard spec={spec} placement="close" copy={guide.cards.close} />
            <aside className="guide-dark-card" aria-label="Idea library">
              <div>
                <Eyebrow dark>Free · Library</Eyebrow>
                <h3>Browse {ideaCount} researched ideas</h3>
                <p>Start Step 1 from a researched idea, not a blank page.</p>
              </div>
              <Link href="/startup-ideas" className="guide-pill guide-pill-outline">Browse the ideas</Link>
            </aside>
          </div>
          <p className="guide-close-line">One idea a day, with the honest catch.</p>
        </section>
        <GuideSection spec={spec} index={index}>
          <FaqBlock spec={spec} deck={deck} ideaCount={ideaCount} />
          <p className="mt-8 font-editorial text-2xl">Follow for one idea a day.</p>
          <p data-copy-slot="Sign-off · Follow destination">
            Follow <a href={guideRuntime.followUrl} rel="noopener noreferrer">{guide.followLabel}</a> on Instagram
          </p>
        </GuideSection>
      </div>
    </div>
  );
}
