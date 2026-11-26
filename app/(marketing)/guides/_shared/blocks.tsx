import type { ReactNode } from "react";
import Image from "next/image";
import { Lock } from "lucide-react";

import { Em, Eyebrow } from "@/components/home/ui";
import { cn } from "@/lib/utils";

import { GuideCopy } from "./copy";
import type { GuideDeck, GuideSpec } from "./types";

/*
 * Copy slot naming convention. Blocks read these slots from the deck and throw if one is missing.
 *   Section lede ................ "{Section title} · Lede"
 *   Honest catch ................ "{Section title} · Honest catch"
 *   Step ........................ "{step} · Reasoning" / "· Common mistakes" / "· Worked example"
 *   Skill ....................... "{skill} · Explanation" / "· Readiness test"
 *   Role ........................ "{role} · {label}"
 *   Week ........................ "Week {n} · Shipped proof"
 *   FAQ ......................... "FAQ · {question}"
 *   Founder note ................ "Founder note · Body"
 */

export function GuideSection({ spec, index, children }: { spec: GuideSpec; index: number; children: ReactNode }) {
  const { id, title } = spec.sections[index];
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="guide-section">
      <Eyebrow className="guide-section-number">{id.slice(1)}</Eyebrow>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

export function PullQuote({ children }: { children: string }) {
  return <figure className="guide-quote"><p>“{children}”</p></figure>;
}

export function HonestCatch({ deck, section }: { deck: GuideDeck; section: string }) {
  return (
    <aside aria-label="The honest catch" className="guide-catch bg-home-sunk text-home-ink">
      <Eyebrow className="text-home-ink-2">The honest catch</Eyebrow>
      <GuideCopy deck={deck} slot={`${section} · Honest catch`} />
    </aside>
  );
}

export function Receipt({ kind, amount, children, source }: { kind: string; amount: string | number; children: ReactNode; source: string }) {
  return (
    <aside role="note" aria-label="Receipt" className="guide-receipt rounded-md border border-home-rule bg-home-card text-home-ink">
      <div className="flex justify-between gap-3"><Eyebrow>Receipt</Eyebrow><Eyebrow>{kind}</Eyebrow></div>
      <p><strong className="font-editorial text-2xl font-medium">{amount}</strong> {children}</p>
      <p className="border-t border-dashed border-home-rule pt-2 font-mono text-xs text-home-ink-3">{source}</p>
    </aside>
  );
}

export function GuideHero({ spec }: { spec: GuideSpec }) {
  const { hero, headline } = spec;
  const emphasisStart = headline.indexOf(". ") + 2;

  return (
    <section aria-labelledby="builder-hero-title" className="guide-hero">
      <div className="min-w-0">
        <Eyebrow>{hero.eyebrow}</Eyebrow>
        <h1 id="builder-hero-title">
          {headline.slice(0, emphasisStart)}<Em>{headline.slice(emphasisStart)}</Em>
        </h1>
        <p className="guide-lede">{hero.lede}</p>
        <ul className="guide-meta" aria-label={hero.metaLabel}>
          {hero.meta.map(([value, label]) => (
            <li key={value}><strong>{value}</strong>{label && <span>{label}</span>}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a className="guide-pill" href={`#${spec.sections[0].id}`}>{hero.ctaLabel}</a>
          <div className="guide-hero-notes text-sm text-home-ink-3">
            <p className="guide-locked-note">{hero.lockedNote}</p>
            <p className="guide-subscribed-note">{hero.subscribedNote}</p>
          </div>
        </div>
      </div>
      <Image
        className="guide-hero-image"
        src={hero.image.src}
        alt={hero.image.alt}
        width={hero.image.width}
        height={hero.image.height}
        sizes={hero.image.sizes}
        priority
      />
    </section>
  );
}

export function GuideContents({ spec, ideaCount }: { spec: GuideSpec; ideaCount: number }) {
  return (
    <nav className="guide-section" aria-labelledby="builder-inside-title">
      <Eyebrow>What&apos;s inside</Eyebrow>
      <h2 id="builder-inside-title">{spec.contents.heading}</h2>
      <ol className="guide-toc">
        {spec.sections.map(({ id, title, summary }, index) => {
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

export function StepsBlock({ spec, deck }: { spec: GuideSpec; deck: GuideDeck }) {
  return (
    <ol className="guide-steps">
      {spec.steps.map((step, index) => (
        <li key={step}>
          <span aria-hidden="true" className="guide-step-number">{index + 1}</span>
          <div className="min-w-0">
            <h3>{step}</h3>
            <GuideCopy deck={deck} slot={`${step} · Reasoning`} />
            <GuideCopy deck={deck} slot={`${step} · Common mistakes`} />
            <GuideCopy deck={deck} slot={`${step} · Worked example`} />
            {spec.stepPullQuotes[step] && <PullQuote>{spec.stepPullQuotes[step]}</PullQuote>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SkillsBlock({ spec, deck }: { spec: GuideSpec; deck: GuideDeck }) {
  return (
    <>
      {spec.skills.map((skill, index) => (
        <div key={skill}>
          <h3>{index + 1} · {skill}</h3>
          <GuideCopy deck={deck} slot={`${skill} · Explanation`} />
          <div className="guide-ready">
            <Eyebrow className="text-home-ink-2">You&apos;re ready when…</Eyebrow>
            <GuideCopy deck={deck} slot={`${skill} · Readiness test`} />
          </div>
        </div>
      ))}
    </>
  );
}

export function RolesBlock({ spec, deck }: { spec: GuideSpec; deck: GuideDeck }) {
  return (
    <div className="guide-card-grid">
      {spec.roles.names.map((role) => (
        <div key={role} className="rounded-[10px] border border-home-rule bg-home-card p-4">
          <h3>{role}</h3>
          <dl>{spec.roles.labels.map((label) => (
            <div key={label}><dt className="mt-3 font-mono text-xs uppercase text-home-ink-3">{label}</dt><dd><GuideCopy deck={deck} slot={`${role} · ${label}`} /></dd></div>
          ))}</dl>
        </div>
      ))}
    </div>
  );
}

export function WeeksBlock({ spec, deck }: { spec: GuideSpec; deck: GuideDeck }) {
  return (
    <ol className="guide-weeks">
      {spec.weeks.map(([number, week]) => (
        <li key={number}>
          <Eyebrow>Week {number}</Eyebrow>
          <div><p>{week}</p><GuideCopy deck={deck} slot={`Week ${number} · Shipped proof`} /></div>
        </li>
      ))}
    </ol>
  );
}

export function FaqBlock({ spec, deck, ideaCount }: { spec: GuideSpec; deck: GuideDeck; ideaCount?: number }) {
  return (
    <>
      {spec.faq.map((question) => (
        <details key={question} className="guide-faq">
          <summary>{question}<span aria-hidden="true" /></summary>
          <GuideCopy deck={deck} slot={`FAQ · ${question}`} ideaCount={ideaCount} />
        </details>
      ))}
    </>
  );
}

export function FounderNote({ spec, deck }: { spec: GuideSpec; deck: GuideDeck }) {
  return (
    <aside aria-label="A note from the founder" className="guide-founder">
      <Eyebrow>A note from the founder</Eyebrow>
      <GuideCopy deck={deck} slot="Founder note · Body" />
      <p className="font-editorial text-2xl italic">{spec.founderName}</p>
    </aside>
  );
}
