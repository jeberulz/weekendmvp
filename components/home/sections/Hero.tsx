import { SignupCta } from "@/components/marketing/SignupCta";
import type { HeroIdea } from "@/lib/home/types";
import { HeroBuildWindow } from "../client/HeroBuildWindow";
import { Icon } from "../icons";
import { ButtonLink, Container, Em, Stamp, buttonClass } from "../ui";

/** 01 · Prompt to product. */
export function Hero({ idea, total }: { idea: HeroIdea; total: number }) {
  return (
    <section aria-labelledby="home-hero-title" className="relative overflow-hidden bg-home-paper">
      <div aria-hidden className="home-dots absolute inset-0 opacity-60" />
      <Container className="relative flex flex-col items-center gap-[18px] pt-28 text-center md:gap-[22px] md:pt-36">
        <p className="inline-flex h-[30px] items-center gap-2 whitespace-nowrap rounded-full border border-home-rule bg-home-card px-3 font-mono text-[10.5px] tracking-[0.03em] text-home-ink-2 md:h-[34px] md:px-3.5 md:text-xs md:tracking-[0.04em]">
          <span aria-hidden className="size-1.5 rounded-full bg-home-orange md:size-[7px]" />
          {total} IDEAS · EVERY ONE WITH BUILD PROMPTS
        </p>
        <h1
          id="home-hero-title"
          className="max-w-[1000px] font-editorial text-[44px] font-normal leading-[1.02] tracking-[-0.03em] text-home-ink md:text-[60px] lg:text-[76px] lg:leading-none"
        >
          Pick an idea. Paste the prompt. <Em>Ship it by Sunday.</Em>
        </h1>
        <p className="max-w-[640px] text-base leading-[1.55] text-home-ink-2 md:text-xl">
          Researched startup ideas sized for one weekend, with copy-paste prompts for the AI tools you already use. Keep your job.
        </p>
        <div className="flex w-full flex-col gap-2.5 pt-1 sm:w-auto sm:flex-row sm:gap-3.5">
          <ButtonLink href="/startup-ideas">Browse {total} ideas</ButtonLink>
          <SignupCta buttonLocation="home-hero" className={buttonClass("secondary", "px-[22px] font-medium")}>
            <Icon name="kit" size={20} accent="currentColor" />
            Get the free Starter Kit
          </SignupCta>
        </div>
      </Container>
      <Container className="relative pb-12 pt-[72px] md:pb-16 lg:pb-0 lg:pt-16">
        <div className="relative lg:mx-10 lg:h-[456px]">
          <HeroBuildWindow idea={idea} total={total} />
          <Stamp
            id="home-hero-stamp"
            text="RESEARCHED · WEEKEND-SIZED · "
            className="absolute -top-[58px] right-1 size-[72px] lg:-left-16 lg:-top-16 lg:right-auto lg:size-[120px]"
          />
        </div>
      </Container>
    </section>
  );
}
