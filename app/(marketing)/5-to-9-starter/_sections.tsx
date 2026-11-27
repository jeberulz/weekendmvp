import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Seal } from "@/components/Seal";
import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { Container, Em, Eyebrow } from "@/components/home/ui";
import { GUIDE_AUTOMATION_ID } from "@/lib/beehiiv-client";
import { BUILD_ALONG } from "@/lib/live/config";
import { cn } from "@/lib/utils";

import styles from "./starter.module.css";

export const BUILD_ALONG_PRICE = `$${BUILD_ALONG.standardUsd}`;

const LABEL = "font-mono text-[11px] font-medium uppercase leading-[1.3] tracking-[0.08em]";
const HEADING = "text-balance font-editorial text-[clamp(34px,4.4vw,54px)] font-normal leading-[1.05] tracking-[-0.02em]";
const SPLIT = "grid gap-[clamp(28px,4vw,48px)] min-[960px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[960px]:gap-16";
const STICKY = "min-[960px]:sticky min-[960px]:top-28 min-[960px]:self-start";
const BODY = "max-w-[62ch] leading-[1.6] text-home-ink-3";
const LINK = "font-medium text-home-orange-ink underline decoration-1 underline-offset-4 transition-colors duration-180 hover:text-home-ink";

function GuideForm({ placement }: { placement: "hero" | "final" }) {
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
        submitLabel="Send me Day 1"
        emailLabelClassName="text-[13px] font-medium"
        inputClassName="h-12 min-w-0 border-home-rule bg-home-card py-0 text-base text-home-ink placeholder:text-home-ink-3 transition duration-180 hover:border-home-ink-3 focus:border-home-orange-ink focus:ring-[3px] focus:ring-home-orange-ink/22"
        buttonClassName="min-h-12 cursor-pointer whitespace-nowrap bg-home-orange-ink px-6 py-0 text-[15px] text-white duration-180 hover:bg-[#8f3f00] focus:ring-0 focus:ring-home-orange-ink disabled:cursor-wait"
      />
      <p className="text-[13px] leading-[1.6] text-home-ink-3">
        {placement === "hero" ? "Day 1 arrives in a few minutes. " : "Free. "}
        Unsubscribe anytime.
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

export function GuideHero({ total }: { total: number }) {
  return (
    <section
      aria-labelledby="guide-hero-title"
      className={cn(styles.section, styles.hero, styles.dots, "home-dots overflow-x-clip border-b border-home-rule")}
    >
      <Container className={cn(styles.wrap, "grid items-center gap-[clamp(40px,6vw,64px)] min-[960px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]")}>
        <div className="grid justify-items-start gap-6">
          <Eyebrow className={LABEL}>Free 5-day email guide · 10 minutes an evening</Eyebrow>
          <h1
            id="guide-hero-title"
            className="text-balance font-editorial text-[clamp(44px,6.2vw,76px)] font-normal leading-[1.02] tracking-[-0.025em]"
          >
            Your 9-to-5 pays the bills. <Em>Your 5-to-9 builds the future.</Em>
          </h1>
          <p className="max-w-[38ch] text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-home-ink-3">
            One short email a day for five days, and one small action each evening.
            By Friday you&apos;ll have a tested idea, not a notebook full of untested ones.
          </p>
          <GuideForm placement="hero" />
          <p className="max-w-[520px] border-t border-home-rule pt-[18px] text-sm leading-[1.6] text-home-ink-3">
            From the maker of Weekend MVP: <span className="font-mono text-[13px] text-home-ink">{total}</span>{" "}
            researched startup ideas, each with a verdict.
          </p>
        </div>
        <figure className="relative w-full max-w-[520px] justify-self-center min-[960px]:justify-self-end">
          <div className={cn(styles.card, "relative aspect-[3/2] overflow-hidden min-[960px]:aspect-[4/5]")}>
            <Image
              src="/image/5-to-9/hero-day1-illustration.svg"
              alt="Ink line illustration of an open notebook with five handwritten work problems, one circled in orange, and a blank work ID badge beside it."
              fill
              loading="eager"
              className="object-contain"
            />
          </div>
          <figcaption className="mt-3 flex items-baseline gap-3 text-sm leading-[1.6] text-home-ink-3">
            <span className={cn(LABEL, "shrink-0")}>Day 1</span>
            <span>List five problems you&apos;ve already solved. Circle one.</span>
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

const DAYS = [
  {
    title: "Find it.",
    text: "Your idea is in problems you’ve already solved. List five. Circle the one that made someone ask, “how did you do that?”",
  },
  {
    title: "Who pays?",
    text: "Ask three real people how they deal with the problem today, what it costs them, and what they’d pay to fix it. If nobody cares, drop it. You just saved a weekend.",
  },
  {
    title: "Pick it.",
    text: "Score your shortlist in 10 minutes. The highest score wins. Includes a short lesson on positioning: making the idea look like yours, not a template.",
  },
  {
    title: "Prove it.",
    text: "Run a 10-minute proof test: a post, a waitlist, or one person paying £5. Don’t build anything until someone shows intent.",
  },
  {
    title: "Sell it.",
    text: "Write your first small paid offer for one person, with one outcome and one price. Then build the weekend version.",
  },
];

export function FiveDays() {
  return (
    <section aria-labelledby="guide-days-title" className={styles.section}>
      <Container className={cn(styles.wrap, SPLIT)}>
        <SectionHeading
          eyebrow="What's inside"
          id="guide-days-title"
          title={<>Five days, <Em>one tested idea.</Em></>}
          className={STICKY}
        >
          <p className={BODY}>Each email is about 250 words. Read it at lunch, then do the action in 10 minutes that evening.</p>
        </SectionHeading>
        <div>
          <ol role="list" className={cn(styles.card, "px-5 py-1 min-[560px]:px-7 min-[560px]:py-2")}>
            {DAYS.map(({ title, text }, index) => (
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
            After Day 5 you move onto the daily Weekend MVP list: one idea a day, with the honest catch and a verdict.
            When you&apos;re ready to build, the next step is the{" "}
            <Link href="/live/build-along" className={LINK}>{`Build-Along sprint, two hours live with John for ${BUILD_ALONG_PRICE}`}</Link>.
          </p>
        </div>
      </Container>
    </section>
  );
}

export function FounderNoteSection() {
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
            <Eyebrow className={LABEL}>A note from the founder</Eyebrow>
            <h2 id="guide-founder-title" className={cn(HEADING, "text-[clamp(28px,3vw,36px)]")}>Why this guide exists</h2>
          </div>
        </header>
        <div className="grid gap-[18px] text-lg leading-[1.65]">
          <p className="max-w-[62ch]">
            I&apos;m a designer. I built Weekend MVP because the gap between “I have an idea” and “here&apos;s a live URL”
            was too big for people with day jobs. Most of us don&apos;t lack ideas or talent. We lack a small enough place to start.
          </p>
          <p className="max-w-[62ch]">
            Every idea on Weekend MVP is researched, sized for a weekend, and paired with copy-paste prompts for the AI tools
            you already use. This guide is the front half of that method: find the idea in your own week, check that someone
            will pay for it, and prove it in 10 minutes. Then build.
          </p>
          <p>You don&apos;t need to write a resignation letter.</p>
          <div className="mt-3 grid justify-items-start gap-1 border-t border-home-rule pt-5">
            <p className="font-editorial text-[28px] italic leading-[1.1]">John Iseghohi</p>
            <p className="mb-2 text-sm text-home-ink-3">Founder, Weekend MVP.</p>
            <Link href="/john-iseghohi" className={cn(LINK, "text-[15px]")}>More about John</Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

const FOR_YOU = [
  "You have a 9-to-5 and an idea that won’t leave you alone.",
  "Colleagues keep asking you about problems you’ve solved at work.",
  "You can give it 10 minutes an evening for 5 days.",
];

const NOT_FOR_YOU = [
  "You want to quit tomorrow. This guide keeps the job and builds beside it.",
  "You want a get-rich idea with nobody to sell it to. Day 2 rules those out on purpose.",
  "You won’t talk to three real people. The method runs on real answers, not guesses.",
];

function FitCard({ quiet = false, title, items }: { quiet?: boolean; title: string; items: string[] }) {
  return (
    <div className={cn("grid content-start gap-4 p-7", quiet ? "rounded-[10px] border border-home-rule text-home-ink-3" : styles.card)}>
      <h3 className={cn(LABEL, !quiet && "text-home-orange-ink")}>{title}</h3>
      <ul role="list">
        {items.map((item) => (
          <li key={item} className="flex gap-4 border-t border-home-rule py-3.5 leading-[1.55] first:border-t-0 first:pt-0">
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

export function WhoItIsFor() {
  return (
    <section aria-labelledby="guide-fit-title" className={styles.section}>
      <Container className={styles.wrap}>
        <SectionHeading
          eyebrow="Is this for you?"
          id="guide-fit-title"
          title={<>Made for people <Em>who are keeping the job.</Em></>}
          className="mb-[clamp(28px,4vw,44px)]"
        />
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <FitCard title="This is for you if" items={FOR_YOU} />
          <FitCard quiet title="This is not for you if" items={NOT_FOR_YOU} />
        </div>
      </Container>
    </section>
  );
}

const FAQS: { question: string; answer: ReactNode }[] = [
  {
    question: "Is it really free?",
    answer: "Yes. All five emails are free. After Day 5 you join the daily Weekend MVP list, which sends one idea a day. You can unsubscribe at any time.",
  },
  {
    question: "I don’t have an idea yet.",
    answer: "That’s what Day 1 is for. You don’t need to invent an idea. You find it in your own week: list five problems you’ve already solved, then circle the one that made someone ask how you did it.",
  },
  {
    question: "I only have two hours an evening.",
    answer: "Ten minutes is enough. Each day is one short email and one small action, so it fits around a full-time job.",
  },
  {
    question: "Do I need to code?",
    answer: "No. The guide covers finding, picking and proving an idea. There’s no building until Day 5, and even then the offer comes before the product. When you do build, Weekend MVP ideas come with copy-paste prompts for Cursor, Claude and Lovable.",
  },
  {
    question: "What happens after Day 5?",
    answer: (
      <>
        You get the daily list: one researched idea a day, who it&apos;s for, what it costs, the honest catch, and a verdict.
        Day 5 ends with your first small paid offer. When you&apos;re ready to build it, the next step is the{" "}
        <Link href="/live/build-along" className={LINK}>{`Build-Along sprint (${BUILD_ALONG_PRICE})`}</Link>: two hours live on Zoom,
        building your MVP while John builds his. You can revisit the method in{" "}
        <Link href="/guides/5-to-9-builder" className={LINK}>The 5-to-9 Builder</Link>.
      </>
    ),
  },
];

export function GuideFaq() {
  return (
    <section aria-labelledby="guide-faq-title" className={cn(styles.section, "border-t border-home-rule")}>
      <Container className={cn(styles.wrap, SPLIT)}>
        <SectionHeading
          eyebrow="Questions"
          id="guide-faq-title"
          title={<>Before you <Em>sign up.</Em></>}
          className={STICKY}
        />
        <div>
          {FAQS.map(({ question, answer }, index) => (
            <details key={question} open={index === 0} className="group border-t border-home-rule last:border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-[22px] font-editorial text-[clamp(20px,2vw,24px)] leading-[1.2] transition-colors duration-180 hover:text-home-orange-ink [&::-webkit-details-marker]:hidden">
                {question}
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-home-rule font-mono text-base leading-none text-home-orange-ink transition-colors duration-180 group-hover:border-home-orange-ink">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">–</span>
                </span>
              </summary>
              <p className={cn(BODY, "pr-12 pb-6")}>{answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FinalCapture() {
  return (
    <section aria-labelledby="guide-final-title" className={cn(styles.section, styles.tight)}>
      <Container className={styles.wrap}>
        <div className={cn(styles.card, styles.dots, "home-dots grid justify-items-center gap-[18px] px-[clamp(24px,5vw,64px)] py-[clamp(40px,6vw,72px)] text-center")}>
          <Eyebrow className={LABEL}>The 5-to-9 Starter · free</Eyebrow>
          <h2 id="guide-final-title" className={HEADING}>Know by <Em>Friday.</Em></h2>
          <p className={cn(BODY, "mb-2 text-lg")}>
            Five days from now you&apos;ll know whether your idea is worth a weekend, or whether to drop it and pick a
            better one. Either way, you&apos;ll know.
          </p>
          <GuideForm placement="final" />
        </div>
      </Container>
    </section>
  );
}
