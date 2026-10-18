import type { LiveFaqItem } from "@/components/live/LiveFaq";
import { LIVE_ASSETS } from "@/lib/live/config";
import { SUPPORT_EMAIL } from "@/lib/legal/support";

export const FREE_LEAVE_WITH = [
  {
    title: "The weekend test",
    body: "so you can tell in a few minutes whether an idea fits in one weekend.",
  },
  {
    title: "One real idea taken from its page to its first screen",
    body: "live, using its Prompt 1.",
  },
  {
    title: "The 48-hour plan",
    body: "what to do Friday night, Saturday and Sunday (it's in the free Starter Kit).",
  },
  {
    title: "A short list of tools to use",
    body: "and which bits they do for you so you don't build them.",
  },
  {
    title: "Your next step for tonight",
    body: "an idea to pick from the free library.",
  },
] as const;

export const WEEKEND_TEST_CHIPS = [
  { n: "01", title: "One core feature", body: "One job, done well." },
  { n: "02", title: "Three screens", body: "A landing page, an input, an output." },
  {
    n: "03",
    title: "Built on existing tools",
    body: "Let Stripe, Supabase and AI APIs do the heavy lifting.",
  },
  { n: "04", title: "A buyer you can name", body: 'Not "everyone".' },
  { n: "05", title: "About 10 hours", body: "One weekend around a day job." },
  { n: "06", title: "Prompts included", body: "Paste, run, fix, ship." },
] as const;

export const FREE_AGENDA = [
  {
    range: "0–8 MIN",
    clock: "16:00 GMT",
    title: "Why ideas die",
    body: "They're too big, and there's no buyer. Drop the idea you've been sitting on in the chat, in five words.",
  },
  {
    range: "8–18 MIN",
    clock: "16:08",
    title: "The weekend test",
    body: "The six checks, then we score two ideas from the chat.",
  },
  {
    range: "18–33 MIN",
    clock: "16:18",
    title: "Live site tour",
    body: "One idea page, its research, then Prompt 1 pasted into the tool until the first screen appears.",
  },
  {
    range: "33–43 MIN",
    clock: "16:33",
    title: "The 48-hour plan",
    body: "Friday scope, Saturday build, Sunday show 10 people.",
  },
  {
    range: "43–60 MIN",
    clock: "16:43",
    title: "Your next step + Q&A",
    body: "Pick your idea tonight, then your questions.",
  },
] as const;

export const FREE_FOR_YOU = [
  "You're a designer who wants to ship with AI and keep your taste.",
  "You're a non-technical founder with a day job and no co-founder.",
  "You have an idea, or several, and you've never got one live.",
  "You've got a Saturday and want to know what to do with it.",
] as const;

export const FREE_NOT_FOR_YOU = [
  "You want a coding course.",
  "You want a six-month program.",
] as const;

export function freeFaqItems(): LiveFaqItem[] {
  const tools = LIVE_ASSETS.toolList;
  const toolsAnswer =
    tools.length > 0
      ? `We'll use ${tools.join(", ")}. You don't need to install anything to watch. If you want to try Prompt 1 afterwards, a free account on one of these is enough to start.`
      : "Tools are confirmed before the session. You don't need to install anything to watch. If you want to try Prompt 1 afterwards, a free account on one of the tools we name is enough to start.";

  return [
    {
      question: "Is it really free?",
      answer: (
        <>
          Yes. The webinar is free, and you can watch it live without registering. Register
          (also free) and you get the replay for 7 days too. There&apos;s an optional paid
          build-along on Sat 14 Nov ($19 until 23:59 GMT Sun 8 Nov, then $29; tickets open Sun 1
          Nov). You never need it.
        </>
      ),
    },
    {
      question: "Do I need to code?",
      answer: (
        <>
          No. We use AI tools and copy-paste prompts. Knowing some code helps, but you
          don&apos;t need it to follow along or to get a first screen working.
        </>
      ),
    },
    {
      question: "What tools will you use, and do they cost anything?",
      answer: toolsAnswer,
    },
    {
      question: "I can't make it live. Is there a replay?",
      answer: (
        <>
          Yes, for registrants. Register and you&apos;ll get the replay link by email.
          It&apos;s available for 7 days after the session. After that, an edited version goes
          up publicly on YouTube.
        </>
      ),
    },
    {
      question: "What time is it for me?",
      answer: (
        <>
          Sat 31 Oct at 16:00 GMT. That&apos;s 12:00 in New York and 09:00 in Los Angeles. (UK
          clocks go back on 25 Oct and US clocks on 1 Nov, so that Saturday the gap with New
          York is 4 hours, not 5.)
        </>
      ),
    },
    {
      question: "Where does it happen?",
      answer: (
        <>
          On YouTube Live. The link is public during the live hour, so you can watch without
          registering, and it&apos;ll be on this page when we go live. Register on Luma if you
          want the reminders and the replay.
        </>
      ),
    },
    {
      question: "Do I have to register to watch?",
      answer: (
        <>
          No. You can watch live without registering. Registering gets you reminders before we
          start and the replay for 7 days afterwards, which is worth it if Saturday afternoons
          are unpredictable.
        </>
      ),
    },
    {
      question: "Will you email me?",
      answer: (
        <>
          Yes: a confirmation, reminders before the session, the replay link afterwards, and
          the Weekend MVP newsletter. You can unsubscribe at any time. Questions? Email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline decoration-home-rule underline-offset-2 hover:text-home-orange-ink"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </>
      ),
    },
    {
      question: "Do I need an idea already?",
      answer: (
        <>
          No. If you don&apos;t have one, you&apos;ll leave knowing how to pick one from the
          library tonight.
        </>
      ),
    },
  ];
}

/** Omit the tools FAQ when toolList is empty — section stays honest without naming prices. */
export function freeFaqItemsVisible(): LiveFaqItem[] {
  const all = freeFaqItems();
  if (LIVE_ASSETS.toolList.length > 0) return all;
  return all.filter((item) => item.question !== "What tools will you use, and do they cost anything?");
}
