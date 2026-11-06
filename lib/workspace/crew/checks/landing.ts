/**
 * WP75-S4a: landing-spec checks that need no model and no brand kit, plus the
 * brand-kit cross check.
 *
 * - heading and title lengths: hard against the C-ART `LIMITS` (the schema's
 *   own caps, re-checked because a draft may arrive unparsed), soft against
 *   tighter display targets so a headline fits one to three lines;
 * - no eyebrow, kicker or section number (D24, 07 §4): any such field name,
 *   a heading that leads with a number or "Step 1", or an all-caps label;
 * - no emoji in copy;
 * - proof slots are placeholders only ("never fake it" for the workspace-only
 *   slots: `placeholder: true` and bracketed text);
 * - a waitlist is present;
 * - every layout is allowed by the kit's direction (wraps
 *   `checkLandingAgainstBrandKit`, not a fork of it);
 * - image alt text does not open with "image of".
 */
import {
  LIMITS,
  checkLandingAgainstBrandKit,
  type BrandKit,
  type LandingSpec,
  type LandingSpecDraft,
} from "../../contracts/artifacts";
import { issue, type CheckIssue, type IssuePath } from "./types";
import { keyPaths, stringLeaves, valueAt } from "./walk";

/** Display targets (soft). The hard caps are `LIMITS.landingSpec`. */
export const DISPLAY_TARGETS = Object.freeze({
  headline: { maxChars: 70, maxWords: 12 },
  heading: { maxChars: 50, maxWords: 9 },
  itemTitle: { maxChars: 40, maxWords: 7 },
} as const);

type HeadingKind = keyof typeof DISPLAY_TARGETS;
type HeadingSpot = { readonly path: IssuePath; readonly kind: HeadingKind; readonly hardMax: number };

const wordCount = (text: string): number => text.trim().split(/\s+/u).filter((word) => word !== "").length;

function headingSpots(spec: unknown): HeadingSpot[] {
  const spots: HeadingSpot[] = [
    { path: ["hero", "headline", "text"], kind: "headline", hardMax: LIMITS.landingSpec.headline },
    { path: ["how_it_works", "heading"], kind: "heading", hardMax: LIMITS.landingSpec.heading },
    { path: ["app_preview", "heading"], kind: "heading", hardMax: LIMITS.landingSpec.heading },
    { path: ["waitlist", "heading"], kind: "heading", hardMax: LIMITS.landingSpec.heading },
  ];
  for (const [section, field] of [
    ["promises", "items"],
    ["how_it_works", "steps"],
  ] as const) {
    const items = valueAt(spec, [section, field]);
    if (Array.isArray(items)) {
      items.forEach((_, index) =>
        spots.push({ path: [section, field, index, "title"], kind: "itemTitle", hardMax: LIMITS.landingSpec.itemTitle }),
      );
    }
  }
  return spots;
}

/** Heading and title lengths. */
export function checkHeadingLengths(spec: unknown): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const { path, kind, hardMax } of headingSpots(spec)) {
    const text = valueAt(spec, path);
    if (typeof text !== "string") continue;
    const length = [...text.trim()].length;
    if (length > hardMax) {
      issues.push(issue("hard", "heading_too_long", path, `Heading is ${length} characters; the limit is ${hardMax}. Shorten it.`));
      continue;
    }
    const target = DISPLAY_TARGETS[kind];
    const words = wordCount(text);
    if (length > target.maxChars || words > target.maxWords) {
      issues.push(
        issue(
          "soft",
          "heading_long_for_display",
          path,
          `Heading is ${length} characters and ${words} words; aim for at most ${target.maxChars} and ${target.maxWords} so it sits on a few lines.`,
        ),
      );
    }
  }
  return issues;
}

const EYEBROW_KEYS = /^(?:eyebrow|kicker|overline|pre[-_]?title|pre[-_]?heading|super[-_]?(?:title|heading))$/iu;
/** "01 Plan", "02. Plan", "3 / Plan", "1) Plan": the schema's own rule. */
const LEADING_SECTION_NUMBER = /^(0\d|\d{1,2}\s*[./:)|·–—-])(\s|$)/u;
const STEP_LABEL = /^step\s*\d+\b/iu;
const ALL_CAPS_LABEL = /^[^\p{Ll}]*\p{Lu}{3,}[^\p{Ll}]*$/u;

