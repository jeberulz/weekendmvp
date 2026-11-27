import Link from "next/link";
import type { ReactNode } from "react";

import { BeehiivSubscribeForm } from "@/components/forms/BeehiivSubscribeForm";
import { Container, Em, Eyebrow, TextLink } from "@/components/home/ui";
import { Icon } from "@/components/home/icons";
import { cn } from "@/lib/utils";

import { ProofHero } from "./HeroVideo";

import styles from "./proof-of-work.module.css";

export { ProofHero };

const LABEL =
  "font-mono text-[11px] font-medium uppercase leading-[1.3] tracking-[0.08em]";
const HEADING =
  "text-balance font-editorial text-[clamp(34px,4.4vw,54px)] font-normal leading-[1.05] tracking-[-0.02em]";
const SPLIT =
  "grid gap-[clamp(28px,4vw,48px)] min-[960px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[960px]:gap-16";
const STICKY =
  "min-[960px]:sticky min-[960px]:top-28 min-[960px]:self-start";
const BODY = "max-w-[62ch] leading-[1.6] text-home-ink-3";

/**
 * TODO-PROOF-AUTOMATION: the Proof of Work Beehiiv automation does not exist
 * yet. This form deliberately passes NO automationId, so the subscribe API
 * falls back to the default Weekend MVP welcome flow — never the 5-to-9
 * guide automation. Before launch: create the Proof of Work automation, add
 * its id to lib/beehiiv-client.ts (PROOF_OF_WORK_AUTOMATION_ID) and to
 * ALLOWED_AUTOMATIONS in app/api/subscribe/route.ts, then pass it here as
 * automationId and update the success copy + modal with the download link.
 * The form only confirms after the API answers; it never fakes a success.
 */
function ProofForm({ placement }: { placement: "capture" | "closing" }) {
  return (
    <div className="grid w-full max-w-[520px] gap-2 text-left">
      <BeehiivSubscribeForm
        utmCampaign="proof-of-work"
        successHref="/proof-of-work?subscribed=true"
        showFirstName={false}
        emailPlaceholder="you@work.com"
        submitLabel="Send me Proof of Work"
        emailLabelClassName="text-[13px] font-medium"
        inputClassName="h-12 min-w-0 border-home-rule bg-home-card py-0 text-base text-home-ink placeholder:text-home-ink-3 transition duration-180 hover:border-home-ink-3 focus:border-home-orange-ink focus:ring-[3px] focus:ring-home-orange-ink/22"
        buttonClassName="min-h-12 cursor-pointer whitespace-nowrap bg-home-orange-ink px-6 py-0 text-[15px] text-white duration-180 hover:bg-[#8f3f00] focus:ring-0 focus:ring-home-orange-ink disabled:cursor-wait"
      />
      <p className="text-[13px] leading-[1.6] text-home-ink-3">
        {placement === "capture"
          ? "Free, in exchange for your email address. "
          : "Free. Yours to keep. No account. "}
        Unsubscribe anytime.
      </p>
    </div>
  );
}

/** Begun-style section header: small-caps label left, number right, serif heading below. */
function SectionHead({
  eyebrow,
  number,
  title,
  id,
  dark = false,
  className,
}: {
  eyebrow: string;
  number: string;
  title: ReactNode;
  id: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("grid content-start gap-3.5", className)}>
      <div
        className={cn(
          "flex items-baseline justify-between gap-6 border-b pb-5",
          dark ? "border-white/20" : "border-home-rule",
        )}
      >
        <Eyebrow dark={dark} className={LABEL}>
          {eyebrow}
        </Eyebrow>
        <span
          aria-hidden="true"
          className={cn(
            "font-editorial text-[18px] leading-none",
            dark ? "text-home-d3" : "text-home-ink-3",
          )}
        >
          {number}
        </span>
      </div>
      <h2 id={id} className={cn(HEADING, dark && "text-home-d1")}>
        {title}
      </h2>
    </header>
  );
}

export function ProofStrip() {
  return (
    <div className={styles.strip}>
      <Container className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 text-center text-[13px] leading-[1.5]">
        <span>Free. Yours to keep. No account.</span>
        <Link
          href="#get"
          className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
        >
          Get it free
          <Icon name="arrow" size={14} strokeWidth={2} />
        </Link>
      </Container>
    </div>
  );
}

