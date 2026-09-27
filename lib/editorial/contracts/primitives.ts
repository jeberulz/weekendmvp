import { z } from "zod";

import { EDITORIAL_LIMITS as L } from "./limits";

/** Opaque identifiers: bounded, URL-safe, never parsed for meaning. */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/* C0/C1 controls other than tab/newline/carriage return. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
/* Tabs, newlines and the Unicode line/paragraph separators. */
const LINE_BREAK_CODE_POINTS = [0x09, 0x0a, 0x0d, 0x2028, 0x2029];
/* Bidirectional overrides/isolates can make displayed text lie about itself. */
const BIDI_CODE_POINTS = [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069];

function containsCodePoint(value: string, codePoints: readonly number[]): boolean {
  for (const char of value) {
    if (codePoints.includes(char.codePointAt(0) ?? -1)) return true;
  }
  return false;
}

export function hasBidiControls(value: string): boolean {
  return containsCodePoint(value, BIDI_CODE_POINTS);
}

export const editorialIdSchema = z
  .string()
  .max(L.idChars)
  .regex(ID_PATTERN, "Invalid identifier");

export const slugSchema = z
  .string()
  .max(L.slugChars)
  .regex(SLUG_PATTERN, "Slug must be lowercase words separated by hyphens");

export const sha256Schema = z.string().regex(SHA256_PATTERN, "Invalid SHA-256 hash");

export const idempotencyKeySchema = z
  .string()
  .regex(IDEMPOTENCY_KEY_PATTERN, "Invalid idempotency key");

function isRealCalendarDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isUtcTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const [, y, mo, d, h, mi, s] = match;
  if (!isRealCalendarDate(Number(y), Number(mo), Number(d))) return false;
  return Number(h) < 24 && Number(mi) < 60 && Number(s) < 60;
}

export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  return isRealCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** ISO 8601 in UTC with a `Z` suffix. Offsets and local times are rejected. */
export const utcTimestampSchema = z
  .string()
  .max(30)
  .refine(isUtcTimestamp, "Timestamp must be ISO 8601 UTC, e.g. 2026-09-27T12:00:00Z");

/** A calendar date (`YYYY-MM-DD`), used when only the day is known. */
export const calendarDateSchema = z
  .string()
  .max(10)
  .refine(isCalendarDate, "Date must be YYYY-MM-DD");

export function singleLineText(max: number) {
  return z
    .string()
    .trim()
    .min(1, "Required")
    .max(max, `Must be ${max} characters or fewer`)
    .refine((value) => !CONTROL_CHARS.test(value), "Contains control characters")
    .refine((value) => !containsCodePoint(value, LINE_BREAK_CODE_POINTS), "Must be a single line")
    .refine((value) => !hasBidiControls(value), "Contains bidirectional control characters");
}

export function multiLineText(max: number) {
  return z
    .string()
    .trim()
    .min(1, "Required")
    .max(max, `Must be ${max} characters or fewer`)
    .refine((value) => !CONTROL_CHARS.test(value), "Contains control characters")
    .refine((value) => !hasBidiControls(value), "Contains bidirectional control characters");
}

/** Markdown bodies may contain any printable text; only raw controls are refused. */
export const markdownBodySchema = z
  .string()
  .min(1, "Article body is empty")
  .max(L.markdownChars, `Article body must be ${L.markdownChars} characters or fewer`)
  .refine((value) => !CONTROL_CHARS.test(value), "Article body contains control characters");

const IPV4_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export type UrlProblem =
  | "too_long"
  | "whitespace"
  | "unparseable"
  | "scheme"
  | "credentials"
  | "host"
  | "ip_literal"
  | "internal_host";

/**
 * Classify a source or article link. Only http(s) links to named public hosts
 * pass: no credentials, IP literals, localhost or internal-only suffixes.
 * This validates the reference; it never fetches it.
 */
export function checkPublicHttpUrl(value: string): UrlProblem | null {
  if (value.length > L.urlChars) return "too_long";
  if (/\s/.test(value) || CONTROL_CHARS.test(value)) return "whitespace";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "unparseable";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "scheme";
  if (parsed.username !== "" || parsed.password !== "") return "credentials";
  const host = parsed.hostname.toLowerCase();
  if (IPV4_HOST.test(host) || host.startsWith("[")) return "ip_literal";
  if (host === "" || !host.includes(".")) return "host";
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan")
  ) {
    return "internal_host";
  }
  return null;
}

export const URL_PROBLEM_MESSAGES: Record<UrlProblem, string> = {
  too_long: `URL must be ${L.urlChars} characters or fewer`,
  whitespace: "URL contains spaces or control characters",
  unparseable: "URL could not be parsed",
  scheme: "Only http and https links are allowed",
  credentials: "URL must not contain a username or password",
  host: "URL needs a public host name",
  ip_literal: "Use a domain name, not an IP address",
  internal_host: "Internal or local hosts are not public sources",
};

export const publicHttpUrlSchema = z.string().superRefine((value, ctx) => {
  const problem = checkPublicHttpUrl(value);
  if (problem) ctx.addIssue({ code: "custom", message: URL_PROBLEM_MESSAGES[problem] });
});

/** Hostname for display, derived from the URL rather than trusted from input. */
export function displayDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "invalid link";
  }
}
