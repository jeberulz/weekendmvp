import type { LiveFaqItem } from "@/components/live/LiveFaq";
import { LIVE_ASSETS } from "@/lib/live/config";
import { SUPPORT_EMAIL } from "@/lib/legal/support";

/** Saturday's demo build. Facts mirror the idea page and the run-of-show. */
export const HYDROTRAIL = {
  name: "HydroTrail",
  oneLiner: "a hydration coach for hikers",
  hook: "Your bladder is full. Your plan is already wrong.",
} as const;

export const HYDROTRAIL_OUTPUTS = [
  {
    title: "A sip target",
    body: "In ml per hour. It moves when the heat, the climb or your pace does.",
  },
  {
    title: "A next-packet time",
    body: "When to take the electrolyte or carb packet you're actually carrying.",
  },
  {
    title: "A button for your thumb",
    body: "“Took a sip”. One tap, with the other hand still on a pole.",
  },
] as const;

/** Example rules from the engine: plain TypeScript, not AI on every step. */
export const HYDROTRAIL_RULES = [
  { when: "Heat over 24°C", then: "raises the sip target" },
  { when: "Altitude over 2,500 m", then: "raises the sip target" },
  { when: "Grade over 8%", then: "raises the sip target" },
  { when: "Hard cap of 1.2 L/h", then: "“slow down, find shade”" },
] as const;

export type ScreenKey = "landing" | "setup" | "hike" | "recap";

export const HYDROTRAIL_SCREENS: readonly {
  key: ScreenKey;
  n: string;
  title: string;
  badge?: string;
  body: string;
}[] = [
  {
    key: "landing",
    n: "01",
    title: "Landing",
    badge: "The promise",
    body: "The first screen. What HydroTrail is and who it's for.",
  },
  {
    key: "setup",
    n: "02",
    title: "Setup",
    body: "Weight, duration, temperature, humidity, and your electrolyte and carb packets.",
  },
  {
    key: "hike",
    n: "03",
    title: "Live hike",
    body: "Sip target in ml/h, a next-sip countdown, “Took a sip”, and a packet prompt.",
  },
  {
    key: "recap",
    n: "04",
    title: "Recap",
    badge: "If time holds",
    body: "Planned vs confirmed intake, packets taken, and a sweat-rate tweak.",
  },
];

export const FREE_LEAVE_WITH = [
  {
    title: "A working pattern you can copy",
    body: "the same order of prompts and screens, ready to point at your own idea.",
  },
  {
    title: "The weekend test",
    body: "so you can tell in a few minutes whether an idea fits in one weekend.",
  },
  {
    title: "The 48-hour plan",
    body: "what to do Friday night, Saturday and Sunday (it's in the free Starter Kit).",
  },
  {
    title: "The free idea library",
    body: "every idea researched, sized for a weekend and paired with build prompts.",
  },
] as const;

export const WEEKEND_TEST_CHIPS = [
  { n: "01", title: "One core feature", body: "A sip target that moves with the trail." },
  { n: "02", title: "Three screens", body: "Setup, live hike, recap." },
  {
    n: "03",
    title: "Existing tools",
    body: "Claude Code, Next.js, Tailwind and shadcn. Storage stays on the device.",
  },
  { n: "04", title: "A buyer you can name", body: "Weekend day-hikers." },
  { n: "05", title: "About 10 hours", body: "One weekend around a day job." },
  { n: "06", title: "Prompts included", body: "The build prompts are on the idea page." },
] as const;

export const FREE_AGENDA: readonly {
  clock: string;
  title: string;
  body: string;
  tag?: string;
}[] = [
  {
    clock: "16:00",
    title: "The hook and the empty folder",
    body: "“Your bladder is full. Your plan is already wrong.” Why HydroTrail, and an empty folder on screen. Drop the idea you've been sitting on in the chat, in five words.",
  },
  {
    clock: "16:08",
    title: "The weekend test",
    body: "The six checks. We score HydroTrail, then two ideas from the chat.",
  },
  {
    clock: "16:18",
    title: "The idea page and Prompt 1",
    body: "The HydroTrail idea page and its research, then Prompt 1 pasted into Claude Code.",
  },
  {
    clock: "~16:25",
    title: "First screen live",
    body: "The landing screen running, built from that empty folder.",
    tag: "The promise",
  },
  {
    clock: "16:27–16:43",
    title: "Setup, live hike, recap",
    body: "The rest of the loop, screen by screen. If something breaks, you'll see me fix it.",
  },
  {
    clock: "~16:45",
    title: "Deploy",
    body: "If it holds, it goes live on a public link before the hour's up.",
    tag: "Bonus",
  },
  {
    clock: "16:50",
    title: "Q&A",
    body: "Your questions, and how to run the same pattern on your own idea.",
  },
  {
    clock: "17:00",
    title: "Close",
    body: "Registrants get the replay by email for 7 days.",
  },
];

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
          (also free) and you get the replay for 7 days too.
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
