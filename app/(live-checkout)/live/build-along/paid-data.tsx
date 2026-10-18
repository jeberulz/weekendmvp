import type { LiveFaqItem } from "@/components/live/LiveFaq";
import {
  LIVE_ASSETS,
  NEXT_BUILD_ALONG,
  POLICY_ANCHOR,
  POLICY_SECTION_LIVE,
} from "@/lib/live/config";
import { SUPPORT_EMAIL } from "@/lib/legal/support";
import Link from "next/link";

export const GUARANTEE_SHORT =
  "Full refund within 30 days of purchase, no reason needed.";

export const GUARANTEE_PULLQUOTE =
  "Full refund within 30 days of purchase, no reason needed. Just email us. A refund ends your replay access.";

export const CANCELLATION_LINE =
  "We'll email you if we cancel. Reply within 48 hours if you'd rather move to the next date. Otherwise we refund you in full, automatically. If we cancel and you move to a later date, your 30 days start again from the day we cancel. The next date is Sat 5 Dec 2026, 15:00 GMT, on Zoom.";

export const PAID_INCLUDED = [
  "2 hours live on Zoom with John",
  "The Ship Sheet: your 48-hour plan, as a doc you can copy",
  "The copy-paste prompts used in the session",
  "The replay, with no expiry",
  "A prep email before the session, so you arrive ready to build",
] as const;

export const PAID_AGENDA = [
  {
    range: "0–10 MIN",
    clock: "15:00 GMT",
    title: "Open",
    body: "What we're doing today. Everyone opens the Ship Sheet.",
  },
  {
    range: "10–30 MIN",
    clock: "15:10",
    title: "Move 1: Your sharpest idea",
    body: "Run your idea through the weekend test. Post your one-liner in the chat and I'll react to as many as time allows.",
  },
  {
    range: "30–55 MIN",
    clock: "15:30",
    title: "Move 2: The weekend cut",
    body: "Cut it to three screens and one action. We kill features out loud.",
  },
  {
    range: "55–95 MIN",
    clock: "15:55",
    title: "Move 3: Build and deploy",
    body: "I build an example live. You build yours at the same time and paste your link in the chat when it's up.",
  },
  {
    range: "95–105 MIN",
    clock: "16:35",
    title: "Ship it safely",
    body: "Three checks before you share the link: nothing private shows in view-source, your keys aren't in the repo, and the login actually protects the data.",
  },
  {
    range: "105–110 MIN",
    clock: "16:45",
    title: "First users",
    body: "Pick one channel, write the first post, and decide which 10 people you'll show it to on Sunday.",
  },
  {
    range: "110–120 MIN",
    clock: "16:50",
    title: "Q&A",
    body: "Your questions, and links in the chat.",
  },
] as const;

export const PAID_FOR_YOU = [
  "You're a designer who wants to ship something real with AI, and keep your taste in it.",
  "You're a non-technical founder with a day job and no co-founder.",
  "You've watched enough tutorials and want to actually build one.",
  "You'd rather have someone to ask when it breaks.",
] as const;

export const PAID_NOT_FOR_YOU = [
  "You want a coding course.",
  "You want a six-month program.",
  "You want to sit back and watch. You'll build during the session, so this isn't a watch-only webinar. (The free webinar on 31 Oct is the watch-only one.)",
] as const;

export const DEAL_FALLBACK =
  "You leave with your MVP's first version built, and the steps to put it live the same day.";

export const DEAL_DRY_RUN =
  "You leave with a live URL. Not notes.";

export const PERSONAL_NOTE_PS_EARLY =
  "It's $19 until 23:59 GMT Sun 8 Nov, then $29. The session is Sat 14 Nov at 15:00 GMT, and the replay is yours to keep if you can't make it live.";

export const PERSONAL_NOTE_PS_STANDARD =
  "The session is Sat 14 Nov at 15:00 GMT, and the replay is yours to keep if you can't make it live.";

function RefundPolicyLink({ className }: { className?: string }) {
  if (!POLICY_SECTION_LIVE) return null;
  return (
    <Link
      href={POLICY_ANCHOR}
      className={
        className ??
        "underline decoration-home-rule underline-offset-2 hover:text-home-orange-ink"
      }
    >
      Read the refund policy
    </Link>
  );
}

export function paidFaqItems(priceLine: string): LiveFaqItem[] {
  const tools = LIVE_ASSETS.toolList;
  const toolsQ = {
    question: "Which tools will we use, and what will they cost me?",
    answer:
      tools.length > 0
        ? `We'll use ${tools.join(", ")}. Free accounts are enough for the session. The prep email tells you exactly what to set up and how.`
        : "Tools are confirmed in the prep email before the session. Free accounts are enough. The prep email tells you exactly what to set up and how.",
  };

  const items: LiveFaqItem[] = [
    {
      question: "Do I need to code?",
      answer: (
        <>
          No. We build with AI tools and copy-paste prompts. If you can follow steps and paste
          text, you can follow along. Knowing some code helps, but you don&apos;t need it.
        </>
      ),
    },
    ...(tools.length > 0 ? [toolsQ] : []),
    {
      question: "What if my idea isn't ready, or I don't have one?",
      answer: (
        <>
          That&apos;s fine. In Move 1 we run ideas through the weekend test. If yours
          doesn&apos;t fit, or you don&apos;t have one, you&apos;ll pick one from the library
          and build that.
        </>
      ),
    },
    {
      question: "I can't make it live. Should I still buy?",
      answer: (
        <>
          You can. Your ticket includes the replay, with no expiry, plus the Ship Sheet and
          prompts. You&apos;ll miss asking questions live, so if that&apos;s what you want, come
          live.
        </>
      ),
    },
    {
      question: "How many seats are there?",
      answer: (
        <>
          20. When they&apos;re gone, tickets close and the next build-along is{" "}
          {NEXT_BUILD_ALONG.label}.
        </>
      ),
    },
    {
      question: "What time is it for me?",
      answer: (
        <>
          Sat 14 Nov, 15:00–17:00 GMT. That&apos;s 10:00–12:00 in New York and 07:00–09:00 in
          Los Angeles.
        </>
      ),
    },
    {
      question: "Where does it happen?",
      answer: (
        <>
          On Zoom. The join link comes by email after you buy, and again in the reminders
          before the session.
        </>
      ),
    },
    {
      question: "Is this the same as the free webinar?",
      answer: (
        <>
          No. The free webinar on 31 Oct is an hour of watching: the method and one idea taken
          to a first screen. This is two hours of building your own, with me building alongside
          you. If you came to the free one, this is the next step. If you didn&apos;t, the
          build-along still starts from the beginning.
        </>
      ),
    },
    {
      question: "Can I get a refund?",
      answer: (
        <>
          Yes. {GUARANTEE_PULLQUOTE} Email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline decoration-home-rule underline-offset-2 hover:text-home-orange-ink"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          from the address you bought with.
          {POLICY_SECTION_LIVE ? (
            <>
              {" "}
              <RefundPolicyLink />.
            </>
          ) : null}
        </>
      ),
    },
    {
      question: "What if the session is cancelled?",
      answer: <>{CANCELLATION_LINE}</>,
    },
    {
      question: "What currency is the price in?",
      answer: (
        <>
          US dollars: {priceLine}. Price shown in USD. Any tax is shown at checkout.
        </>
      ),
    },
  ];

  return items;
}
