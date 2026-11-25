import Image from "next/image";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { Container, Em, Eyebrow, TextLink } from "@/components/home/ui";
import { GUIDE_AUTOMATION_ID } from "@/lib/beehiiv-client";

import { HERO_IMAGE_ALT, HERO_IMAGE_SRC } from "./heroImageData";

const SUCCESS_HREF = "/5-to-9-starter?subscribed=true";
const UTM_CAMPAIGN = "5-to-9-starter";

/**
 * Paper form styles, copied from the Starter Kit ticket
 * (components/home/sections/StarterKit.tsx).
 */
const PAPER_INPUT =
  "h-[52px] rounded-xl border-home-ink-3 bg-white px-4 text-base text-home-ink placeholder:text-home-ink-3 focus:ring-home-orange-ink";
const PAPER_BUTTON =
  "h-[52px] rounded-xl bg-home-ink text-base text-white hover:bg-black focus:ring-home-orange-ink";

/** The guide signup form, pre-wired to the 5-to-9 Starter automation. */
function GuideForm({
  paper = false,
  className,
}: {
  paper?: boolean;
  className?: string;
}) {
  return (
    <BeehiivSubscribeForm
      automationId={GUIDE_AUTOMATION_ID}
      utmCampaign={UTM_CAMPAIGN}
      successHref={SUCCESS_HREF}
      showFirstName={false}
      emailPlaceholder="you@work.com"
      submitLabel="Send me Day 1"
      className={className}
      inputClassName={paper ? PAPER_INPUT : undefined}
      buttonClassName={paper ? PAPER_BUTTON : undefined}
    />
  );
}

function SectionHeading({
  eyebrow,
  title,
  id,
}: {
  eyebrow: string;
  title: React.ReactNode;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className="font-editorial text-[38px] leading-[1.02] tracking-[-0.025em] text-home-ink lg:text-[60px] lg:leading-[1.06]"
      >
        {title}
      </h2>
    </div>
  );
}

/** 01 · Hero: headline, form, proof, placeholder photo. */
export function GuideHero({ total }: { total: number }) {
  return (
    <section aria-labelledby="guide-hero-title" className="relative overflow-hidden bg-home-paper">
      <div aria-hidden className="home-dots absolute inset-0 opacity-60" />
      <Container className="relative flex flex-col gap-7 py-14 lg:gap-9 lg:py-[88px]">
        <Eyebrow>FREE 5-DAY EMAIL GUIDE</Eyebrow>
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-home-rule bg-home-card px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-2">
          <span aria-hidden className="size-1.5 rounded-full bg-home-orange" />
          FREE · 5 DAYS · 10 MINUTES A NIGHT
        </p>
        <h1
          id="guide-hero-title"
          className="max-w-4xl font-editorial text-[44px] leading-[1.02] tracking-[-0.03em] text-home-ink md:text-[60px] lg:text-[76px]"
        >
          Your 9-to-5 pays the bills.{" "}
          <Em>Your 5-to-9 builds the future.</Em>
        </h1>
        <p className="max-w-2xl text-base leading-[1.55] text-home-ink-2 md:text-xl">
          Turn your 9-to-5 expertise into a 5-to-9 income — in 5 days. One
          short email a day. One action a day. By Friday, you&apos;ll have a
          tested idea, not just a notebook full of them.
        </p>
        <div className="flex max-w-xl flex-col gap-3">
          <GuideForm paper />
          <p className="text-xs text-home-ink-3">
            Free. One email a day for 5 days. Unsubscribe anytime.
          </p>
          <p className="text-sm text-home-ink-3">
            From the maker of WeekendMVP — {total} researched startup ideas,
            each with a verdict. No quitting your job. No 10-week build before
            anyone sees it.
          </p>
        </div>
        {/* Placeholder until John supplies his working photo (see heroImageData.ts).
            Plain <img>: a data URI cannot be optimized by next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI, not optimizable */}
        <img
          src={HERO_IMAGE_SRC}
          alt={HERO_IMAGE_ALT}
          width={1600}
          height={686}
          className="aspect-[21/9] w-full rounded-[1rem] object-cover"
        />
      </Container>
    </section>
  );
}

const DAYS: Array<{ day: string; title: string; text: string }> = [
  {
    day: "Day 1",
    title: "Find it.",
    text: "Your idea is in problems you\u2019ve already solved. List 5. Circle the one that made someone say \u201chow did you do that?\u201d",
  },
  {
    day: "Day 2",
    title: "Who pays?",
    text: "The 3-person test. Ask 3 real people how they deal with the problem today, what it costs them, and what they\u2019d pay to fix it. If nobody cares, kill it — you just saved a weekend.",
  },
  {
    day: "Day 3",
    title: "Pick it.",
    text: "Score it in 10 minutes. Highest score wins. Includes the Designer Eye: positioning is taste, not templates.",
  },
  {
    day: "Day 4",
    title: "Prove it.",
    text: "The 10-minute proof test. A post, a waitlist, or one person paying £5 — no building until someone shows intent.",
  },
  {
    day: "Day 5",
    title: "Sell it.",
    text: "Your first small paid offer. One person, one outcome, one price. Then build the weekend version of it.",
  },
];

