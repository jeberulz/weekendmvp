/**
 * WP76-S2a: no links and no @handles anywhere in a social pack. The founder
 * copies each post to the platform they use and adds their own link and tags,
 * so any link-like text or handle in any post text field is a HARD issue.
 *
 * Links reuse the email check's detector (`findLinkLike`, `./emailLinks.ts`):
 * schemes, `www.`, email addresses and bare domains, with the same allowances
 * ("e.g.", "2.5", "Node.js") and the same known trade-offs. A handle is `@`
 * followed by a letter, number or `_`, where the `@` does not follow one of
 * those (so "name@host.tld" stays an email address, found first, and a lone
 * "@" or "meet @ 6" is not a handle). A time after `@` is not a handle either
 * (review minor 1): an hour of one or two digits with optional `:mm` and an
 * optional am/pm in any case, with or without a space ("@6pm", "@6:30 PM",
 * "@12"), or `noon` / `midnight`. Anything longer stays a handle ("@6pmclub",
 * "@noonrun", "@2026"). Pure, relative imports only.
 */
import type { SocialPack } from "../../contracts/artifacts";
import { SOCIAL_DAYS } from "../../contracts/artifacts";
import { findLinkLike } from "./emailLinks";
import { issue, type CheckIssue, type IssuePath } from "./types";

const HANDLE = /(?<![\p{L}\p{N}_])@([\p{L}\p{N}_]+)/gu;
/** What may follow `@` as a time: the word after `@`, then the rest of the text from there. */
const TIME_WORD = /^(?:\d{1,2}(?:[ap]m)?|noon|midnight)$/iu;
const TIME_TAIL = /^\d{1,2}(?::\d{2})?(?:\s?[ap]m)?(?![\p{L}\p{N}_]|:\d)/iu;

function isTimeAt(word: string, tail: string): boolean {
  return TIME_WORD.test(word) && (/^(?:noon|midnight)$/iu.test(word) || TIME_TAIL.test(tail));
}

/** The first @handle in `text` that is not a time, or null. */
function findHandle(text: string): string | null {
  for (const hit of text.matchAll(HANDLE)) {
    const word = hit[1] ?? "";
    if (!isTimeAt(word, text.slice((hit.index ?? 0) + 1))) return hit[0];
  }
  return null;
}

/** The first link-like snippet or @handle in `text`, or null. */
export function findLinkOrHandle(text: string): string | null {
  return findLinkLike(text) ?? findHandle(text);
}

const POST_TEXT_FIELDS = ["hook", "caption", "shortCaption", "imageText", "imageAlt"] as const;

/** Every text field of every post a reader sees, with its path. */
function socialPackTexts(pack: SocialPack): { path: IssuePath; text: string }[] {
  const out: { path: IssuePath; text: string }[] = [];
  for (const day of SOCIAL_DAYS) {
    const post = pack.posts[day];
    for (const field of POST_TEXT_FIELDS) {
      const text = post[field];
      if (text !== undefined) out.push({ path: ["posts", day, field], text });
    }
    post.pollOptions?.forEach((text, index) => out.push({ path: ["posts", day, "pollOptions", index], text }));
    post.hashtags.forEach((text, index) => out.push({ path: ["posts", day, "hashtags", index], text }));
  }
  return out;
}

/** A hard `social_link_in_text` issue for every field that holds link-like text or an @handle. */
export function checkSocialPackLinks(pack: SocialPack): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const { path, text } of socialPackTexts(pack)) {
    const hit = findLinkOrHandle(text);
    if (hit !== null) {
      issues.push(issue("hard", "social_link_in_text", path, `Remove "${hit.slice(0, 40)}"; the founder adds their own link and tags when they post.`));
    }
  }
  return issues;
}
