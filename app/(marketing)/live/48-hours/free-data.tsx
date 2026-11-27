import type { LiveFaqItem } from "@/components/live/LiveFaq";
import type { FreeWebinarCopy } from "@/lib/landing/read-free-webinar";
import { hubSchedule, liveHubText, timeLabel } from "@/lib/landing/live-hub-schedule";
import { FREE_WEBINAR, LIVE_ASSETS } from "@/lib/live/config";
import { SUPPORT_EMAIL } from "@/lib/legal/support";

export const PRODUCT_NAME = "HydroTrail";

export const SCREENS = [
  { key: "landing", status: "Promised", promised: true },
  { key: "setup", status: "Planned", promised: false },
  { key: "hike", status: "Planned", promised: false },
  { key: "recap", status: "If time holds", promised: false },
] as const;
export type ScreenKey = (typeof SCREENS)[number]["key"];

const firstScreenTime = "16:25";
export const AGENDA = [
  { key: "idea", clock: "16:00" },
  { key: "test", clock: "16:08" },
  { key: "prompts", clock: "16:18" },
  { key: "firstScreen", clock: firstScreenTime, approx: true, milestone: true },
  { key: "remainingScreens", clock: "16:27–16:43" },
  { key: "deploy", clock: "16:45", approx: true, milestone: true },
  { key: "questions", clock: "16:50" },
  { key: "close", clock: "17:00" },
] as const;

const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
}).format(FREE_WEBINAR.startAt);

const timeZoneSummary = `${hubSchedule.freeTime} GMT on ${hubSchedule.freeDate}, which is ${timeLabel(FREE_WEBINAR.startAt, "America/New_York")} in New York and ${timeLabel(FREE_WEBINAR.startAt, "America/Los_Angeles")} in Los Angeles.`;

export function freeWebinarText(copy: string) {
  return liveHubText(copy)
    .replaceAll("{longDate}", longDate)
    .replaceAll("{firstScreenTime}", firstScreenTime)
    .replaceAll("{timeZoneSummary}", timeZoneSummary);
}

export function freeFaqItemsVisible(copy: FreeWebinarCopy["faq"]): LiveFaqItem[] {
  const tools = LIVE_ASSETS.toolList;
  return copy.items.flatMap<LiveFaqItem>(({ discriminant, value }) => {
    const answer = freeWebinarText(value.answer);
    if (discriminant === "tools" && tools.length === 0) return [];

    if (discriminant === "support") {
      const [before, after] = answer.split("{supportEmail}");
      return [{
        question: value.question,
        answer: (
          <>
            {before}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="underline decoration-home-rule underline-offset-2 hover:text-home-orange-ink"
            >
              {SUPPORT_EMAIL}
            </a>
            {after}
          </>
        ),
      }];
    }
    return [{ question: value.question, answer: answer.replaceAll("{tools}", tools.join(", ")) }];
  });
}