const GATES = [
  {
    n: "01",
    label: "Wins Log",
    title: "Log it.",
    text: "Thirty seconds now saves you a scramble in December.",
    href: "#inside-log",
    tone: styles.gateLime,
  },
  {
    n: "02",
    label: "Visibility",
    title: "Get it seen.",
    text: "Good work doesn't speak for itself. Say so, plainly.",
    href: "#inside-visibility",
    tone: styles.gateMint,
  },
  {
    n: "03",
    label: "Review Prep",
    title: "Bring the proof.",
    text: "Your review is a story, told with evidence.",
    href: "#inside-review",
    tone: styles.gateTeal,
  },
] as const;

export function ProofGateway() {
  return (
    <div className={styles.gateway} aria-label="The three parts of Proof of Work">
      <div className={styles.gatewayGrid}>
        {GATES.map(({ n, label, title, text, href, tone }) => (
          <Link key={n} href={href} className={cn(styles.gate, tone)}>
            <span className={styles.gateTop}>
              <span className={styles.gateLabel}>
                {n} · {label}
              </span>
              <Icon
                name="arrow"
                size={22}
                strokeWidth={1.5}
                className={styles.gateArrow}
              />
            </span>
            <span>
              <span className={styles.gateTitle}>{title}</span>
              <span className={styles.gateText}>{text}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProofCapture() {
  return (
    <section
      aria-labelledby="proof-capture-title"
      className={cn(styles.section, styles.tight)}
      id="get"
    >
      <Container className="grid justify-items-center gap-5 text-center">
        <Eyebrow className={LABEL}>Free · No account · Yours to keep</Eyebrow>
        <h2
          id="proof-capture-title"
          className="text-balance font-editorial text-[clamp(30px,3.6vw,44px)] font-normal leading-[1.08] tracking-[-0.02em]"
        >
          Get the file.
        </h2>
        <ProofForm placement="capture" />
        <p className="max-w-[62ch] text-[13px] leading-[1.6] text-home-ink-3">
          Your wins stay on your machine. Nothing is uploaded. Nothing is
          shared. This is your record, not anyone else&apos;s.
        </p>
      </Container>
    </section>
  );
}

const STEPS = [
  {
    n: "Step 01",
    title: "Log a win in 30 seconds",
    text: "Write it down while it's fresh — what you did, what changed, who it helped. At senior level, wins are influence, not output. If your work unblocked someone or changed a decision, write that down. That's the part people remember.",
  },
  {
    n: "Step 02",
    title: "Share it while it matters",
    text: "Fifteen minutes, once a week. A meeting with yourself. Go through four places — emails, calendar, notes, to-do list — and write down anything that shows progress. Your weekly wins email is built from your log.",
  },
  {
    n: "Step 03",
    title: "Bring the proof to your review",
    text: "Three prompts take your log and turn it into your story: what happened this year, which wins matter most, and how to tell it so your manager can act on it. Don't list what you did. Say what changed because you did it — and show the number.",
  },
];

export function ProofHowItWorks() {
  return (
    <section aria-labelledby="proof-how-title" className={styles.section}>
      <Container className={cn(styles.wrap, SPLIT)}>
        <div className={STICKY}>
          <SectionHead
            eyebrow="How it works"
            number="02"
            id="proof-how-title"
            title={
              <>
                Log it. <Em>Share it.</Em> Bring the proof.
              </>
            }
          />
          <p className={cn(BODY, "mt-5")}>
            One file, three parts, one habit. Thirty seconds when a win
            happens, fifteen minutes once a week, and the proof is there when
            your review comes round.
          </p>
        </div>
        <div>
          <ol role="list">
            {STEPS.map(({ n, title, text }) => (
              <li
                key={n}
                className="grid gap-2 border-t border-home-rule py-7 first:border-t-0 first:pt-0"
              >
                <span className={cn(LABEL, "text-home-orange-ink")}>{n}</span>
                <h3 className="font-editorial text-[clamp(22px,2.2vw,26px)] leading-[1.15] tracking-[-0.01em]">
                  {title}
                </h3>
                <p className={BODY}>{text}</p>
              </li>
            ))}
          </ol>
          <div className={cn(styles.card, "mt-8 p-6 sm:p-7")}>
            <div className="flex items-baseline justify-between gap-4 border-b border-home-rule pb-4">
              <h3 className="font-editorial text-[22px] leading-[1.15]">
                Wins log
              </h3>
              <span className={cn(LABEL, "text-home-ink-3")}>Example</span>
            </div>
            <dl className="grid gap-0">
              {[
                ["Date", "12 Nov"],
                ["Project", "Onboarding rebuild"],
                ["What you did", "Rebuilt the onboarding flow"],
                [
                  "Impact",
                  "New users now finish setup in 4 minutes instead of 12.",
                ],
              ].map(([term, value]) => (
                <div
                  key={term}
                  className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 border-b border-home-rule py-3.5 text-[15px] leading-[1.55] last:border-b-0"
                >
                  <dt className={cn(LABEL, "pt-[3px] text-home-ink-3")}>
                    {term}
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[13px] leading-[1.6] text-home-ink-3">
              An example entry. Your log holds your real wins — what you did,
              what changed, who it helped.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

const STATS = [
  { value: "3", label: "parts to the framework" },
  { value: "8", label: "visibility tactics" },
  { value: "3", label: "review prompts" },
  { value: "30", label: "seconds to log a win" },
  { value: "15", label: "minutes, once a week" },
];

export function ProofNumbers() {
  return (
    <section
      aria-labelledby="proof-numbers-title"
      className={cn(styles.section, styles.numbers)}
    >
      <Container className="grid gap-10 text-center">
        <div className="grid justify-items-center gap-3.5">
          <Eyebrow dark className={LABEL}>
            The numbers
          </Eyebrow>
          <h2
            id="proof-numbers-title"
            className="max-w-[20ch] text-balance font-editorial text-[clamp(34px,4.4vw,54px)] font-normal leading-[1.05] tracking-[-0.02em] text-home-d1"
          >
            Five numbers. <Em dark>That&apos;s the whole system.</Em>
          </h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 min-[860px]:grid-cols-5">
          {STATS.map(({ value, label }) => (
            <div key={label} className="grid content-start gap-2">
              <dd className="font-editorial text-[clamp(56px,7vw,88px)] leading-none text-home-d1">
                {value}
              </dd>
              <dt className="text-[13px] leading-[1.5] text-home-d2">
                {label}
              </dt>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

const TACTICS = [
  {
    n: "01",
    name: "Don't assume your work speaks for itself",
    line: "If you don't mention a win, it didn't happen.",
  },
  {
    n: "02",
    name: "Send a weekly wins email to your manager",
    line: "Same thread every week. By review time, the whole year is in one place.",
  },
  {
    n: "03",
    name: "Back every win with a number",
    line: "A number is. If you can't find one, find a before and after.",
  },
  {
    n: "04",
    name: "Keep your elevator pitch ready",
    line: "Four lines. Thirty seconds.",
  },
  {
    n: "05",
    name: "Build relationships outside your team",
    line: "Promotions are decided by people who know your name.",
  },
  {
    n: "06",
    name: "Get more from your mentors",
    line: "Bring your thinking, not just your questions.",
  },
  {
    n: "07",
    name: "Choose mentors by influence",
    line: "You need both: influence and expertise.",
  },
  {
    n: "08",
    name: "Ask what it takes to get promoted",
    line: "Stop guessing. Ask the person who decides.",
  },
];

export function ProofTactics() {
  const firstRow = TACTICS.slice(0, 4);
  const secondRow = TACTICS.slice(4);
  const renderRow = (row: typeof TACTICS, offset: boolean) => (
    <div
      className={cn(
        "grid gap-4 min-[860px]:grid-cols-4",
        offset && styles.tacticRowOffset,
      )}
    >
      {row.map(({ n, name, line }) => (
        <article key={n} className={cn(styles.card, "grid content-start gap-3 p-6")}>
          <span className={cn(LABEL, "text-home-orange-ink")}>{n}</span>
          <h3 className="font-editorial text-[22px] leading-[1.2] tracking-[-0.01em]">
            {name}
          </h3>
          <p className="text-[15px] leading-[1.55] text-home-ink-3">{line}</p>
        </article>
      ))}
    </div>
  );
  return (
    <section
      aria-labelledby="proof-tactics-title"
      className={cn(styles.section, styles.tactics)}
    >
      <Container>
        <div className="mb-[clamp(28px,4vw,44px)] flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            eyebrow="The tactics"
            number="04"
            id="proof-tactics-title"
            title={
              <>
                Eight habits. <Em>Plainly, and on purpose.</Em>
              </>
            }
          />
          <TextLink href="#get">See all eight in the file</TextLink>
        </div>
        <div className="grid gap-4">
          {renderRow(firstRow, false)}
          {renderRow(secondRow, true)}
        </div>
        <p className={cn(BODY, "mt-8")}>
          The full do&apos;s, don&apos;ts and &ldquo;do this week&rdquo; for
          each habit live in the file.
        </p>
      </Container>
    </section>
  );
}

const PARTS = [
  {
    id: "inside-log",
    n: "01",
    label: "Wins Log",
    heading: "Your memory is not a filing system.",
    intro:
      "Write the win down while it's fresh — what you did, what changed, who it helped. Thirty seconds now saves you a scramble in December.",
    lines: [
      "Capture a win in 30 seconds",
      "What changed, with a number",
      "Weekly sweep: emails, calendar, notes, to-dos",
    ],
    visual: (
      <dl className="grid gap-0 text-[14px] leading-[1.55]">
        {[
          ["Date", "12 Nov"],
          ["Project", "Onboarding rebuild"],
          ["Impact", "Setup now takes 4 minutes, not 12."],
        ].map(([term, value]) => (
          <div
            key={term}
            className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 border-b border-home-rule py-2.5 last:border-b-0"
          >
            <dt className={cn(LABEL, "pt-[2px] text-home-ink-3")}>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    ),
  },
  {
    id: "inside-visibility",
    n: "02",
    label: "Visibility",
    heading: "Good work doesn't speak for itself.",
    intro:
      "Nobody is watching your calendar. If you don't tell people what you did, they assume nothing happened. These eight habits make your work visible — plainly, and on purpose.",
    lines: [
      "Eight habits, plainly and on purpose",
      "Weekly wins email, drafted from your log",
      "Elevator pitch, ready in 30 seconds",
    ],
    visual: (
      <div className="grid gap-2 text-[14px] leading-[1.55]">
        <p>
          <span className="font-semibold">To:</span> your manager
        </p>
        <p>
          <span className="font-semibold">This week:</span> rebuilt the
          onboarding flow — setup now takes 4 minutes, not 12.
        </p>
        <p className="text-home-ink-3">Same thread, every week.</p>
      </div>
    ),
  },
  {
    id: "inside-review",
    n: "03",
    label: "Review Prep",
    heading: "Your review is a story, told with evidence.",
    intro:
      "Three prompts take your log and turn it into that story: what happened this year, which wins matter most, and how to tell it so your manager can act on it.",
    lines: [
      "Reconstruct your year, then rank your wins",
      "CARL stories: Context, Action, Results, Learning",
      "A short document and one slide to bring",
    ],
    visual: (
      <ul role="list" className="grid grid-cols-2 gap-2 text-[14px]">
        {["Context", "Action", "Results", "Learning"].map((word) => (
          <li
            key={word}
            className="rounded-[8px] border border-home-rule bg-home-paper px-3 py-2.5 font-medium"
          >
            {word}
          </li>
        ))}
      </ul>
    ),
  },
];

export function ProofParts() {
  return (
    <section aria-labelledby="proof-parts-title" className={styles.section}>
      <Container>
        <SectionHead
          eyebrow="What's inside"
          number="05"
          id="proof-parts-title"
          title={
            <>
              Three parts. <Em>One file.</Em>
            </>
          }
          className="mb-[clamp(28px,4vw,44px)]"
        />
        <div className="grid gap-4 min-[860px]:grid-cols-3 min-[860px]:gap-6">
          {PARTS.map(({ id, n, label, heading, intro, lines, visual }) => (
            <article
              key={id}
              id={id}
              className={cn(styles.card, "grid content-start gap-4 p-7")}
            >
              <div className="flex items-baseline justify-between gap-4 border-b border-home-rule pb-4">
                <span className={cn(LABEL, "text-home-orange-ink")}>
                  {label}
                </span>
                <span
                  aria-hidden="true"
                  className="font-editorial text-[18px] leading-none text-home-ink-3"
                >
                  {n}
                </span>
              </div>
              <h3 className="font-editorial text-[clamp(22px,2.2vw,26px)] leading-[1.15] tracking-[-0.01em]">
                {heading}
              </h3>
              <p className="text-[15px] leading-[1.6] text-home-ink-3">
                {intro}
              </p>
              <ul role="list" className="grid gap-0 border-t border-home-rule">
                {lines.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-3 border-b border-home-rule py-3 text-[15px] leading-[1.55] last:border-b-0"
                  >
                    <Icon
                      name="check"
                      size={18}
                      strokeWidth={2}
                      className="mt-[2px] shrink-0 text-home-orange-ink"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="rounded-[10px] border border-home-rule bg-home-paper p-4">
                <p className={cn(LABEL, "mb-3 text-home-ink-3")}>Example</p>
                {visual}
              </div>
              <TextLink href="#get">See it in the file</TextLink>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

const FAQS: { question: string; answer: ReactNode }[] = [
  {
    question: "Is it really free?",
    answer:
      "Yes. Free, in exchange for your email address. That's the deal. No subscription, no account, no card.",
  },
  {
    question: "Where does my data go?",
    answer:
      "Nowhere. Your wins stay on your machine. Nothing is uploaded. Nothing is shared. This is your record, not anyone else's.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. You download one file and open it in your browser. No login, no password, nothing to install.",
  },
  {
    question: "What do I get?",
    answer:
      "One file with three parts: a wins log you fill in as you go, eight visibility habits with a weekly wins email drafted from your log, and three prompts that turn your log into your review story.",
  },
  {
    question: "What happens after I sign up?",
    answer:
      "You get the file. Download it, open it, and start logging. Thirty seconds per win, fifteen minutes a week, and the proof is there when your review comes round.",
  },
];

export function ProofFaq() {
  return (
    <section
      aria-labelledby="proof-faq-title"
      className={cn(styles.section, styles.faq)}
    >
      <Container className={cn(styles.wrap, SPLIT)}>
        <SectionHead
          eyebrow="Questions"
          number="06"
          id="proof-faq-title"
          title={
            <>
              Questions, <Em>answered plainly.</Em>
            </>
          }
          className={STICKY}
        />
        <div>
          {FAQS.map(({ question, answer }, index) => (
            <details
              key={question}
              open={index === 0}
              className="group border-t border-home-rule last:border-b"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-[22px] font-editorial text-[clamp(20px,2vw,24px)] leading-[1.2] transition-colors duration-180 hover:text-home-orange-ink [&::-webkit-details-marker]:hidden">
                {question}
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-home-rule font-mono text-base leading-none text-home-orange-ink transition-colors duration-180 group-hover:border-home-orange-ink"
                >
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

export function ClosingCapture() {
  return (
    <section
      aria-labelledby="proof-closing-title"
      className={cn(styles.section, styles.tight)}
    >
      <Container className={styles.wrap}>
        <div
          className={cn(
            styles.card,
            styles.dots,
            "home-dots grid justify-items-center gap-[18px] px-[clamp(24px,5vw,64px)] py-[clamp(40px,6vw,72px)] text-center",
          )}
        >
          <Eyebrow className={LABEL}>Proof of Work · free</Eyebrow>
          <h2
            id="proof-closing-title"
            className={cn(HEADING, "max-w-[22ch]")}
          >
            A year of proof, <Em>already written.</Em>
          </h2>
          <p className={cn(BODY, "mb-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg")}>
            <span>Log it.</span>
            <Icon
              name="arrow"
              size={18}
              strokeWidth={1.75}
              className="text-home-orange-ink"
            />
            <span>Get it seen.</span>
            <Icon
              name="arrow"
              size={18}
              strokeWidth={1.75}
              className="text-home-orange-ink"
            />
            <span>Bring the proof.</span>
          </p>
          <ProofForm placement="closing" />
        </div>
      </Container>
    </section>
  );
}
