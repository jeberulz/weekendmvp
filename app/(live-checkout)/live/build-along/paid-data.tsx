import { hubSchedule, liveHubText, timeLabel } from "@/lib/landing/live-hub-schedule";
import type { BuildAlongCopy } from "@/lib/landing/read-build-along";
import type { LiveFaqItem } from "@/components/live/LiveFaq";
import {
  BUILD_ALONG,
  EARLY_BIRD_ENDS_AT,
  LIVE_ASSETS,
  POLICY_ANCHOR,
  POLICY_SECTION_LIVE,
  SEATS_TOTAL,
} from "@/lib/live/config";
import { SUPPORT_EMAIL } from "@/lib/legal/support";
import Link from "next/link";

export const GUARANTEE_SHORT =
  "Full refund within 30 days of purchase, no reason needed.";

export const GUARANTEE_PULLQUOTE =
  "Full refund within 30 days of purchase, no reason needed. Just email us. A refund ends your replay access.";

export const CANCELLATION_LINE =
  "We'll email you if we cancel. Reply within 48 hours if you'd rather move to the next date. Otherwise we refund you in full, automatically. If we cancel and you move to a later date, your 30 days start again from the day we cancel. The next date is Sat 5 Dec 2026, 15:00 GMT, on Zoom.";

export const AGENDA_TIMES = [
  { key: "opening", range: "0–10 MIN", clock: "15:00 GMT" },
  { key: "sharpest", range: "10–30 MIN", clock: "15:10" },
  { key: "weekendCut", range: "30–55 MIN", clock: "15:30" },
  { key: "build", range: "55–95 MIN", clock: "15:55" },
  { key: "safety", range: "95–105 MIN", clock: "16:35" },
  { key: "firstUsers", range: "105–110 MIN", clock: "16:45" },
  { key: "questions", range: "110–120 MIN", clock: "16:50" },
] as const;

const earlyDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
}).format(EARLY_BIRD_ENDS_AT);
const sessionRange = (zone: string) => `${timeLabel(BUILD_ALONG.startAt, zone)}–${timeLabel(BUILD_ALONG.endAt, zone)}`;
const tokens: Readonly<Record<string, string>> = {
  "{hours}": String(BUILD_ALONG.durationMin / 60),
  "{sessionStart}": `${hubSchedule.paidDate}, ${hubSchedule.paidTime} GMT`,
  "{sessionStartWithAt}": `${hubSchedule.paidDate} at ${hubSchedule.paidTime} GMT`,
  "{earlyPrice}": `$${BUILD_ALONG.earlyBirdUsd}`,
  "{earlyCutoff}": `${timeLabel(EARLY_BIRD_ENDS_AT)} GMT on ${earlyDate}`,
  "{seatsTotal}": String(SEATS_TOTAL),
  "{timezoneSummary}":
    `${hubSchedule.paidDate}, ${sessionRange("UTC")} GMT. That's ${sessionRange("America/New_York")} in New York and ${sessionRange("America/Los_Angeles")} in Los Angeles.`,
};

export function buildAlongText(copy: string) {
  return liveHubText(copy).replace(/\{[a-zA-Z]+\}/g, (token) => tokens[token] ?? token);
}

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

export function paidFaqItems(faq: BuildAlongCopy["faq"], priceLine: string): LiveFaqItem[] {
  const tools = LIVE_ASSETS.toolList;
  return faq.items.flatMap<LiveFaqItem>(({ discriminant, value }) => {
    const { question } = value;
    if (discriminant === "tools" && tools.length === 0) return [];
    if (discriminant === "cancellation") return [{ question, answer: CANCELLATION_LINE }];
    if (discriminant === "refund") {
      return [{
        question,
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
      }];
    }
    return [{
      question,
      answer: buildAlongText(value.answer).replaceAll("{priceLine}", priceLine).replaceAll("{tools}", tools.join(", ")),
    }];
  });
}
