import {
  PLATFORM_CAPTION_LIMITS,
  type SocialDay,
  type SocialPlatform,
  type SocialPost,
  type SocialPostFormat,
} from "./contracts/artifacts";

/**
 * WP76-S2b: the words and the arithmetic on the Social page. Pure, so the
 * wording and the counts are unit-tested. The label maps are `Record`s over
 * the contract unions, so a new day, kind, format or platform is a type error
 * here until it has words.
 */

export type SocialKindKey = SocialPost["kind"];

export const SOCIAL_DAY_LABELS: Record<SocialDay, string> = {
  fri: "Friday (launch day)",
  sat: "Saturday",
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
};

/** The day on its own, for sentences and accessible names. */
export const SOCIAL_DAY_NAMES: Record<SocialDay, string> = {
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
};

/** Short day names for tiles and rows. Day names only: the data has no launch date. */
export const SOCIAL_DAY_SHORT: Record<SocialDay, string> = {
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
};

export const SOCIAL_KIND_LABELS: Record<SocialKindKey, string> = {
  launch: "Launch",
  value: "Value",
  offer: "Offer",
  product: "Product",
  story: "Story",
  community: "Community",
};

export const SOCIAL_FORMAT_LABELS: Record<SocialPostFormat, string> = {
  image: "Image post",
  carousel: "Carousel",
  reel_script: "Reel script",
  poll: "Poll",
};

export const SOCIAL_FORMAT_SHORT: Record<SocialPostFormat, string> = {
  image: "Image",
  carousel: "Carousel",
  reel_script: "Reel script",
  poll: "Poll",
};

export const SOCIAL_PLATFORM_MARKS: Record<SocialPlatform, string> = {
  instagram: "IG",
  facebook: "FB",
  tiktok: "TT",
  x: "X",
  youtube: "YT",
  linkedin: "IN",
  threads: "TH",
  pinterest: "PI",
};

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  threads: "Threads",
  pinterest: "Pinterest",
};

export const SOCIAL_NONE_COPY = "Your social posts will appear here once your team writes them.";
export const SOCIAL_UNAVAILABLE_COPY = "Your social posts can't be shown right now. Check back in a little while.";
export const SOCIAL_NO_POSTING_COPY =
  "Nothing posts for you. Pick the platform, copy a post and post it yourself.";
export const SOCIAL_HEADER = { lead: "Seven launch posts,", tail: "ready when you are." } as const;
export const SOCIAL_WEEK_HEADING = "Launch week · Friday to Thursday";
export const SOCIAL_WEEK_NOTE = "Written by your team. Friday is launch day.";
export const SOCIAL_YOU_POST_TITLE = "You post it yourself.";
export const SOCIAL_YOU_POST_COPY =
  "Nothing posts or schedules from here. Pick a post, copy its caption and hashtags, then paste them into the app.";
export const SOCIAL_APPROVED_NOTE = "Nothing is posted for you.";
export const SOCIAL_COPY_FAILED = "Couldn't copy. Select the text and copy it yourself.";

const numberText = (value: number): string => value.toLocaleString("en-US");
const length = (text: string): number => [...text].length;

/** The hashtags as they are posted: `#` added, space separated. */
export function hashtagLine(hashtags: readonly string[]): string {
  return hashtags.map((tag) => `#${tag}`).join(" ");
}

type CaptionParts = Pick<SocialPost, "caption" | "shortCaption" | "hashtags">;

const withHashtags = (caption: string, hashtags: readonly string[]): string =>
  hashtags.length === 0 ? caption : `${caption}\n\n${hashtagLine(hashtags)}`;

export type CaptionChoice = {
  /** The caption chosen (without hashtags). */
  readonly caption: string;
  /** What Copy puts on the clipboard: the caption, a blank line, the hashtags. */
  readonly text: string;
  readonly usesShort: boolean;
  readonly over: boolean;
};

/**
 * Page-level choice, by the same rule as the count: the full caption plus
 * hashtags when that fits, else the short caption plus hashtags, else the
 * short caption plus hashtags marked over the limit. (The contract's
 * `captionFor` judges the caption alone and is left as it is.)
 */
export function chooseCaption(post: CaptionParts, platform: SocialPlatform): CaptionChoice {
  const limit = PLATFORM_CAPTION_LIMITS[platform];
  const full = withHashtags(post.caption, post.hashtags);
  if (length(full) <= limit) return { caption: post.caption, text: full, usesShort: false, over: false };
  const short = withHashtags(post.shortCaption, post.hashtags);
  return { caption: post.shortCaption, text: short, usesShort: true, over: length(short) > limit };
}

export function copyTextFor(post: CaptionParts, platform: SocialPlatform): string {
  return chooseCaption(post, platform).text;
}

export type CaptionCount = {
  /** Characters (code points) of the text Copy copies. */
  readonly count: number;
  readonly limit: number;
  readonly over: boolean;
  /** True when the full caption plus hashtags does not fit and the short caption is used. */
  readonly usesShort: boolean;
  /** "212 of 280 characters", or "305 of 280 characters, hashtags included. Over the limit by 25." */
  readonly summary: string;
  /** A second sentence when the short caption is used (null otherwise). */
  readonly note: string | null;
};

export function captionCount(post: CaptionParts, platform: SocialPlatform): CaptionCount {
  const limit = PLATFORM_CAPTION_LIMITS[platform];
  const choice = chooseCaption(post, platform);
  const count = length(choice.text);
  const base = `${numberText(count)} of ${numberText(limit)} characters${post.hashtags.length === 0 ? "" : ", hashtags included"}`;
  const summary = choice.over ? `${base}. Over the limit by ${numberText(count - limit)}.` : base;
  const note = choice.usesShort
    ? `The full caption is too long for ${SOCIAL_PLATFORM_LABELS[platform]}, so the short caption is used.`
    : null;
  return { count, limit, over: choice.over, usesShort: choice.usesShort, summary, note };
}

/** "2,200 characters": the caption limit shown on a platform card. */
export function platformLimitCopy(platform: SocialPlatform): string {
  return `${numberText(PLATFORM_CAPTION_LIMITS[platform])} characters`;
}

/** The live-region line after a Copy. */
export function copiedAnnouncement(day: SocialDay, platform: SocialPlatform): string {
  return `Copied the ${SOCIAL_DAY_NAMES[day]} post for ${SOCIAL_PLATFORM_LABELS[platform]}.`;
}
