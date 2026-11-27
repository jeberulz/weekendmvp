import { BUILD_ALONG, FREE_WEBINAR, NEXT_BUILD_ALONG } from "@/lib/live/config";

function dateLabel(ms: number, weekday?: "short") {
  return new Intl.DateTimeFormat("en-GB", { weekday, day: "numeric", month: "short", timeZone: "UTC" }).format(ms);
}

export function timeLabel(ms: number, timeZone = "UTC") {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(ms);
}

function buildAlongTimes(timeZone = "UTC") {
  return `${timeLabel(BUILD_ALONG.startAt, timeZone)}–${timeLabel(BUILD_ALONG.endAt, timeZone)}`;
}

export const hubSchedule = {
  freeDate: dateLabel(FREE_WEBINAR.startAt, "short"),
  freeTime: timeLabel(FREE_WEBINAR.startAt),
  paidDate: dateLabel(BUILD_ALONG.startAt, "short"),
  paidTime: timeLabel(BUILD_ALONG.startAt),
};

const newYork = "America/New_York";
const losAngeles = "America/Los_Angeles";
const sessionTimes =
  `The free webinar is ${hubSchedule.freeDate} at ${hubSchedule.freeTime} GMT (${timeLabel(FREE_WEBINAR.startAt, newYork)} New York, ${timeLabel(FREE_WEBINAR.startAt, losAngeles)} Los Angeles). ` +
  `The build-along is ${hubSchedule.paidDate}, ${buildAlongTimes()} GMT (${buildAlongTimes(newYork)} New York, ${buildAlongTimes(losAngeles)} Los Angeles).`;

const tokens: Readonly<Record<string, string>> = {
  "{freeDate}": hubSchedule.freeDate,
  "{paidDate}": hubSchedule.paidDate,
  "{freeDay}": dateLabel(FREE_WEBINAR.startAt),
  "{buildAlongDuration}": BUILD_ALONG.durationMin === 120 ? "two hours" : `${BUILD_ALONG.durationMin} minutes`,
  "{replayDays}": String((FREE_WEBINAR.replayEndsAt - FREE_WEBINAR.endAt) / (24 * 60 * 60 * 1000)),
  "{sessionTimes}": sessionTimes,
  "{nextBuildAlongLabel}": NEXT_BUILD_ALONG.label,
};

export function liveHubText(text: string) {
  return text.replace(/\{[a-zA-Z]+\}/g, (token) => tokens[token] ?? token);
}