/** No eyebrow, kicker or section numbering on a founder page (D24). */
export function checkNoEyebrow(spec: unknown): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const path of keyPaths(spec)) {
    const key = path[path.length - 1];
    if (typeof key === "string" && EYEBROW_KEYS.test(key)) {
      issues.push(issue("hard", "eyebrow_field", path, "Founder pages carry no eyebrow or kicker above a heading. Remove this field."));
    }
  }
  for (const { path } of headingSpots(spec)) {
    const text = valueAt(spec, path);
    if (typeof text !== "string") continue;
    if (LEADING_SECTION_NUMBER.test(text) || STEP_LABEL.test(text)) {
      issues.push(issue("hard", "section_number", path, "Headings never lead with a section number or a step label."));
    } else if (ALL_CAPS_LABEL.test(text.trim())) {
      issues.push(issue("soft", "all_caps_heading", path, "An all-caps heading reads as an eyebrow label. Use sentence case."));
    }
  }
  return issues;
}

/** Emoji shown as pictures (and the variation selector); © and ™ stay allowed. */
const EMOJI = /[\p{Emoji_Presentation}️]/u;

export function checkNoEmoji(spec: unknown): CheckIssue[] {
  return stringLeaves(spec)
    .filter(({ value }) => EMOJI.test(value))
    .map(({ path }) => issue("hard", "emoji_in_copy", path, "No emoji in landing copy; use an icon from the curated set."));
}

const BRACKETED = /^\[.+\]$/u;

/** Proof slots must stay placeholders: `placeholder: true` and bracketed text. */
export function checkProofSlots(spec: unknown): CheckIssue[] {
  const slots = valueAt(spec, ["proofSlots"]);
  if (!Array.isArray(slots)) return [];
  const issues: CheckIssue[] = [];
  const bracketedFields: Record<string, readonly string[]> = {
    testimonial: ["quote", "attribution"],
    stat: ["value"],
    rating: ["value"],
    logo: ["name"],
    press: ["outlet"],
  };
  slots.forEach((slot: unknown, index) => {
    const base: IssuePath = ["proofSlots", index];
    if (valueAt(slot, ["placeholder"]) !== true) {
      issues.push(issue("hard", "proof_not_placeholder", [...base, "placeholder"], "Proof slots are placeholders only (placeholder: true)."));
    }
    const kind = valueAt(slot, ["kind"]);
    const fields = typeof kind === "string" ? (bracketedFields[kind] ?? []) : [];
    for (const field of fields) {
      const text = valueAt(slot, [field]);
      if (typeof text !== "string" || !BRACKETED.test(text.trim())) {
        issues.push(issue("hard", "proof_not_bracketed", [...base, field], "Proof text must be a bracketed placeholder such as [Quote from an early user]."));
      }
    }
    const optionalQuote = valueAt(slot, ["quote"]);
    if (kind === "press" && typeof optionalQuote === "string" && !BRACKETED.test(optionalQuote.trim())) {
      issues.push(issue("hard", "proof_not_bracketed", [...base, "quote"], "Proof text must be a bracketed placeholder such as [Quote from an early user]."));
    }
  });
  return issues;
}

const REDUNDANT_ALT = /^(?:an?\s+)?(?:image|picture|photo|graphic|icon)\s+of\b/iu;

/** Alt text that opens with "image of" wastes a screen reader's first words. */
export function checkAltText(artifact: unknown): CheckIssue[] {
  return stringLeaves(artifact)
    .filter(({ path, value }) => path[path.length - 1] === "alt" && REDUNDANT_ALT.test(value.trim()))
    .map(({ path }) => issue("soft", "alt_redundant", path, 'Alt text should not start with "image of" or "picture of"; describe the content.'));
}

/** Every landing check that needs no brand kit. */
export function checkLandingSpec(spec: LandingSpec | LandingSpecDraft): CheckIssue[] {
  const issues: CheckIssue[] = [
    ...checkHeadingLengths(spec),
    ...checkNoEyebrow(spec),
    ...checkNoEmoji(spec),
    ...checkProofSlots(spec),
    ...checkAltText(spec),
  ];
  if (valueAt(spec, ["waitlist"]) === undefined) {
    issues.push(issue("hard", "waitlist_missing", ["waitlist"], "The landing page needs a waitlist section."));
  }
  return issues;
}

/** Layouts the kit's direction does not allow, as hard issues. */
export function checkLandingLayouts(spec: LandingSpec | LandingSpecDraft, kit: BrandKit): CheckIssue[] {
  return checkLandingAgainstBrandKit(spec, kit).map((found) => issue("hard", "layout_not_allowed", found.path, found.message));
}
