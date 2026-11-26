import type { ReactNode } from "react";
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
import { guideSpec as spec } from "./guide.spec";
import { guideCopy, selfCheckItems, type GuideCopySlot } from "./guideCopy";

/** Typed to this guide's deck, so a misspelt static slot is a compile error. */
function GuideCopy({ slot, ideaCount }: { slot: GuideCopySlot; ideaCount?: number }) {
  return <SharedGuideCopy deck={guideCopy} slot={slot} ideaCount={ideaCount} />;
}

type HonestCatchSection<Slot> = Slot extends `${infer Section} · Honest catch` ? Section : never;

function HonestCatch({ section }: { section: HonestCatchSection<GuideCopySlot> }) {
  return <SharedHonestCatch deck={guideCopy} section={section} />;
}

function Section({ index, children }: { index: number; children: ReactNode }) {
  return <GuideSection spec={spec} index={index}>{children}</GuideSection>;
}

/* Section 1 stays guide-specific: its pull quotes and definition list are this guide's own words. */
export function GuideOpening() {
  return (
    <Section index={0}>
      <GuideCopy slot="The Shift · Lede" />
      <PullQuote>AI just made building an app free. It didn&apos;t make knowing what to build any easier.</PullQuote>
      <GuideCopy slot="The Shift · Validation paragraph" />
      <h3>Your 9-to-5 is the edge</h3>
      <GuideCopy slot="The Shift · Your expertise" />
      <h3>What a 5-to-9 builder is, and isn&apos;t</h3>
      <GuideCopy slot="The Shift · Definition" />
      <ul className="guide-definition border-y border-home-rule">
        <li><span>Not</span> quitting</li>
        <li><span>Not</span> a course</li>
        <li><span>Not</span> “build an app in a weekend”</li>
      </ul>
      <PullQuote>Your 9-to-5 pays the bills. Your 5-to-9 builds the future.</PullQuote>
      <HonestCatch section="The Shift" />
    </Section>
  );
}

export function GuideLessons({ ideaCount }: { ideaCount: number }) {
  return (
    <div className="guide-reading-grid">
      <article className="guide-measure">
        <Section index={1}>
          <GuideCopy slot="The Method · Lede" />
          <StepsBlock spec={spec} deck={guideCopy} />
          <HonestCatch section="The Method" />
        </Section>

        <Section index={2}>
          <GuideCopy slot="The 6 Skills · Lede" />
          <SkillsBlock spec={spec} deck={guideCopy} />
          <HonestCatch section="The 6 Skills" />
        </Section>

        <Section index={3}>
          <GuideCopy slot="The Catch · Lede" />
          {(["Most ideas won't work", "Time is the real constraint", "What validation can't tell you"] as const).map((heading) => (
            <div key={heading}><h3>{heading}</h3><GuideCopy slot={heading} /></div>
          ))}
        </Section>

        <Section index={4}>
          <GuideCopy slot="Where You're Starting From · Lede" />
          <RolesBlock spec={spec} deck={guideCopy} />
          <HonestCatch section="Where You're Starting From" />
        </Section>

        <Section index={5}>
          <GuideCopy slot="The 30-Day Plan · Lede" />
          <WeeksBlock spec={spec} deck={guideCopy} />
          <HonestCatch section="The 30-Day Plan" />
        </Section>

        <UpsellCard spec={spec} placement="mid" />

        <Section index={6}>
          <GuideCopy slot="The Idea Bank · How to use the library" ideaCount={ideaCount} />
          <Receipt kind="Live count" amount={ideaCount} source="WeekendMVP idea library, live count">researched startup ideas in the library.</Receipt>
          <h3>One worked validation: Repair Estimate Translator</h3>
          <GuideCopy slot="Repair Estimate Translator · Worked validation" />
          <Link href="/ideas/auto-repair-estimate-translator" className="guide-idea-link rounded-[10px] border border-home-rule bg-home-card">
            <Eyebrow>Idea page</Eyebrow>
            <strong>Repair Estimate Translator</strong>
            <span className="text-sm text-home-orange-ink">Open the idea page →</span>
          </Link>
          <HonestCatch section="The Idea Bank" />
        </Section>

        <Section index={7}>
          <GuideCopy slot="The First Sale · Lede" />
          <Receipt kind="Price" amount="$29" source="A working example, not a benchmark">first paid offer.</Receipt>
          {(["The offer", "The price", "The ask", "First-sale scripts"] as const).map((slot) => <GuideCopy key={slot} slot={slot} />)}
          <h3>When nobody buys</h3>
          <GuideCopy slot="The First Sale · When nobody buys" />
          <HonestCatch section="The First Sale" />
        </Section>

        <Section index={8}>
          <GuideCopy slot="Self-Check · Lede" />
          <GuideChecklist items={selfCheckItems} storageKey={spec.checklistKey} />
          <HonestCatch section="Self-Check" />
        </Section>

        <Section index={9}>
          <GuideCopy slot="The Prompt · Lede" />
          <GuidePrompt prompt={guideCopy["The Prompt · Prompt text"]} fileName={spec.promptFileName} />
          <HonestCatch section="The Prompt" />
          <FounderNote spec={spec} deck={guideCopy} />
        </Section>
      </article>
      <aside className="guide-rail">
        <Eyebrow>What&apos;s inside</Eyebrow>
        <ContentsLinks sections={navSections(spec)} />
      </aside>
    </div>
  );
}

export function GuideClose({ ideaCount }: { ideaCount: number }) {
  return (
    <div className="guide-dark guide-close">
      <div className="guide-measure">
        <section aria-labelledby="builder-close-title" className="guide-section">
          <Eyebrow dark>{spec.title}</Eyebrow>
          <h2 id="builder-close-title">Turn your 9-to-5 expertise into a tested side income.</h2>
          <p className="guide-lede">One tested idea, then one first sale.</p>
          <div className="guide-swap guide-day-one">
            <span className="guide-pending">Day 1 of the 5-to-9 Starter should be in your inbox in a few minutes.</span>
            <span className="guide-confirmed">Day 1 of the 5-to-9 Starter is on its way.</span>
            <span className="guide-returning">The 5-to-9 Starter: five daily emails, one action a day.</span>
          </div>
          <div className="guide-card-grid">
            <UpsellCard spec={spec} placement="close" />
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
        <Section index={10}>
          <FaqBlock spec={spec} deck={guideCopy} ideaCount={ideaCount} />
          <p className="mt-8 font-editorial text-2xl">Follow for one idea a day.</p>
          <p data-copy-slot="Sign-off · Follow destination">
            Follow <a href="https://www.instagram.com/weekendmvp/" rel="noopener noreferrer">@weekendmvp</a> on Instagram
          </p>
        </Section>
      </div>
    </div>
  );
}
