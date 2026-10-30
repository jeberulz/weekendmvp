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
    body: "Millilitres per hour, updated as the heat, the climb and your pace change.",
  },
  {
    title: "A next-packet time",
    body: "When to take your next electrolyte or carb packet.",
  },
  {
    title: "A “Took a sip” button",
    body: "One tap logs it, with your other hand still on a pole.",
  },
] as const;

export type ScreenKey = "landing" | "setup" | "hike" | "recap";

export const HYDROTRAIL_SCREENS: readonly {
  key: ScreenKey;
  title: string;
  status: string;
  promised?: boolean;
  body: string;
}[] = [
  {
    key: "landing",
    title: "Landing",
    status: "Promised",
    promised: true,
    body: "What HydroTrail is and who it's for.",
  },
  {
    key: "setup",
    title: "Setup",
    status: "Planned",
    body: "Weight, duration, temperature, humidity and your packets.",
  },
  {
    key: "hike",
    title: "Live hike",
    status: "Planned",
    body: "The sip target, a countdown and the packet prompt.",
  },
  {
    key: "recap",
    title: "Recap",
    status: "If time holds",
    body: "Planned against confirmed intake, and a sweat-rate tweak.",
  },
];

export const FREE_AGENDA: readonly {
  clock: string;
  /** Clock is approximate: shown as "~", read as "About". */
  approx?: boolean;
  title: string;
  body?: string;
  mark?: string;
}[] = [
  {
    clock: "16:00",
    title: "Why HydroTrail",
    body: "I explain the idea and open an empty folder. Put the idea you've been sitting on in the chat, in five words.",
  },
  {
    clock: "16:08",
    title: "The weekend test",
    body: "I score HydroTrail against the six checks, then two ideas from the chat.",
  },
  {
    clock: "16:18",
    title: "The idea page and Prompt 1",
    body: "I open the HydroTrail idea page and its research, then paste Prompt 1 into Claude Code.",
  },
  {
    clock: "16:25",
    approx: true,
    title: "First screen working",
    body: "The landing screen runs, built from the empty folder.",
    mark: "This is the promise.",
  },
  {
    clock: "16:27–16:43",
    title: "Setup and the live hike",
    body: "The next two screens, then the recap if time holds.",
  },
  {
    clock: "16:45",
    approx: true,
    title: "Deploy",
    body: "If it holds, it goes live on a public link before the hour's up.",
    mark: "A bonus, not a promise.",
  },
  {
    clock: "16:50",
    title: "Your questions",
    body: "Ask anything, including how to run the same steps on your own idea.",
  },
  { clock: "17:00", title: "Close" },
];

export const PROMISE = [
  {
    term: "Promised",
    body: "HydroTrail's first working screen, built live from an empty folder.",
  },
  { term: "Planned", body: "Setup and the live hike, then the recap if time holds." },
  {
    term: "Not promised",
    body: "A public link. If it holds, it goes live before the hour's up.",
  },
] as const;

export const WEEKEND_TEST = [
  { title: "One core feature", body: "A sip target that moves with the trail." },
  { title: "Three screens", body: "Setup, live hike and recap." },
  { title: "Existing tools", body: "Claude Code, Next.js, Tailwind and shadcn." },
  { title: "A buyer you can name", body: "Weekend day-hikers." },
  { title: "About 10 hours", body: "To a first version, around a day job." },
  { title: "Prompts included", body: "The build prompts are on the idea page." },
] as const;

export const FREE_LEAVE_WITH = [
  "The order I work in: prompts first, then one screen at a time. You can run it on your own idea.",
  "The six weekend-test checks, to score your own idea.",
  "The 48-hour plan from the free Starter Kit, for Friday night, Saturday and Sunday.",
] as const;

export const FREE_FOR_YOU = [
  "Designers who want to build their own product with AI.",
  "Non-technical founders with a day job and no co-founder.",
  "Anyone with an idea, or several, who has never got one live.",
] as const;

export const FREE_NOT_FOR_YOU = "It isn't a coding course or a six-month program.";

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
          Yes. Watching is free, and so is registering, which gets you the replay for 7 days.
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
      question: "Do I have to register to watch?",
      answer: (
        <>
          No. It&apos;s on YouTube Live, the link is public, and it&apos;ll be on this page when
          we start. Register on Luma if you want a reminder and the replay.
        </>
      ),
    },
    {
      question: "I can't make it live. Is there a replay?",
      answer: (
        <>
          Yes, for registrants. You&apos;ll get the replay link by email, and it stays up for 7
          days. After that, an edited version goes up publicly on YouTube.
        </>
      ),
    },
    {
      question: "What time is it for me?",
      answer: (
        <>
          16:00 GMT on Sat 31 Oct, which is 12:00 in New York and 09:00 in Los Angeles. The
          line under the register button shows your own time.
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
          library.
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
