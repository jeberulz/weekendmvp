import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Seal } from "@/components/Seal";
import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { Container, Em, Eyebrow } from "@/components/home/ui";
import { GUIDE_AUTOMATION_ID } from "@/lib/beehiiv-client";
import type { StarterBlock, StarterEntry } from "@/lib/landing/read-starter";
import { formatPrice } from "@/lib/guides/offer-live";
import { BUILD_ALONG } from "@/lib/live/config";
import { cn } from "@/lib/utils";

import styles from "./starter.module.css";

export const BUILD_ALONG_PRICE = formatPrice(BUILD_ALONG.standardUsd);

function formatBuildAlongLabel(label: string) {
  return label.replace("{buildAlongPrice}", BUILD_ALONG_PRICE);
}

function IntroTitle({ title, emphasis }: { title: string; emphasis: string }) {
  return <>{`${title} `}<Em>{emphasis}</Em></>;
}


const LABEL = "font-mono text-[11px] font-medium uppercase leading-[1.3] tracking-[0.08em]";
const HEADING = "text-balance font-editorial text-[clamp(34px,4.4vw,54px)] font-normal leading-[1.05] tracking-[-0.02em]";
const SPLIT = "grid gap-[clamp(28px,4vw,48px)] min-[960px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[960px]:gap-16";
const STICKY = "min-[960px]:sticky min-[960px]:top-28 min-[960px]:self-start";
const BODY = "max-w-[62ch] leading-[1.6] text-home-ink-3";
const LINK = "font-medium text-home-orange-ink underline decoration-1 underline-offset-4 transition-colors duration-180 hover:text-home-ink";

function GuideForm({ placement, copy }: { placement: "hero" | "final"; copy: StarterEntry["hero"]["form"] }) {
  return (
    <div className="grid w-full max-w-[520px] gap-2 text-left">
      <BeehiivSubscribeForm
        automationId={GUIDE_AUTOMATION_ID}
        utmCampaign="5-to-9-starter"
        utmSource={`5-to-9-${placement}`}
        successHref="/5-to-9-starter?subscribed=true"
        successMessage="You’re in! Day 1 will arrive in a few minutes."
        showFirstName={false}
        inlineEmail
        emailPlaceholder="you@work.com"
        submitLabel={copy.submitLabel}
        emailLabelClassName="text-[13px] font-medium"
        inputClassName="h-12 min-w-0 border-home-rule bg-home-card py-0 text-base text-home-ink placeholder:text-home-ink-3 transition duration-180 hover:border-home-ink-3 focus:border-home-orange-ink focus:ring-[3px] focus:ring-home-orange-ink/22"
        buttonClassName="min-h-12 cursor-pointer whitespace-nowrap bg-home-orange-ink px-6 py-0 text-[15px] text-white duration-180 hover:bg-[#8f3f00] focus:ring-0 focus:ring-home-orange-ink disabled:cursor-wait"
      />
      <p className="text-[13px] leading-[1.6] text-home-ink-3">
        {`${copy.finePrint} `}{copy.unsubscribeLine}
      </p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  id,
  children,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  id: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("grid content-start gap-3.5", className)}>
      <Eyebrow className={LABEL}>{eyebrow}</Eyebrow>
      <h2 id={id} className={HEADING}>{title}</h2>
      {children}
    </header>
  );
}

