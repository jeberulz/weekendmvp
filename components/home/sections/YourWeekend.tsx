import { getImageProps } from "next/image";

import { SignupCta } from "@/components/marketing/SignupCta";
import { cn } from "@/lib/utils";
import { WEEKEND_PLAN } from "../content";
import { Icon } from "../icons";
import { ButtonLink, Container, Em, Eyebrow, buttonClass } from "../ui";

const ALT = "John Iseghohi, founder of Weekend MVP, adding a sticky note to a planning wall";

/** Founder photo with art direction: portrait crop on phones, landscape from `lg`. */
function FounderPhoto() {
  const common = { alt: ALT, sizes: "100vw" };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: "/image/hero-cover-desktop.webp", width: 2400, height: 1350, quality: 75 });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({ ...common, src: "/image/hero-cover-mobile.webp", width: 1200, height: 1600, quality: 75 });
  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet={desktop} />
      <source media="(max-width: 1023px)" srcSet={mobile} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
      <img {...rest} className="size-full object-cover object-[center_30%] lg:object-[100%_22%]" />
    </picture>
  );
}

/** 07 · Built around your 9-to-5: founder photo with the four-step weekend plan. */
export function YourWeekend({ total }: { total: number }) {
  return (
    <section aria-labelledby="home-weekend-title" className="relative overflow-hidden bg-home-ink">
      <div className="relative h-[520px] lg:absolute lg:inset-x-0 lg:top-0 lg:h-[1060px]">
        <FounderPhoto />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,24,20,0.1)_0%,rgba(26,24,20,0)_30%,rgba(26,24,20,0.88)_62%,#1a1814_80%)] lg:bg-[linear-gradient(270deg,rgba(26,24,20,0.96)_0%,rgba(26,24,20,0.93)_50%,rgba(26,24,20,0.35)_64%,rgba(26,24,20,0)_76%)]"
        />
        <div aria-hidden className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(26,24,20,0)_42%,rgba(26,24,20,0.82)_74%,#1a1814_100%)] lg:block" />
        <p className="absolute left-5 top-5 inline-flex h-[30px] items-center gap-2 rounded-full bg-[rgba(26,24,20,0.78)] px-3 font-mono text-[10px] tracking-[0.08em] text-home-d1 lg:hidden">
          <span aria-hidden className="size-1.5 rounded-full bg-home-orange-light" />
          JOHN ISEGHOHI · FOUNDER, WEEKEND MVP
        </p>
      </div>

      <Container className="relative -mt-[150px] flex flex-col gap-5 pb-14 lg:mt-0 lg:gap-0 lg:pb-24 lg:pt-16">
        <div className="lg:min-h-[796px]">
        <p className="hidden h-[34px] w-fit items-center gap-2.5 rounded-full bg-[rgba(26,24,20,0.72)] px-3.5 font-mono text-[11px] tracking-[0.08em] text-home-d1 lg:inline-flex">
          <span aria-hidden className="size-[7px] rounded-full bg-home-orange-light" />
          JOHN ISEGHOHI · FOUNDER, WEEKEND MVP
        </p>
        <div className="flex flex-col gap-5 lg:ml-auto lg:mt-3 lg:w-[540px] lg:gap-[26px]">
          <Eyebrow dark>Keep your job</Eyebrow>
          <h2 id="home-weekend-title" className="font-editorial text-[56px] font-normal leading-[0.95] tracking-[-0.035em] text-home-d1 lg:text-[100px]">
            Built around your <Em dark>9-to-5.</Em>
          </h2>
          <p className="text-[17px] leading-[1.55] text-home-d2 lg:max-w-[500px] lg:text-xl">
            No sabbatical. No co-founder. About 12 hours across one weekend is enough to ship the first version.
          </p>
          <p className="flex items-baseline gap-3 lg:gap-3.5">
            <span className="font-editorial text-[44px] leading-none tracking-[-0.02em] text-home-d1 lg:text-[56px]">12 hrs</span>
            <span className="font-mono text-[11px] tracking-[0.08em] text-home-d3 lg:text-xs">FRIDAY NIGHT TO SUNDAY</span>
          </p>
          <div className="flex flex-col gap-2.5 lg:flex-row lg:gap-3.5">
            <SignupCta buttonLocation="home-weekend" className={buttonClass("dark")}>
              Get the weekend plan
              <Icon name="arrow" size={18} strokeWidth={1.75} />
            </SignupCta>
            <ButtonLink href="/startup-ideas" tone="ghost-dark" icon="search">
              Browse {total} ideas
            </ButtonLink>
          </div>
        </div>
        </div>

        <ol className="mt-3 border-t border-home-dr lg:mx-[-28px] lg:mt-0 lg:grid lg:grid-cols-4 lg:border-t-0">
          {WEEKEND_PLAN.map((d, i) => (
            <li
              key={d.day}
              className={cn(
                "flex flex-col gap-3 py-[22px] lg:gap-[18px] lg:px-7 lg:py-0",
                i < 3 && "border-b border-dashed border-home-panel-rule lg:border-b-0 lg:border-r",
              )}
            >
              <div className="flex items-center gap-3 lg:justify-between">
                <Icon name={d.icon} size={28} color="var(--color-home-d1)" accent="var(--color-home-orange-light)" className="lg:size-9" />
                <span className="font-mono text-[11px] tracking-[0.08em] text-home-d3 lg:hidden">{d.day}</span>
                <span className={cn("ml-auto font-mono text-xs font-medium lg:ml-0 lg:text-[13px]", d.hours ? "text-home-orange-light" : "text-home-d3")}>
                  {d.hours} hrs
                </span>
              </div>
              <div aria-hidden className="flex gap-[3px]">
                {d.hours ? (
                  Array.from({ length: d.hours }, (_, j) => <span key={j} className="block h-2 flex-1 rounded-[2px] bg-home-orange lg:h-2.5" />)
                ) : (
                  <span className="block h-2 flex-1 rounded-[2px] shadow-[inset_0_0_0_1px_#3a362f] lg:h-2.5" />
                )}
              </div>
              <span className="hidden font-mono text-[11px] tracking-[0.08em] text-home-d3 lg:block">{d.day}</span>
              <h3 className="font-editorial text-[26px] font-normal leading-[1.1] text-home-d1 lg:text-[30px]">{d.title}</h3>
              <p className="text-[15px] leading-[1.55] text-home-d2 lg:text-base">{d.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-home-panel-rule bg-home-panel p-[18px] lg:mt-[54px] lg:flex-row lg:items-center lg:justify-between lg:px-7 lg:py-[22px]">
          <p className="flex items-start gap-2.5 text-[15px] leading-[1.45] text-home-d1 lg:items-center lg:gap-3 lg:text-base">
            <Icon name="kit" size={22} accent="var(--color-home-orange-light)" className="lg:size-6" />
            The Starter Kit has the full Friday-to-Sunday plan.
          </p>
          <SignupCta
            buttonLocation="home-weekend-strip"
            className="inline-flex items-center gap-2 text-[15px] font-medium text-home-orange-light underline underline-offset-4 hover:text-home-d1"
          >
            Get the plan free
            <Icon name="arrow" size={16} strokeWidth={1.75} />
          </SignupCta>
        </div>
      </Container>
    </section>
  );
}
