import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Lock } from "lucide-react";

import { Eyebrow } from "@/components/home/ui";
import { cn } from "@/lib/utils";

import { ContentsLinks, GuideChecklist, GuidePrompt, SprintLink } from "./GuideInteractions";
import { BUILD_ALONG_PRICE, GUIDE_HEADLINE, GUIDE_TITLE, SECTIONS } from "./guideContent";
import { HERO_IMAGE_SRC } from "./heroImageData";

const META = [
  ["Free", "guide"],
  ["5 steps", "to a tested idea"],
  ["1", "first sale"],
  ["30 days", ""],
];

function CopyToWrite({ slot }: { slot: string }) {
  return <div className="guide-placeholder" data-copy-slot={slot}>COPY TO WRITE <span>{slot}</span></div>;
}

function Section({ index, children }: { index: number; children: ReactNode }) {
  const { id, title } = SECTIONS[index];
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="guide-section">
      <Eyebrow className="guide-section-number">{id.slice(1)}</Eyebrow>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

function PullQuote({ children }: { children: string }) {
  return <figure className="guide-quote"><p>“{children}”</p></figure>;
}

function HonestCatch({ section }: { section: string }) {
  return (
    <aside aria-label="The honest catch" className="guide-catch bg-home-sunk text-home-ink">
      <Eyebrow className="text-home-ink-2">The honest catch</Eyebrow>
      <CopyToWrite slot={`${section} · Honest catch`} />
    </aside>
  );
}

function Receipt({ kind, amount, children, source }: { kind: string; amount: string | number; children: ReactNode; source: string }) {
  return (
    <aside role="note" aria-label="Receipt" className="guide-receipt rounded-md border border-home-rule bg-home-card text-home-ink">
      <div className="flex justify-between gap-3"><Eyebrow>Receipt</Eyebrow><Eyebrow>{kind}</Eyebrow></div>
      <p><strong className="font-editorial text-2xl font-medium">{amount}</strong> {children}</p>
      <p className="border-t border-dashed border-home-rule pt-2 font-mono text-xs text-home-ink-3">{source}</p>
    </aside>
  );
}

export function GuideHero() {
  return (
    <section aria-labelledby="builder-hero-title" className="guide-hero">
      <div className="min-w-0">
        <Eyebrow>Free guide · WeekendMVP</Eyebrow>
        <h1 id="builder-hero-title">{GUIDE_HEADLINE}</h1>
        <p className="guide-lede">Turn your 9-to-5 expertise into a tested side income: one tested idea, then one first sale.</p>
        <ul className="guide-meta" aria-label="Free guide · 5 steps to a tested idea · 1 first sale · 30 days">
          {META.map(([value, label]) => (
            <li key={value}><strong>{value}</strong>{label && <span>{label}</span>}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a className="guide-pill" href="#s01">Start reading</a>
          <div className="guide-hero-notes text-sm text-home-ink-3">
            <p className="guide-locked-note">Section 1 is open. One email opens the rest.</p>
            <p className="guide-subscribed-note">The whole guide is open on this device.</p>
          </div>
        </div>
      </div>
      <Image
        className="guide-hero-image"
        src={HERO_IMAGE_SRC}
        alt="Placeholder hero for John's working photo. An illustration of a late-night desk with a laptop, notebook and coffee."
        width={640}
        height={800}
        unoptimized
      />
    </section>
  );
}

export function GuideContents({ ideaCount }: { ideaCount: number }) {
  return (
    <nav className="guide-section" aria-labelledby="builder-inside-title">
      <Eyebrow>What&apos;s inside</Eyebrow>
      <h2 id="builder-inside-title">Eleven sections. One tested idea at the end.</h2>
      <ol className="guide-toc">
        {SECTIONS.map(({ id, title, summary }, index) => {
          const description = typeof summary === "function" ? summary(ideaCount) : summary;
          const body = <><span className="font-mono text-xs text-home-orange-ink">{id.slice(1)}</span><span><strong>{title}</strong><span className="block text-sm font-normal text-home-ink-2">{description}</span></span></>;
          return (
            <li key={id}>
              {index > 0 && (
                <a href="#gate" className="guide-toc-row guide-when-locked">
                  {body}<span className="guide-toc-tag"><Lock size={12} aria-hidden="true" />After the email</span>
                </a>
              )}
              <a href={`#${id}`} className={cn("guide-toc-row", index > 0 && "guide-unless-locked")}>
                {body}<span className="guide-toc-tag">{index === 0 ? "Free" : "Read"}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function GuideOpening() {
  return (
    <Section index={0}>
      <CopyToWrite slot="The Shift · Lede" />
      <PullQuote>AI just made building an app free. It didn&apos;t make knowing what to build any easier.</PullQuote>
      <CopyToWrite slot="The Shift · Validation paragraph" />
      <aside role="note" aria-label="Receipt">
        <Eyebrow>Receipt</Eyebrow>
        <CopyToWrite slot="The Shift · Source for the building-is-free claim" />
      </aside>
      <h3>Your 9-to-5 is the edge</h3>
      <CopyToWrite slot="The Shift · Your expertise" />
      <h3>What a 5-to-9 builder is, and isn&apos;t</h3>
      <CopyToWrite slot="The Shift · Definition" />
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

const STEPS = ["Find it", "Who pays?", "Pick it", "Prove it", "Sell it"];
const SKILLS = [
  "Spot problems in your own week",
  "The 3-person test",
  "The 10-minute scorecard",
  "The proof test",
  "The first offer",
  "Pricing and the honest catch",
];
const START_LINES = ["Designer", "Developer", "Ops & marketing", "Non-technical"];
const WEEKS = ["Find it, test it on 3 people.", "Scorecard, pick one.", "Proof test.", "First offer, first sale."];

function SprintCard({ placement }: { placement: "mid" | "close" }) {
  return (
    <aside aria-label="Build-Along sprint" className={cn("guide-dark-card guide-dark", placement === "mid" && "guide-mid-card")}>
      <div>
        <Eyebrow dark>Paid · Live</Eyebrow>
        <h3>Do this live with John</h3>
        <p>The <strong className={placement === "mid" ? "text-2xl font-medium text-home-orange" : undefined}>{BUILD_ALONG_PRICE}</strong> Build-Along sprint. Two hours, live.</p>
      </div>
      <SprintLink placement={placement} />
    </aside>
  );
}

export function GuideLessons({ ideaCount }: { ideaCount: number }) {
  return (
    <div className="guide-reading-grid">
      <article className="guide-measure">
        <Section index={1}>
          <CopyToWrite slot="The Method · Lede" />
          <ol className="guide-steps">
            {STEPS.map((step, index) => (
              <li key={step}>
                <span aria-hidden="true" className="guide-step-number">{index + 1}</span>
                <div className="min-w-0">
                  <h3>{step}</h3>
                  <CopyToWrite slot={`${step} · Reasoning`} />
                  <CopyToWrite slot={`${step} · Common mistakes`} />
                  <CopyToWrite slot={`${step} · Worked example`} />
                  {step === "Prove it" && <PullQuote>Ten minutes of proof beats ten weeks of building.</PullQuote>}
                </div>
              </li>
            ))}
          </ol>
          <HonestCatch section="The Method" />
        </Section>

        <Section index={2}>
          <CopyToWrite slot="The 6 Skills · Lede" />
          {SKILLS.map((skill, index) => (
            <div key={skill}>
              <h3>{index + 1} · {skill}</h3>
              <CopyToWrite slot={`${skill} · Explanation`} />
              <div className="guide-ready">
                <Eyebrow className="text-home-ink-2">You&apos;re ready when…</Eyebrow>
                <CopyToWrite slot={`${skill} · Readiness test`} />
              </div>
            </div>
          ))}
          <HonestCatch section="The 6 Skills" />
        </Section>

        <Section index={3}>
          <CopyToWrite slot="The Catch · Lede" />
          {["Most ideas won't work", "Time is the real constraint", "What validation can't tell you"].map((heading) => (
            <div key={heading}><h3>{heading}</h3><CopyToWrite slot={heading} /></div>
          ))}
        </Section>

        <Section index={4}>
          <CopyToWrite slot="Where You're Starting From · Lede" />
          <div className="guide-card-grid">
            {START_LINES.map((role) => (
              <div key={role} className="rounded-[10px] border border-home-rule bg-home-card p-4">
                <h3>{role}</h3>
                <dl>{["Head start", "Gap", "Lean on"].map((label) => (
                  <div key={label}><dt className="mt-3 font-mono text-xs uppercase text-home-ink-3">{label}</dt><dd><CopyToWrite slot={`${role} · ${label}`} /></dd></div>
                ))}</dl>
              </div>
            ))}
          </div>
          <HonestCatch section="Where You're Starting From" />
        </Section>

        <Section index={5}>
          <CopyToWrite slot="The 30-Day Plan · Lede" />
          <ol className="guide-weeks">
            {WEEKS.map((week, index) => (
              <li key={week}>
                <Eyebrow>Week {index + 1}</Eyebrow>
                <div><p>{week}</p><CopyToWrite slot={`Week ${index + 1} · Shipped proof`} /></div>
              </li>
            ))}
          </ol>
          <HonestCatch section="The 30-Day Plan" />
        </Section>

        <SprintCard placement="mid" />

        <Section index={6}>
          <CopyToWrite slot="The Idea Bank · How to use the library" />
          <Receipt kind="Live count" amount={ideaCount} source="Homepage liveIdeas rule · re-checked at build">researched startup ideas in the library.</Receipt>
          <h3>One worked validation: Repair Estimate Translator</h3>
          <CopyToWrite slot="Repair Estimate Translator · Worked validation" />
          <Link href="/ideas/auto-repair-estimate-translator" className="guide-idea-link rounded-[10px] border border-home-rule bg-home-card">
            <Eyebrow>Idea page</Eyebrow>
            <strong>Repair Estimate Translator</strong>
            <span className="text-sm text-home-orange-ink">Open the idea page →</span>
          </Link>
          <HonestCatch section="The Idea Bank" />
        </Section>

        <Section index={7}>
          <CopyToWrite slot="The First Sale · Lede" />
          <Receipt kind="Price" amount="£29" source="5-day guide draft, Day 5">first paid offer.</Receipt>
          {["The offer", "The price", "The ask", "First-sale scripts"].map((slot) => <CopyToWrite key={slot} slot={slot} />)}
          <h3>When nobody buys</h3>
          <CopyToWrite slot="The First Sale · When nobody buys" />
          <HonestCatch section="The First Sale" />
        </Section>

        <Section index={8}>
          <CopyToWrite slot="Self-Check · Lede" />
          <GuideChecklist />
          <HonestCatch section="Self-Check" />
        </Section>

        <Section index={9}>
          <CopyToWrite slot="The Prompt · Lede" />
          <GuidePrompt />
          <HonestCatch section="The Prompt" />
          <aside aria-label="A note from the founder" className="guide-founder">
            <Eyebrow>A note from the founder</Eyebrow>
            <CopyToWrite slot="Founder note · Body" />
            <p className="font-editorial text-2xl italic">John Iseghohi</p>
          </aside>
        </Section>
      </article>
      <aside className="guide-rail">
        <Eyebrow>What&apos;s inside</Eyebrow>
        <ContentsLinks />
      </aside>
    </div>
  );
}

const FAQ = [
  "Who is this for?",
  "I have no idea yet. Where do I start?",
  "Do I need to code?",
  "What if nobody buys?",
  "What does the 5-day email add?",
];

export function GuideClose({ ideaCount }: { ideaCount: number }) {
  return (
    <div className="guide-dark guide-close">
      <div className="guide-measure">
        <section aria-labelledby="builder-close-title" className="guide-section">
          <Eyebrow dark>{GUIDE_TITLE}</Eyebrow>
          <h2 id="builder-close-title">Turn your 9-to-5 expertise into a tested side income.</h2>
          <p className="guide-lede">One tested idea, then one first sale.</p>
          <div className="guide-swap guide-day-one">
            <span className="guide-pending">Day 1 of the 5-to-9 Starter should be in your inbox in a few minutes.</span>
            <span className="guide-confirmed">Day 1 of the 5-to-9 Starter is on its way.</span>
            <span className="guide-returning">The 5-to-9 Starter: five daily emails, one action a day.</span>
          </div>
          <div className="guide-card-grid">
            <SprintCard placement="close" />
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
          {FAQ.map((question) => (
            <details key={question} className="guide-faq">
              <summary>{question}<span aria-hidden="true" /></summary>
              <CopyToWrite slot={`FAQ · ${question}`} />
            </details>
          ))}
          <p className="mt-8 font-editorial text-2xl">Follow for one idea a day.</p>
          <CopyToWrite slot="Sign-off · Follow destination" />
        </Section>
      </div>
    </div>
  );
}