export function GuideHero({ total, copy }: { total: number; copy: StarterEntry["hero"] }) {
  return (
    <section
      aria-labelledby="guide-hero-title"
      className={cn(styles.section, styles.hero, styles.dots, "home-dots overflow-x-clip border-b border-home-rule")}
    >
      <Container className={cn(styles.wrap, "grid items-center gap-[clamp(40px,6vw,64px)] min-[960px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]")}>
        <div className="grid justify-items-start gap-6">
          <Eyebrow className={LABEL}>{copy.eyebrow}</Eyebrow>
          <h1
            id="guide-hero-title"
            className="text-balance font-editorial text-[clamp(44px,6.2vw,76px)] font-normal leading-[1.02] tracking-[-0.025em]"
          >
            <IntroTitle title={copy.title} emphasis={copy.emphasis} />
          </h1>
          <p className="max-w-[38ch] text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-home-ink-3">
            {copy.body}
          </p>
          <GuideForm placement="hero" copy={copy.form} />
          <p className="max-w-[520px] border-t border-home-rule pt-[18px] text-sm leading-[1.6] text-home-ink-3">
            {`${copy.bylineStart} `}<span className="font-mono text-[13px] text-home-ink">{total}</span>{" "}
            {copy.bylineEnd}
          </p>
        </div>
        <figure className="relative w-full max-w-[520px] justify-self-center min-[960px]:justify-self-end">
          <div className={cn(styles.card, "relative aspect-[3/2] overflow-hidden min-[960px]:aspect-[4/5]")}>
            <Image
              src="/image/5-to-9/hero-day1-illustration.svg"
              alt={copy.illustrationAlt}
              fill
              loading="eager"
              className="object-contain"
            />
          </div>
          <figcaption className="mt-3 flex items-baseline gap-3 text-sm leading-[1.6] text-home-ink-3">
            <span className={cn(LABEL, "shrink-0")}>{copy.captionLabel}</span>
            <span>{copy.caption}</span>
          </figcaption>
          <Seal
            ringText="FREE · FIVE DAYS · THE 5-TO-9 STARTER · "
            core="5–9"
            className="pointer-events-none absolute -top-[26px] -right-1.5 size-[88px] opacity-90 mix-blend-multiply min-[560px]:-top-[34px] min-[560px]:right-auto min-[560px]:-left-[34px] min-[560px]:size-[116px] [&_textPath]:tracking-[0.06em]"
          />
        </figure>
      </Container>
    </section>
  );
}