/** 02 · What you get: the 5 days. */
export function FiveDays() {
  return (
    <section aria-labelledby="guide-days-title" className="bg-home-paper">
      <Container className="flex flex-col gap-7 py-14 lg:gap-9 lg:py-[88px]">
        <SectionHeading
          eyebrow="WHAT'S INSIDE"
          id="guide-days-title"
          title={
            <>
              Five days. <Em>Five small moves.</Em> One tested idea.
            </>
          }
        />
        <p className="max-w-2xl text-base leading-[1.55] text-home-ink-2 md:text-xl">
          Every email is about 250 words. Read it on your lunch break, do the
          action in 10 minutes that evening.
        </p>
        <ol className="flex flex-col">
          {DAYS.map((item) => (
            <li
              key={item.day}
              className="flex gap-5 border-t border-home-rule py-6 first:border-t-0 first:pt-0 last:pb-0"
            >
              <span className="w-14 shrink-0 pt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-home-orange-ink">
                {item.day}
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="font-editorial text-2xl leading-tight text-home-ink md:text-[28px]">
                  {item.title}
                </h3>
                <p className="max-w-2xl text-base leading-[1.55] text-home-ink-2">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="max-w-2xl text-base leading-[1.55] text-home-ink-2">
          After Day 5, you roll onto the daily WeekendMVP list — one idea a
          day, with the honest catch and a verdict. Ready to build? The next
          step is the{" "}
          <TextLink href="/live/build-along">
            Build-Along sprint — two hours live with John, $47
          </TextLink>
          .
        </p>
      </Container>
    </section>
  );
}

const FOUNDER_LETTER = [
  "I\u2019m a designer. I built WeekendMVP because the gap between \u201cI have an idea\u201d and \u201chere\u2019s a live URL\u201d was too big for people with day jobs — and most of us don\u2019t lack ideas or talent. We lack a small enough place to start.",
  "So every idea on WeekendMVP is researched, sized for a weekend, and paired with copy-paste prompts for the AI tools you already use. This guide is the front half of that method: find the idea in your own week, check someone will pay for it, prove it in 10 minutes — then build.",
  "No dramatic resignation letter. Your 9-to-5 pays the bills. Your 5-to-9 builds the future.",
];

/** 03 · Why it works: a note from John (structure mirrors the homepage FounderNote). */
export function FounderNoteSection() {
  const [first, ...rest] = FOUNDER_LETTER;
  return (
    <section aria-labelledby="guide-founder-title" className="bg-home-sunk py-14 lg:pb-24 lg:pt-[104px]">
      <Container className="flex flex-col items-center gap-7 lg:gap-10">
        <h2
          id="guide-founder-title"
          className="flex flex-col items-center gap-2.5 text-center font-editorial text-[46px] font-normal leading-none tracking-[-0.03em] text-home-ink lg:flex-row lg:gap-[22px] lg:text-[84px]"
        >
          A note from
          <span className="flex items-center gap-3.5 lg:gap-[22px]">
            <Image
              src="/image/john-portrait.webp"
              alt=""
              width={150}
              height={84}
              className="h-[58px] w-[104px] rounded-full object-cover object-[center_52%] lg:h-[84px] lg:w-[150px]"
            />
            <Em>John</Em>
          </span>
        </h2>
        <div className="flex w-full max-w-[680px] flex-col gap-[18px] text-[17px] leading-[1.65] text-home-ink-2 lg:gap-[22px] lg:text-[19px] lg:leading-[1.7]">
          <p>
            {/* Drop cap is the real first letter — no aria-hidden/sr-only duplicate. */}
            <span className="float-left pr-2.5 pt-1.5 font-editorial text-[66px] leading-[0.8] text-home-orange lg:pr-3 lg:pt-2 lg:text-[84px]">
              {first.charAt(0)}
            </span>
            {first.slice(1)}
          </p>
          {rest.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="flex w-full max-w-[680px] flex-col gap-2 border-t border-home-rule pt-5 lg:flex-row lg:items-end lg:justify-between lg:pt-6">
          <div className="flex flex-col gap-2 lg:gap-1.5">
            <p className="font-editorial text-4xl italic leading-none lg:text-[44px]">
              John Iseghohi
            </p>
            <p className="text-[13px] leading-[1.45] text-home-ink-3 lg:text-sm">
              Founder, Weekend MVP · runs a community of 400+ weekend builders
            </p>
          </div>
          <TextLink href="/john-iseghohi" className="mt-1.5 lg:mt-0">
            More about John
          </TextLink>
        </div>
      </Container>
    </section>
  );
}

const FOR_YOU = [
  "You have a 9-to-5 and an idea that won\u2019t leave you alone",
  "You\u2019ve solved problems at work that colleagues keep asking you about",
  "You can give it 10 minutes a night for 5 days",
];

const NOT_FOR_YOU = [
  "You want to quit your job tomorrow — this guide keeps the job and builds beside it",
  "You want a get-rich idea with no one to sell it to — Day 2 kills those on purpose",
  "You won\u2019t talk to 3 real people — the whole method runs on real answers, not guesses",
];

/** 04 · Who it is for / not for. */
export function WhoItIsFor() {
  return (
    <section aria-labelledby="guide-fit-title" className="bg-home-paper">
      <Container className="flex flex-col gap-7 py-14 lg:gap-9 lg:py-[88px]">
        <SectionHeading
          eyebrow="IS THIS FOR YOU?"
          id="guide-fit-title"
          title={
            <>
              Built for the 5-to-9. <Em>Not for everyone.</Em>
            </>
          }
        />
        <div className="grid gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-orange-ink">
              This is for you if
            </h3>
            <ul className="flex flex-col">
              {FOR_YOU.map((item) => (
                <li
                  key={item}
                  className="border-t border-home-rule py-4 text-base leading-[1.55] text-home-ink first:border-t-0 first:pt-0"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-orange-ink">
              This is not for you if
            </h3>
            <ul className="flex flex-col">
              {NOT_FOR_YOU.map((item) => (
                <li
                  key={item}
                  className="border-t border-home-rule py-4 text-base leading-[1.55] text-home-ink first:border-t-0 first:pt-0"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Is it really free?",
    a: "Yes. Five emails, free. After Day 5 you join the daily WeekendMVP list — one idea a day. Unsubscribe anytime, no hard feelings.",
  },
  {
    q: "I don\u2019t have an idea yet.",
    a: "Good — that\u2019s Day 1. You don\u2019t invent an idea. You steal it from your own week: five problems you\u2019ve already solved, circle the one that made someone say \u201chow did you do that?\u201d",
  },
  {
    q: "I only have two hours a night.",
    a: "You need ten minutes. Each day is one short email and one small action. The whole point is that a 9-to-5er can do this in their 5-to-9.",
  },
  {
    q: "Do I need to code?",
    a: "No. The guide is about finding, picking, and proving an idea — no building until Day 5, and even then the offer comes before the product. When you do build, WeekendMVP ideas come with copy-paste prompts for Cursor, Claude, and Lovable.",
  },
  {
    q: "What happens after Day 5?",
    a: (
      <>
        You get the daily list: one researched idea a day, who it&apos;s for,
        what it costs, the honest catch, and a verdict. Day 5 itself ends with
        your first small paid offer — one person, one outcome, one price. When
        you&apos;re ready to build it, the next step is the{" "}
        <TextLink href="/live/build-along">
          Build-Along sprint ($47)
        </TextLink>{" "}
        — two hours live on Zoom, building your MVP while John builds his.
      </>
    ),
  },
];

/** 05 · FAQ. */
export function GuideFaq() {
  return (
    <section aria-labelledby="guide-faq-title" className="bg-home-paper">
      <Container className="flex flex-col gap-7 py-14 lg:gap-9 lg:py-[88px]">
        <SectionHeading
          eyebrow="QUESTIONS"
          id="guide-faq-title"
          title={
            <>
              Asked, <Em>answered.</Em>
            </>
          }
        />
        <dl className="flex max-w-3xl flex-col">
          {FAQS.map((item) => (
            <div
              key={item.q}
              className="border-t border-home-rule py-6 first:border-t-0 first:pt-0 last:pb-0"
            >
              <dt className="font-editorial text-xl leading-tight text-home-ink md:text-2xl">
                {item.q}
              </dt>
              <dd className="mt-2 text-base leading-[1.55] text-home-ink-2">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/** 06 · Final capture (dark close, FinalCall pattern). */
export function FinalCapture() {
  return (
    <section aria-labelledby="guide-final-title" className="bg-home-ink">
      <Container className="flex flex-col items-center gap-6 py-14 text-center lg:py-[88px]">
        <h2
          id="guide-final-title"
          className="font-editorial text-[38px] leading-[1.02] tracking-[-0.025em] text-home-d1 lg:text-[60px] lg:leading-[1.06]"
        >
          Your evenings are <Em dark>the business.</Em>
        </h2>
        <p className="max-w-xl text-base leading-[1.55] text-home-d2 md:text-xl">
          Five days from now, you&apos;ll know whether your idea is worth a
          weekend — or whether to kill it and pick a better one. Either way,
          you&apos;ll know.
        </p>
        <div className="flex w-full max-w-md flex-col gap-3">
          <GuideForm />
          <p className="text-xs text-home-d3">
            Free. Unsubscribe anytime.
          </p>
        </div>
        <p className="mt-4 text-xs text-home-d3">
          WeekendMVP — your 9-to-5 pays the bills, your 5-to-9 builds the
          future.
        </p>
      </Container>
    </section>
  );
}
