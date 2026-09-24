import Link from "next/link";
import type { ReactNode } from "react";

import { GOAL_LABEL } from "@/lib/home/labels";
import type { InsideIdea } from "@/lib/home/types";
import { clamp, leadSentences, shortNumber, tierName } from "@/lib/home/text";
import { cn } from "@/lib/utils";
import { Icon } from "../icons";
import { Container, Em, Eyebrow, StepList } from "../ui";

function Tile({
  num,
  name,
  tone = "card",
  className,
  children,
}: {
  num: string;
  name: string;
  tone?: "card" | "ink" | "orange";
  className?: string;
  children: ReactNode;
}) {
  const skin = {
    card: "border-home-rule bg-home-card text-home-ink",
    ink: "border-home-ink bg-home-ink text-home-d1",
    orange: "border-home-orange-ink bg-home-orange-ink text-white",
  }[tone];
  const label = { card: "text-home-ink-3", ink: "text-home-d3", orange: "text-[#ffe3cf]" }[tone];
  return (
    <article className={cn("flex flex-col gap-3 rounded-[18px] border p-5 lg:gap-3.5 lg:rounded-[20px] lg:p-6", skin, className)}>
      <h3 className={cn("font-mono text-[10.5px] font-normal uppercase tracking-[0.08em] lg:text-[11px]", label)}>
        {num} · {name}
      </h3>
      {children}
    </article>
  );
}

/** 06 · Real excerpts from this week's idea page (a different idea from 03). */
export function InsideEveryIdea({ idea, weekLabel }: { idea: InsideIdea; weekLabel: string }) {
  const quote = leadSentences(idea.problem, 2, 190);
  return (
    <section aria-labelledby="home-inside-title" className="bg-home-paper py-14 lg:py-24">
      <Container className="flex flex-col gap-7 lg:gap-11">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3.5 lg:gap-4">
            <Eyebrow>Inside every idea · {weekLabel}</Eyebrow>
            <h2 id="home-inside-title" className="font-editorial text-[40px] font-normal leading-[1.02] tracking-[-0.025em] text-home-ink lg:text-[72px] lg:leading-[1.06] lg:tracking-[-0.02em]">
              Real research.
              <br className="lg:hidden" /> <Em>Not a vibe.</Em>
            </h2>
          </div>
          <p className="text-base leading-[1.55] text-home-ink-2 lg:max-w-[380px] lg:text-[17px]">
            Every idea page follows the same seven sections, plus its sources. These excerpts come from this week&rsquo;s pick:{" "}
            {idea.shortTitle}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 lg:gap-5">
          {quote && (
            <Tile num="01" name="The Problem" className="lg:col-span-2">
              <blockquote className={cn("font-editorial leading-[1.2] tracking-[-0.01em]", quote.length < 110 ? "text-[28px] lg:text-[34px]" : "text-[23px] lg:text-[26px]")}>
                “{quote}”
              </blockquote>
            </Tile>
          )}
          {idea.how.length > 0 && (
            <Tile num="02" name="The Solution">
              <StepList steps={idea.how} className="gap-2.5 [&_li]:text-[15px]" />
            </Tile>
          )}
          {idea.market.length > 0 && (
            <Tile num="03" name="Market Research" className="lg:row-span-2">
              <dl className="flex flex-col">
                {idea.market.map((m, i) => (
                  <div key={m.value + i} className={cn("flex flex-col-reverse gap-1.5 py-3.5", i > 0 && "border-t border-home-rule")}>
                    <dd className="text-sm leading-[1.45] text-home-ink-2">{clamp(leadSentences(m.text, 1, 400), 120)}</dd>
                    <dt className={cn("font-editorial leading-[0.95] tracking-[-0.03em]", i === 0 ? "text-5xl lg:text-[56px]" : "text-[34px] lg:text-[40px]")}>
                      {shortNumber(m.value)}
                    </dt>
                  </div>
                ))}
              </dl>
            </Tile>
          )}
          {idea.competitors.length > 0 && (
            <Tile num="04" name="Competitive Landscape" className="lg:col-span-2">
              <ul>
                {idea.competitors.map((c) => (
                  <li key={c.name} className="flex justify-between gap-4 border-t border-home-rule py-2 text-sm lg:py-[7px] lg:text-[15px]">
                    <span className="truncate">{clamp(c.name, 40)}</span>
                    <span className="shrink-0 font-mono text-xs text-home-ink-2 lg:text-[13px]">{c.price}</span>
                  </li>
                ))}
              </ul>
            </Tile>
          )}
          {idea.tiers.length > 0 && (
            <Tile num="05" name="Business Model">
              <ul>
                {idea.tiers.map((t) => (
                  <li key={t.name} className="flex items-baseline justify-between gap-3 border-t border-home-rule py-2">
                    <span className="truncate text-sm text-home-ink-2">{tierName(t.name)}</span>
                    <span className="shrink-0 font-editorial text-[28px] leading-none lg:text-[30px]">{t.price}</span>
                  </li>
                ))}
              </ul>
              <p className="font-mono text-[11px] tracking-[0.06em] text-home-orange-ink lg:text-xs">
                GOAL {(GOAL_LABEL[idea.revenueGoal] ?? "").toUpperCase()}
              </p>
            </Tile>
          )}
          {idea.stack.length > 0 && (
            <Tile num="06" name="Tech Stack">
              <ul className="flex flex-wrap gap-1.5">
                {idea.stack.map((s) => (
                  <li key={s} className="inline-flex h-7 items-center rounded-lg border border-home-rule bg-home-paper px-2.5 font-mono text-[11.5px] lg:text-xs">
                    {s}
                  </li>
                ))}
              </ul>
            </Tile>
          )}
          {idea.promptTitles.length > 0 && (
            <Tile num="07" name="AI Prompts" tone="ink">
              <StepList steps={idea.promptTitles} dark className="gap-2.5 [&_li]:text-[15px]" />
            </Tile>
          )}
          <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:gap-5">
            <Tile num="08" name="Sources" tone="orange">
              <p className="font-editorial text-[60px] leading-[0.9] text-white lg:text-[72px]">{idea.sources}</p>
              <p className="text-[13px] leading-[1.4] text-[#ffe9da] lg:text-sm">cited sources, linked on the page</p>
            </Tile>
            <Link
              href={`/ideas/${idea.slug}`}
              className="flex flex-col justify-between gap-3.5 rounded-[18px] border border-home-ink p-5 text-home-ink transition-colors hover:bg-home-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink lg:rounded-[20px] lg:p-6"
            >
              <span className="font-mono text-[10.5px] tracking-[0.08em] text-home-ink-3 lg:text-[11px]">THE FULL PAGE</span>
              <span className="flex flex-col gap-2.5">
                <span className="flex items-end justify-between gap-3 font-editorial text-2xl leading-[1.1] lg:text-[28px]">
                  Read the full idea
                  <Icon name="arrow" size={26} className="max-lg:hidden" />
                </span>
                <span className="text-sm leading-[1.4] text-home-ink-2 max-lg:hidden">{clamp(idea.title, 70)}</span>
                <Icon name="arrow" size={24} className="lg:hidden" />
              </span>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