export function FiveDays({ copy }: { copy: StarterBlock<"fiveDays"> }) {
  const { one, two, three, four, five } = copy.days;
  const days = [one, two, three, four, five];
  return (
    <section aria-labelledby="guide-days-title" className={styles.section}>
      <Container className={cn(styles.wrap, SPLIT)}>
        <SectionHeading
          eyebrow={copy.eyebrow}
          id="guide-days-title"
          title={<IntroTitle title={copy.title} emphasis={copy.emphasis} />}
          className={STICKY}
        >
          <p className={BODY}>{copy.intro}</p>
        </SectionHeading>
        <div>
          <ol role="list" className={cn(styles.card, "px-5 py-1 min-[560px]:px-7 min-[560px]:py-2")}>
            {days.map(({ title, text }, index) => (
              <li
                key={title}
                className="grid gap-2 border-t border-home-rule py-6 first:border-t-0 min-[560px]:grid-cols-[64px_minmax(0,1fr)] min-[560px]:gap-5"
              >
                <span className={cn(LABEL, "text-home-orange-ink min-[560px]:pt-[7px]")}>Day 0{index + 1}</span>
                <div>
                  <h3 className="mb-1.5 font-editorial text-[clamp(22px,2.2vw,26px)] leading-[1.15] tracking-[-0.01em]">{title}</h3>
                  <p className={BODY}>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={cn(BODY, "mt-6")}>
            {copy.followUp}{" "}
            <Link href="/live/build-along" className={LINK}>{formatBuildAlongLabel(copy.buildAlongLabel)}</Link>.
          </p>
        </div>
      </Container>
    </section>
  );
}

export function FounderNoteSection({ copy }: { copy: StarterBlock<"founderNote"> }) {
  return (
    <section aria-labelledby="guide-founder-title" className={cn(styles.section, "border-y border-home-rule bg-[#FCFAF7]")}>
      <Container className={cn(styles.wrap, "grid max-w-[760px] gap-8")}>
        <header className="flex items-center gap-5">
          <Image
            src="/image/john-portrait.webp"
            alt="Portrait of John Iseghohi"
            width={72}
            height={72}
            className="size-[72px] shrink-0 rounded-full border border-home-rule object-cover object-[center_52%]"
          />
          <div className="grid gap-2">
            <Eyebrow className={LABEL}>{copy.eyebrow}</Eyebrow>
            <h2 id="guide-founder-title" className={cn(HEADING, "text-[clamp(28px,3vw,36px)]")}>{copy.title}</h2>
          </div>
        </header>
        <div className="grid gap-[18px] text-lg leading-[1.65]">
          {copy.paragraphs.map((paragraph, index) => (
            <p key={index} className={index < 2 ? "max-w-[62ch]" : undefined}>{paragraph}</p>
          ))}
          <div className="mt-3 grid justify-items-start gap-1 border-t border-home-rule pt-5">
            <p className="font-editorial text-[28px] italic leading-[1.1]">John Iseghohi</p>
            <p className="mb-2 text-sm text-home-ink-3">{copy.signatureRole}</p>
            <Link href="/john-iseghohi" className={cn(LINK, "text-[15px]")}>{copy.aboutLabel}</Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FitCard({ quiet = false, title, items }: { quiet?: boolean; title: string; items: readonly string[] }) {
  return (
    <div className={cn("grid content-start gap-4 p-7", quiet ? "rounded-[10px] border border-home-rule text-home-ink-3" : styles.card)}>
      <h3 className={cn(LABEL, !quiet && "text-home-orange-ink")}>{title}</h3>
      <ul role="list">
        {items.map((item, index) => (
          <li key={index} className="flex gap-4 border-t border-home-rule py-3.5 leading-[1.55] first:border-t-0 first:pt-0">
            <span aria-hidden="true" className={cn("pl-0.5 font-mono text-[15px] font-medium", !quiet && "text-home-orange-ink")}>
              {quiet ? "–" : "+"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhoItIsFor({ copy }: { copy: StarterBlock<"whoItIsFor"> }) {
  return (
    <section aria-labelledby="guide-fit-title" className={styles.section}>
      <Container className={styles.wrap}>
        <SectionHeading
          eyebrow={copy.eyebrow}
          id="guide-fit-title"
          title={<IntroTitle title={copy.title} emphasis={copy.emphasis} />}
          className="mb-[clamp(28px,4vw,44px)]"
        />
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <FitCard title={copy.forTitle} items={copy.forItems} />
          <FitCard quiet title={copy.againstTitle} items={copy.againstItems} />
        </div>
      </Container>
    </section>
  );
}

function FaqAnswer({ item }: { item: StarterBlock<"faq">["questions"][number] }) {
  if (item.discriminant === "plain") return item.value.answer;

  const { intro, buildAlongLabel, continuation, guideLabel } = item.value;
  return (
    <>
      {intro}{" "}
      <Link href="/live/build-along" className={LINK}>{formatBuildAlongLabel(buildAlongLabel)}</Link>{continuation}{" "}
      <Link href="/guides/5-to-9-builder" className={LINK}>{guideLabel}</Link>.
    </>
  );
}

export function GuideFaq({ copy }: { copy: StarterBlock<"faq"> }) {
  return (
    <section aria-labelledby="guide-faq-title" className={cn(styles.section, "border-t border-home-rule")}>
      <Container className={cn(styles.wrap, SPLIT)}>
        <SectionHeading
          eyebrow={copy.eyebrow}
          id="guide-faq-title"
          title={<IntroTitle title={copy.title} emphasis={copy.emphasis} />}
          className={STICKY}
        />
        <div>
          {copy.questions.map((item, index) => (
            <details key={item.value.question} open={index === 0} className="group border-t border-home-rule last:border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-[22px] font-editorial text-[clamp(20px,2vw,24px)] leading-[1.2] transition-colors duration-180 hover:text-home-orange-ink [&::-webkit-details-marker]:hidden">
                {item.value.question}
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-home-rule font-mono text-base leading-none text-home-orange-ink transition-colors duration-180 group-hover:border-home-orange-ink">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">–</span>
                </span>
              </summary>
              <p className={cn(BODY, "pr-12 pb-6")}><FaqAnswer item={item} /></p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FinalCapture({ copy }: { copy: StarterEntry["finalCapture"] }) {
  return (
    <section aria-labelledby="guide-final-title" className={cn(styles.section, styles.tight)}>
      <Container className={styles.wrap}>
        <div className={cn(styles.card, styles.dots, "home-dots grid justify-items-center gap-[18px] px-[clamp(24px,5vw,64px)] py-[clamp(40px,6vw,72px)] text-center")}>
          <Eyebrow className={LABEL}>{copy.eyebrow}</Eyebrow>
          <h2 id="guide-final-title" className={HEADING}><IntroTitle title={copy.title} emphasis={copy.emphasis} /></h2>
          <p className={cn(BODY, "mb-2 text-lg")}>
            {copy.body}
          </p>
          <GuideForm placement="final" copy={copy.form} />
        </div>
      </Container>
    </section>
  );
}
