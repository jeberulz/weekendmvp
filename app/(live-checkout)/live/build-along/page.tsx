import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { HostBlock } from "@/components/live/HostBlock";
import { LiveButton } from "@/components/live/LiveButton";
import { LiveFaq } from "@/components/live/LiveFaq";
import { LocalTime } from "@/components/live/LocalTime";
import { RecordSignupSrc } from "@/components/live/RecordSignupSrc";
import { TicketCheckoutButton } from "@/components/live/TicketCheckoutButton";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { Em } from "@/components/home/ui";
import { JsonLd } from "@/components/primitives/JsonLd";
import { SUPPORT_EMAIL } from "@/lib/legal/support";
import {
  BUILD_ALONG,
  LIVE_ASSETS,
  LIVE_BUILDALONG_SIGNUP_SRC,
  LIVE_WORKSHOP_SELLER_LINE,
  NEXT_BUILD_ALONG,
  POLICY_ANCHOR,
  POLICY_SECTION_LIVE,
  STARTUP_IDEAS_PAID_HREF,
} from "@/lib/live/config";
import { livePriceAt } from "@/lib/live/pricing";
import { buildAlongPhase } from "@/lib/live/schedule";
import { seatsLine, type SeatsInfo } from "@/lib/live/seats";
import { loadSeatsInfo } from "@/lib/live/seats-server";
import { readLiveClockMs } from "@/lib/live/now";
import {
  SITE,
  breadcrumbSchema,
  buildGraph,
  organizationSchema,
  personSchema,
} from "@/lib/seo";

import {
  CANCELLATION_LINE,
  DEAL_DRY_RUN,
  DEAL_FALLBACK,
  GUARANTEE_PULLQUOTE,
  GUARANTEE_SHORT,
  PAID_AGENDA,
  PAID_FOR_YOU,
  PAID_INCLUDED,
  PAID_NOT_FOR_YOU,
  PERSONAL_NOTE_PS_EARLY,
  PERSONAL_NOTE_PS_STANDARD,
  paidFaqItems,
} from "./paid-data";

const TITLE = "Weekend MVP Build-Along — Build it Saturday, ship it Sunday";
const DESCRIPTION =
  "A 2-hour live build-along on Zoom. Sat 14 Nov 2026, 15:00 GMT. You build your MVP while I build mine. $19 until 23:59 GMT Sun 8 Nov, then $29. 20 seats. Replay included.";

export const instant = false;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  authors: [{ name: "John Iseghohi" }],
  alternates: { canonical: "/live/build-along" },
  openGraph: {
    type: "website",
    siteName: "Weekend MVP",
    locale: "en_GB",
    url: `${SITE}/live/build-along`,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE}/image/og-image.png`,
        alt: "Weekend MVP Build-Along",
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@weekendmvp",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE}/image/og-image.png`],
  },
};

const SCHEMA = buildGraph(
  personSchema(),
  organizationSchema(),
  breadcrumbSchema([
    { label: "Home", href: `${SITE}/` },
    { label: "Live", href: `${SITE}/live` },
    { label: "Build-Along", href: `${SITE}/live/build-along` },
  ]),
  {
    "@type": "EducationEvent",
    name: BUILD_ALONG.title,
    description: DESCRIPTION,
    startDate: new Date(BUILD_ALONG.startAt).toISOString(),
    endDate: new Date(BUILD_ALONG.endAt).toISOString(),
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    isAccessibleForFree: false,
    location: {
      "@type": "VirtualLocation",
      url: `${SITE}/live/build-along`,
    },
    organizer: { "@id": `${SITE}/#organization` },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: String(BUILD_ALONG.earlyBirdUsd),
      availability: "https://schema.org/InStock",
      url: `${SITE}/live/build-along#ticket`,
    },
  },
);

