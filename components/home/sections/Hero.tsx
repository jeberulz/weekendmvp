import { SignupCta } from "@/components/marketing/SignupCta";
import type { HeroIdea } from "@/lib/home/types";
import { HeroBuildWindow } from "../client/HeroBuildWindow";
import { Icon } from "../icons";
import { ButtonLink, Container, Em, IntroWords, Stamp, buttonClass, introDelay } from "../ui";

const LEAD = "Pick an idea. Paste the prompt.";
const PUNCH = "Ship it by Sunday.";
const WORD_STEP = 0.045;

/**
 * 01 · Prompt to product. The intro plays on CSS at first paint (globals.css,
 * WP43): headline word by word, then the copy and buttons, then the build
 * window with its prompt pasting in, and the stamp pressing on last.
 */
export function Hero({ idea, total }: { idea: HeroIdea; total: number }) {
  return (
    <section aria-labelledby="home-hero-title" className="relative overflow-hidden bg-home-paper">
      <div aria-hidden className="home-dots absolute inset-0 opacity-60" />
      <Container className="relative flex flex-col items-center gap-[18px] pt-28 text-center md:gap-[22px] md:pt-36">
        <p className="home-intro inline-flex h-[30px] items-center gap-2 whitespace-nowrap rounded-full border border-home-rule bg-home-card px-3 font-mono text-[10.5px] tracking-[0.03em] text-home-ink-2 md:h-[34px] md:px-3.5 md:text-xs md:tracking-[0.04em]">
          <span aria-hidden className="size-1.5 rounded-full bg-home-orange md:size-[7px]" />
          {total} IDEAS · EVERY ONE WITH BUILD PROMPTS
        </p>
        <h1
          id="home-hero-title"
          className="max-w-[1000px] font-editorial text-[44px] font-normal leading-[1.02] tracking-[-0.03em] text-home-ink md:text-[60px] lg:text-[76px] lg:leading-none"
        >
          <IntroWords text={LEAD} start={0.08} step={WORD_STEP} />{" "}
          <Em>
            <IntroWords text={PUNCH} start={0.08 + LEAD.split(" ").length * WORD_STEP + 0.06} step={WORD_STEP} />
          </Em>
        </h1>
        <p className="home-intro max-w-[640px] text-base leading-[1.55] text-home-ink-2 md:text-xl" style={introDelay(0.38)}>
          Researched startup ideas sized for one weekend, with copy-paste prompts for the AI tools you already use. Keep your job.
        </p>
        <div className="home-intro flex w-full flex-col gap-2.5 pt-1 sm:w-auto sm:flex-row sm:gap-3.5" style={introDelay(0.48)}>
          <ButtonLink href="/startup-ideas">Browse {total} ideas</ButtonLink>
          <SignupCta buttonLocation="home-hero" className={buttonClass("secondary", "px-[22px] font-medium")}>
            <Icon name="kit" size={20} accent="currentColor" />
            Get the free Starter Kit
          </SignupCta>
        </div>
      </Container>
      <Container className="relative pb-12 pt-[72px] md:pb-16 lg:pb-0 lg:pt-16">
        {/* The stamp inherits this --d; the window sets its own. */}
        <div className="relative lg:mx-10 lg:h-[456px]" style={introDelay(1.15)}>
          <div className="home-intro [--home-rise:36px]" style={introDelay(0.58)}>
            <HeroBuildWindow idea={idea} total={total} pasteFrom={0.95} />
          </div>
          <Stamp
            id="home-hero-stamp"
            text="RESEARCHED · WEEKEND-SIZED · "
            className="home-press absolute -top-[58px] right-1 size-[72px] lg:-left-16 lg:-top-16 lg:right-auto lg:size-[120px]"
          />
        </div>
      </Container>
    </section>
  );
}
