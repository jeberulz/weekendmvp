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
import { ContentsLinks, GuideChecklist, GuidePrompt } from "../_shared/GuideInteractions";
import { navSections } from "../_shared/GuideLayout";
import { guideSpec as spec } from "./guide.spec";
import { guideCopy, selfCheckItems, type GuideCopySlot } from "./guideCopy";

/** Typed to this guide's deck, so a misspelt static slot is a compile error. */
function GuideCopy({ slot }: { slot: GuideCopySlot }) {
  return <SharedGuideCopy deck={guideCopy} slot={slot} />;
}

type HonestCatchSection<Slot> = Slot extends `${infer Section} · Honest catch` ? Section : never;

function HonestCatch({ section }: { section: HonestCatchSection<GuideCopySlot> }) {
  return <SharedHonestCatch deck={guideCopy} section={section} />;
}

function Section({ index, children }: { index: number; children: ReactNode }) {
  return <GuideSection spec={spec} index={index}>{children}</GuideSection>;
}

/* Section 1 stays guide-specific: its pull quote and paragraphs are this guide's own words. */
export function GuideOpening() {
  return (
    <Section index={0}>
      <GuideCopy slot="The Shift · Lede" />
      <GuideCopy slot="The Shift · What it is" />
      <PullQuote>Typing was never the hard part. Knowing what to check is.</PullQuote>
      <GuideCopy slot="The Shift · The new bottleneck" />
      <HonestCatch section="The Shift" />
    </Section>
  );
}

export function GuideLessons() {
  return (
    <div className="guide-reading-grid">
      <article className="guide-measure">
        <Section index={1}>
          <GuideCopy slot="The Ladder · Lede" />
          <StepsBlock spec={spec} deck={guideCopy} />
        </Section>

        <Section index={2}>
          <GuideCopy slot="The 6 Skills · Lede" />
          <SkillsBlock spec={spec} deck={guideCopy} />
        </Section>

        <Section index={3}>
          <GuideCopy slot="The Catch · Lede" />
          {(["It can say it is done when it is not", "You still review everything", "Fast is not the same as right"] as const).map((heading) => (
            <div key={heading}><h3>{heading}</h3><GuideCopy slot={heading} /></div>
          ))}
        </Section>

        <Section index={4}>
          <GuideCopy slot="Where You're Starting From · Lede" />
          <RolesBlock spec={spec} deck={guideCopy} />
        </Section>

        <Section index={5}>
          <GuideCopy slot="The 30-Day Plan · Lede" />
          <WeeksBlock spec={spec} deck={guideCopy} />
          <HonestCatch section="The 30-Day Plan" />
        </Section>

        <Section index={6}>
          <GuideCopy slot="What I Built · Lede" />
          <GuideCopy slot="What I Built · The record" />
          <Receipt kind="Repo count" amount="200+" source="Idea pages in the weekendmvp.app repository">startup idea pages in the repository.</Receipt>
          <GuideCopy slot="What I Built · The build story" />
          <GuideCopy slot="What I Built · What this does not prove" />
        </Section>

        <Section index={7}>
          <GuideCopy slot="Self-Check · Lede" />
          <GuideChecklist items={selfCheckItems} storageKey={spec.checklistKey} />
        </Section>

        <Section index={8}>
          <GuideCopy slot="The Starter Rules File · Lede" />
          <GuidePrompt prompt={guideCopy["The Starter Rules File · Prompt text"]} fileName={spec.promptFileName} />
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

export function GuideClose() {
  return (
    <div className="guide-dark guide-close">
      <div className="guide-measure">
        <section aria-labelledby="claude-code-close-title" className="guide-section">
          <Eyebrow dark>{spec.title}</Eyebrow>
          <h2 id="claude-code-close-title">Run the routine on one small project.</h2>
          <p className="guide-lede">Rules, a plan, small steps and checks.</p>
          <div className="guide-card-grid">
            <UpsellCard spec={spec} placement="close" />
            <aside className="guide-dark-card" aria-label="More on Claude Code">
              <div>
                <Eyebrow dark>Free · Articles</Eyebrow>
                <h3>Claude Code for non-technical founders</h3>
                <p>A shorter read on starting without a coding background.</p>
              </div>
              <Link href="/articles/claude-code-for-non-technical-founders" className="guide-pill guide-pill-outline">Read the article</Link>
            </aside>
          </div>
        </section>
        <Section index={9}>
          <FaqBlock spec={spec} deck={guideCopy} />
        </Section>
      </div>
    </div>
  );
}