function CheckList({
  items,
  variant = "check",
}: {
  items: readonly string[];
  variant?: "check" | "x";
}) {
  return (
    <ul className="mt-3 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-home-ink">
          <span
            aria-hidden="true"
            className={
              variant === "check"
                ? "mt-0.5 font-mono text-home-orange"
                : "mt-0.5 font-mono text-[#6B6457]"
            }
          >
            {variant === "check" ? "✓" : "×"}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function GuaranteeLine() {
  return (
    <p className="text-sm text-[#4A453C]">
      <span aria-hidden="true" className="text-home-orange">
        ✓{" "}
      </span>
      {GUARANTEE_SHORT}
    </p>
  );
}

function TicketCard({
  price,
  seats,
  soldOut,
  disabled,
}: {
  price: ReturnType<typeof livePriceAt>;
  seats: SeatsInfo;
  soldOut: boolean;
  disabled: boolean;
}) {
  return (
    <div
      id="ticket"
      className="relative overflow-hidden rounded-2xl border border-home-rule bg-home-card p-7"
    >
      {price.earlyBird && !soldOut ? (
        <div className="absolute top-0 right-0 rounded-bl-xl bg-home-orange px-3.5 py-1.5 font-mono text-[11px] tracking-[0.1em] text-white uppercase">
          Early-bird
        </div>
      ) : null}
      <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
        {BUILD_ALONG.title}
        {price.earlyBird && !soldOut ? " · 20 seats" : " · 20 seats"}
      </p>
      {soldOut ? (
        <>
          <h3 className="font-editorial mt-3 text-3xl font-medium tracking-tight">
            Sat 14 Nov is full.
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-[#4A453C]">
            All 20 seats are taken. The next build-along is {NEXT_BUILD_ALONG.label}. Same 2
            hours, same price rules, 20 seats.
          </p>
          <div className="mt-5">
            <TicketCheckoutButton
              label="Get a seat for 5 Dec"
              nextSession
              fullWidth
              className="w-full"
            />
          </div>
          <p className="mt-3 text-center text-sm">
            <Link
              href="/starter-kit"
              className="underline decoration-home-rule underline-offset-4"
            >
              Get the free Starter Kit
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className="mt-3.5 flex flex-wrap items-baseline gap-3.5">
            <span className="font-editorial text-[60px] leading-none tracking-[-0.02em] sm:text-[72px]">
              {price.amountLabel}
            </span>
            {price.untilLine ? (
              <span className="text-[#6B6457]">{price.untilLine}</span>
            ) : null}
          </div>
          <p className="mt-2.5 text-sm text-home-ink">{seatsLine(seats)}</p>
          {price.earlyBird ? (
            <p className="mt-1.5 font-mono text-xs text-[#6B6457]">
              Switches to $29 at 23:59 GMT Sun 8 Nov, in step with Stripe
            </p>
          ) : null}
          <div
            className="relative my-5 border-t-2 border-dashed border-home-rule"
            aria-hidden="true"
          />
          <ul className="space-y-2.5 text-sm">
            {PAID_INCLUDED.map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden="true" className="text-home-orange">
                  ✓
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            {disabled ? (
              <LiveButton disabled className="w-full">
                Tickets open Sun 1 Nov
              </LiveButton>
            ) : (
              <TicketCheckoutButton
                label={`Get my ticket, ${price.amountLabel}`}
                fullWidth
                className="w-full"
              />
            )}
          </div>
          <p className="mt-2.5 text-center font-mono text-xs text-[#6B6457]">
            Sat 14 Nov 2026 · 15:00–17:00 GMT · Price shown in USD. Any tax is shown at
            checkout. {LIVE_WORKSHOP_SELLER_LINE}
          </p>
          <div className="mt-3">
            <GuaranteeLine />
          </div>
        </>
      )}
    </div>
  );
}

export default async function BuildAlongPage({
  searchParams,
}: {
  searchParams: Promise<{ thanks?: string; src?: string }>;
}) {
  const params = await searchParams;
  const thanks = params.thanks === "1";
  const signupSrc =
    params.src === LIVE_BUILDALONG_SIGNUP_SRC ? LIVE_BUILDALONG_SIGNUP_SRC : null;
  await connection();
  const now = readLiveClockMs();
  const price = livePriceAt(now);
  const seats = await loadSeatsInfo();
  const phase = buildAlongPhase(now);
  const ended = phase === "ended";
  const soldOut = seats.soldOut && !ended && !thanks;
  const preSale = phase === "pre_sale";
  const proof = LIVE_ASSETS.paidProofQuotes;
  const dealLine = LIVE_ASSETS.dryRunPassed ? DEAL_DRY_RUN : DEAL_FALLBACK;
  const tools = LIVE_ASSETS.toolList;
  const signupRecorder = signupSrc ? (
    <WhenConvexReady>
      <RecordSignupSrc src={signupSrc} />
    </WhenConvexReady>
  ) : null;

  const hostBody = (
    <>
      {LIVE_ASSETS.hostEveningsConfirmed
        ? "I build Weekend MVP around a full-time job, on evenings and Saturdays, so this session is designed for people who have the same amount of time. "
        : "This session is designed for people building around a day job. "}
      Every idea on the site is researched, sized for a weekend and paired with prompts. In
      this session we use that method on your idea.
    </>
  );

  if (thanks) {
    return (
      <div className="mx-auto max-w-[720px] px-5 py-16 sm:px-10 sm:py-24">
        {signupRecorder}
        <JsonLd schema={SCHEMA} />
        <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
          You&apos;re in
        </p>
        <h1 className="font-editorial mt-4 text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[64px]">
          You&apos;re in. See you <Em>Sat 14 Nov.</Em>
        </h1>
        <p className="mt-2 font-mono text-xs tracking-[0.06em] text-[#6B6457] uppercase">
          {BUILD_ALONG.title} · {BUILD_ALONG.subline}
        </p>
        <p className="mt-5 text-lg leading-relaxed text-[#4A453C]">
          15:00–17:00 GMT on Zoom. Your receipt is on its way from Stripe. The Zoom link and a
          reminder come by email before the session.
        </p>
        <LocalTime
          startMs={BUILD_ALONG.startAt}
          endMs={BUILD_ALONG.endAt}
          className="mt-2 font-mono text-sm text-[#6B6457]"
        />
        <h2 className="font-editorial mt-10 text-2xl font-medium">
          Before Saturday, do three things:
        </h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-home-ink">
          <li>
            <strong>Add it to your calendar.</strong> The confirmation email has the invite.
          </li>
          <li>
            <strong>Open the Ship Sheet</strong> when it arrives and make your own copy.
          </li>
          <li>
            <strong>Set up a free account</strong>
            {tools.length > 0 ? ` on ${tools[0]}` : " on the tool named in your prep email"} and
            pick an idea, or a couple to choose from.{" "}
            <Link
              href={STARTUP_IDEAS_PAID_HREF}
              className="underline decoration-home-rule underline-offset-4"
            >
              Browse free ideas
            </Link>
            .
          </li>
        </ol>
        <p className="mt-8 text-sm text-[#6B6457]">
          Can&apos;t make it live? You&apos;ll get the replay, and it doesn&apos;t expire.
          Changed your mind? {GUARANTEE_PULLQUOTE}
          {POLICY_SECTION_LIVE ? (
            <>
              {" "}
              <Link
                href={POLICY_ANCHOR}
                className="underline decoration-home-rule underline-offset-4"
              >
                Read the refund policy
              </Link>
              .
            </>
          ) : null}
        </p>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="mx-auto max-w-[720px] px-5 py-16 sm:px-10 sm:py-24">
        {signupRecorder}
        <JsonLd schema={SCHEMA} />
        <h1 className="font-editorial text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[64px]">
          This build-along has <Em>ended.</Em>
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[#4A453C]">
          Ticket holders: your replay is in your email, and it doesn&apos;t expire. Can&apos;t
          find it? Email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline decoration-home-rule underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="mt-4 text-[15px] text-home-ink">
          Next build-along: {NEXT_BUILD_ALONG.label}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <TicketCheckoutButton label="Get my ticket" nextSession variant="primary" />
          <LiveButton href="/starter-kit" variant="ghost">
            Get the free Starter Kit
          </LiveButton>
          <Link
            href={STARTUP_IDEAS_PAID_HREF}
            className="inline-flex h-[52px] items-center text-sm underline decoration-home-rule underline-offset-4"
          >
            Browse free ideas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {signupRecorder}
      <JsonLd schema={SCHEMA} />

      {/* Date + price bar */}
      <div className="bg-[#1A1814] text-[#F7F3EC]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2.5 font-mono text-[11px] tracking-[0.06em] uppercase sm:px-10 sm:text-xs">
          <span className="rounded-full border border-[#5a544a] px-2 py-0.5 text-[10px]">
            Live on Zoom
          </span>
          <span>Sat 14 Nov 2026</span>
          <span className="text-[#5a544a]" aria-hidden="true">
            ·
          </span>
          <span>15:00–17:00 GMT</span>
          <span className="hidden text-[#c9bfae] sm:inline">
            · 10:00–12:00 New York · 07:00–09:00 LA
          </span>
          <span className="text-[#5a544a]" aria-hidden="true">
            ·
          </span>
          <span className="text-[#F08A3E]">
            {soldOut
              ? `Sold out · Next: ${NEXT_BUILD_ALONG.shortLabel}`
              : price.priceLine}
          </span>
          <span className="hidden text-[#5a544a] sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline">Replay included</span>
          <span className="text-[#5a544a]" aria-hidden="true">
            ·
          </span>
          <span>{soldOut ? "Sold out" : seatsLine(seats)}</span>
        </div>
        <div className="mx-auto max-w-[1120px] px-5 pb-2 text-center sm:px-10">
          <LocalTime
            startMs={BUILD_ALONG.startAt}
            endMs={BUILD_ALONG.endAt}
            className="font-mono text-[11px] text-[#c9bfae]"
          />
        </div>
      </div>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 py-14 sm:px-10 sm:py-20 lg:grid-cols-[1.2fr_0.9fr] lg:gap-14">
        <div>
          <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
            Weekend MVP Build-Along · Live on Zoom
          </p>
          <h1 className="font-editorial mt-4 text-[46px] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[76px]">
            Build it Saturday. <Em>Ship it Sunday.</Em>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#4A453C]">
            A 2-hour live build-along on Sat 14 Nov, 15:00 GMT. You build your MVP while I
            build mine, and you can ask questions as you go.
          </p>
          <div className="mt-8">
            {soldOut ? (
              <LiveButton disabled>Sold out</LiveButton>
            ) : preSale ? (
              <LiveButton disabled>Tickets open Sun 1 Nov</LiveButton>
            ) : (
              <LiveButton href="#ticket" variant="primary">
                Get my ticket, {price.amountLabel}
              </LiveButton>
            )}
          </div>
          <p className="mt-3.5 max-w-lg text-sm text-[#6B6457]">
            {soldOut
              ? `Sat 14 Nov · Sold out · Next: ${NEXT_BUILD_ALONG.shortLabel}`
              : `${price.priceLine}. Replay included, no expiry. Price shown in USD. Any tax is shown at checkout.`}
          </p>
          {!soldOut ? (
            <p className="mt-2 text-sm text-home-ink">{seatsLine(seats)}</p>
          ) : null}
          {!soldOut ? (
            <div className="mt-2.5 max-w-lg">
              <GuaranteeLine />
            </div>
          ) : null}
          <p className="mt-2 font-mono text-xs text-[#6B6457]">
            10:00–12:00 New York · 07:00–09:00 Los Angeles
          </p>
          <LocalTime
            startMs={BUILD_ALONG.startAt}
            endMs={BUILD_ALONG.endAt}
            className="mt-1 font-mono text-xs text-[#6B6457]"
          />
        </div>

        <TicketCard
          price={price}
          seats={seats}
          soldOut={soldOut}
          disabled={preSale}
        />
      </section>

      {/* Proof — hidden for run 1 */}
      {proof.length >= 2 ? (
        <section className="mx-auto max-w-[1120px] px-5 py-10 sm:px-10">
          <h2 className="font-editorial text-[34px] font-medium sm:text-5xl">
            From people who built along
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {proof.map((q) => (
              <blockquote
                key={q.name + q.quote.slice(0, 24)}
                className="rounded-2xl border border-home-rule bg-home-card p-6"
              >
                <p className="font-editorial text-xl leading-snug">&ldquo;{q.quote}&rdquo;</p>
                <footer className="mt-3 text-sm text-[#6B6457]">
                  {q.name}
                  {q.url ? (
                    <>
                      {" · "}
                      <a
                        href={q.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Live URL
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  ) : null}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      ) : null}

      {/* The deal */}
      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
          The deal
        </p>
        <h2 className="font-editorial mt-3 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
          {LIVE_ASSETS.dryRunPassed ? (
            <>
              You leave with a live URL. <Em>Not notes.</Em>
            </>
          ) : (
            <>{dealLine}</>
          )}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-home-rule bg-home-card p-5">
            <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
              You need
            </p>
            <h3 className="font-editorial mt-1.5 text-[22px] font-medium">A laptop</h3>
            <p className="mt-1 text-sm text-[#6B6457]">
              Not a phone or tablet. You&apos;ll be building.
            </p>
          </div>
          <div className="rounded-2xl border border-home-rule bg-home-card p-5">
            <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
              You need
            </p>
            <h3 className="font-editorial mt-1.5 text-[22px] font-medium">One idea</h3>
            <p className="mt-1 text-sm text-[#6B6457]">
              Or none, and we&apos;ll pick one from the library in the first half hour.
            </p>
          </div>
          {tools.length > 0 ? (
            <div className="rounded-2xl border border-home-rule bg-home-card p-5">
              <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
                You need
              </p>
              <h3 className="font-editorial mt-1.5 text-[22px] font-medium">
                A free tool account
              </h3>
              <p className="mt-1 text-sm text-[#6B6457]">
                On {tools.join(", ")}, set up before we start. The prep email shows you how.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-home-rule bg-home-card p-5">
              <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
                You need
              </p>
              <h3 className="font-editorial mt-1.5 text-[22px] font-medium">
                A free tool account
              </h3>
              <p className="mt-1 text-sm text-[#6B6457]">
                Set up before we start. The prep email shows you how.
              </p>
            </div>
          )}
        </div>
        <p className="mt-4 text-[#6B6457]">
          What you don&apos;t need: code, a co-founder or a design file.
        </p>
      </section>

      {/* What you'll do */}
      <section
        id="what-youll-do"
        className="mx-auto max-w-[1120px] scroll-mt-28 px-5 py-14 sm:px-10 sm:py-20"
      >
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
          What you&apos;ll do
        </p>
        <h2 className="font-editorial mt-3 mb-8 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
          Three moves, then <Em>two finishing steps</Em>
        </h2>
        <div className="divide-y divide-home-rule border-y border-home-rule">
          {PAID_AGENDA.map((row) => (
            <div
              key={row.range}
              className="grid gap-3 py-5 sm:grid-cols-[110px_1fr_auto] sm:items-start sm:gap-6"
            >
              <span className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
                {row.range}
              </span>
              <div>
                <div className="font-editorial text-xl font-medium">{row.title}</div>
                <p className="mt-1 text-[15px] leading-relaxed text-[#4A453C]">{row.body}</p>
              </div>
              <span className="font-mono text-xs text-[#6B6457] sm:pt-1">{row.clock}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-[#6B6457]">
          There&apos;s a visible timer for each block, and I&apos;ll have a pre-built fallback
          ready in case something breaks on my side.
        </p>
      </section>

      {/* What's included */}
      <section className="mx-auto max-w-[720px] px-5 py-10 sm:px-10 sm:py-14">
        <h2 className="font-editorial text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
          What&apos;s <Em>included</Em>
        </h2>
        <ul className="mt-6 space-y-3">
          {PAID_INCLUDED.map((line) => (
            <li key={line} className="flex gap-3 text-[15px] leading-relaxed">
              <span aria-hidden="true" className="text-home-orange">
                ✓
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* For / not for */}
      <section className="mx-auto grid max-w-[1120px] gap-4 px-5 py-10 sm:grid-cols-2 sm:px-10 sm:py-16">
        <div className="rounded-2xl border border-home-rule bg-home-card p-7">
          <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
            This is for you if
          </p>
          <CheckList items={PAID_FOR_YOU} />
        </div>
        <div className="rounded-2xl border border-home-rule bg-home-sunk p-7">
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
            It&apos;s not for you if
          </p>
          <CheckList items={PAID_NOT_FOR_YOU} variant="x" />
        </div>
      </section>

      {/* Host */}
      <section className="py-14 sm:py-20">
        <HostBlock eyebrow="Why a designer is running this" body={hostBody} />
      </section>

      {/* Price section (duplicate ticket for #ticket scroll from mid-page) */}
      <section className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 py-14 sm:px-10 sm:py-20 lg:grid-cols-[1fr_440px] lg:gap-14">
        <div>
          <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
            Price
          </p>
          <h2 className="font-editorial mt-3 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
            One ticket. <Em>Everything included.</Em>
          </h2>
          {price.earlyBird && !soldOut ? (
            <p className="mt-3.5 text-[#6B6457]">
              The $19 price ends at 23:59 GMT on Sun 8 Nov and I don&apos;t extend it.
            </p>
          ) : null}
        </div>
        {/* Ticket already rendered in hero with id=ticket; this is a visual twin
            for the mid-page price section without duplicating the anchor id. */}
        <div className="relative overflow-hidden rounded-2xl border border-home-rule bg-home-card p-7">
          {price.earlyBird && !soldOut ? (
            <div className="absolute top-0 right-0 rounded-bl-xl bg-home-orange px-3.5 py-1.5 font-mono text-[11px] tracking-[0.1em] text-white uppercase">
              Early-bird
            </div>
          ) : null}
          <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
            {BUILD_ALONG.title}
          </p>
          {soldOut ? (
            <>
              <h3 className="font-editorial mt-3 text-2xl font-medium">Sat 14 Nov is full.</h3>
              <p className="mt-2 text-sm text-[#4A453C]">
                Next: {NEXT_BUILD_ALONG.label}.
              </p>
              <div className="mt-4">
                <TicketCheckoutButton
                  label="Get a seat for 5 Dec"
                  nextSession
                  fullWidth
                  className="w-full"
                />
              </div>
            </>
          ) : (
            <>
              <div className="mt-3.5 flex flex-wrap items-baseline gap-3.5">
                <span className="font-editorial text-[60px] leading-none tracking-[-0.02em] sm:text-[72px]">
                  {price.amountLabel}
                </span>
                {price.untilLine ? (
                  <span className="text-[#6B6457]">{price.untilLine}</span>
                ) : null}
              </div>
              <p className="mt-2.5 text-sm">{seatsLine(seats)}</p>
              <div
                className="relative my-5 border-t-2 border-dashed border-home-rule"
                aria-hidden="true"
              />
              <ul className="space-y-2.5 text-sm">
                {PAID_INCLUDED.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span aria-hidden="true" className="text-home-orange">
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {preSale ? (
                  <LiveButton disabled className="w-full">
                    Tickets open Sun 1 Nov
                  </LiveButton>
                ) : (
                  <TicketCheckoutButton
                    label={`Get my ticket, ${price.amountLabel}`}
                    fullWidth
                    className="w-full"
                  />
                )}
              </div>
              <p className="mt-2.5 text-center font-mono text-xs text-[#6B6457]">
                Sat 14 Nov 2026 · 15:00–17:00 GMT · Price shown in USD. Any tax is shown at
                checkout.
              </p>
              <div className="mt-3">
                <GuaranteeLine />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Refunds */}
      <section className="mx-auto max-w-[1120px] px-5 py-14 sm:px-10 sm:py-20">
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
          Refunds
        </p>
        <h2 className="font-editorial mt-3 text-[34px] leading-[1.06] font-medium tracking-[-0.015em] sm:text-5xl">
          30 days to <Em>change your mind.</Em>
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 sm:items-start">
          <blockquote className="rounded-2xl border border-home-rule bg-home-card p-6">
            <p className="font-editorial text-2xl leading-snug text-home-ink">
              &ldquo;{GUARANTEE_PULLQUOTE}&rdquo;
            </p>
          </blockquote>
          <p className="pt-2 text-[15px] leading-relaxed text-[#4A453C]">
            That&apos;s the whole guarantee. If the build-along isn&apos;t what you hoped,
            email within 30 days of buying your ticket and I&apos;ll refund you in full. You
            don&apos;t need to explain.
          </p>
        </div>
        <div className="mt-4 grid gap-6 rounded-2xl border border-home-rule bg-home-card p-6 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] tracking-[0.08em] text-home-orange uppercase">
              If the session doesn&apos;t run
            </p>
            <p className="mt-2 text-sm leading-relaxed text-home-ink">{CANCELLATION_LINE}</p>
          </div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.08em] text-[#6B6457] uppercase">
              How
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#4A453C]">
              Email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="underline decoration-home-rule underline-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              from the address you bought with, within 30 days of purchase. Refunds go back to
              the card you paid with. Banks usually take 5 to 10 working days to show them.
            </p>
          </div>
        </div>
        <p className="mt-3.5 text-sm text-[#6B6457]">
          This adds to your rights under consumer law. It doesn&apos;t replace them.
        </p>
        {POLICY_SECTION_LIVE ? (
          <p className="mt-2.5">
            <Link
              href={POLICY_ANCHOR}
              className="text-sm font-medium text-[#A84A00] underline decoration-home-rule underline-offset-4"
            >
              Read the refund policy →
            </Link>
          </p>
        ) : null}
      </section>

      {/* Note from John — body hidden until written; P.S. always */}
      <section className="mx-auto max-w-[720px] px-5 py-10 sm:px-10 sm:py-14">
        {LIVE_ASSETS.personalNoteHtml ? (
          <div
            className="prose prose-neutral max-w-none text-[15px] leading-relaxed text-home-ink"
            dangerouslySetInnerHTML={{ __html: LIVE_ASSETS.personalNoteHtml }}
          />
        ) : null}
        <p className="mt-4 text-[15px] leading-relaxed text-[#4A453C]">
          <strong>P.S.</strong>{" "}
          {price.earlyBird ? PERSONAL_NOTE_PS_EARLY : PERSONAL_NOTE_PS_STANDARD}
        </p>
      </section>

      <div id="faq" className="scroll-mt-28">
        <LiveFaq items={paidFaqItems(price.priceLine)} />
      </div>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1120px] px-5 pb-24 sm:px-10">
        <div className="rounded-[22px] bg-[#24211C] px-8 py-14 text-center sm:px-16">
          <h2 className="font-editorial text-[34px] leading-[1.06] font-medium tracking-[-0.015em] text-white sm:text-5xl">
            Build it Saturday. <Em dark>Ship it Sunday.</Em>
          </h2>
          <p className="mt-2.5 font-mono text-[11px] tracking-[0.08em] text-[#c9bfae] uppercase">
            {BUILD_ALONG.title} · 20 seats
          </p>
          <p className="mt-4 font-mono text-xs tracking-[0.06em] text-[#d6cdbd] uppercase">
            {soldOut
              ? `Sat 14 Nov · Sold out · Next: ${NEXT_BUILD_ALONG.shortLabel}`
              : `Sat 14 Nov 2026 · 15:00–17:00 GMT · Zoom · ${price.priceLine}`}
          </p>
          <div className="mt-6 flex justify-center">
            {soldOut ? (
              <TicketCheckoutButton label="Get a seat for 5 Dec" nextSession variant="secondary" />
            ) : preSale ? (
              <LiveButton disabled>Tickets open Sun 1 Nov</LiveButton>
            ) : (
              <LiveButton href="#ticket" variant="secondary">
                Get my ticket
              </LiveButton>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
