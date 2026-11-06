/**
 * WP75-S4a: the JSON walk the copy checks share, and the text normaliser they
 * match against. Pure.
 *
 * The walk is bounded: at most `WALK_MAX_DEPTH` levels and `WALK_MAX_NODES`
 * nodes, and a cycle stops it instead of recursing forever. A parsed artifact
 * is far inside both caps (the C-ART schemas cap every list and string), so a
 * walk that hits one is reported by `checkShape` as an invalid shape.
 */
import type { IssuePath } from "./types";

export type Leaf = { readonly value: string; readonly path: IssuePath };

export const WALK_MAX_DEPTH = 64;
export const WALK_MAX_NODES = 20_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type Visitor = {
  /** Return true to prune this node (and its subtree). */
  readonly skip?: (path: IssuePath) => boolean;
  readonly onString?: (value: string, path: IssuePath) => void;
  readonly onKey?: (path: IssuePath) => void;
};

/** Walks `value` depth-first in a stable order. Returns false when a cap or a cycle cut the walk short. */
function walk(value: unknown, visitor: Visitor): boolean {
  let nodes = 0;
  let complete = true;
  const ancestors = new Set<object>();
  const visit = (node: unknown, path: IssuePath): void => {
    if (!complete) return;
    if (visitor.skip?.(path) === true) return;
    nodes += 1;
    if (nodes > WALK_MAX_NODES) {
      complete = false;
      return;
    }
    if (typeof node === "string") {
      visitor.onString?.(node, path);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    if (path.length >= WALK_MAX_DEPTH || ancestors.has(node)) {
      complete = false;
      return;
    }
    ancestors.add(node);
    if (Array.isArray(node)) {
      for (let index = 0; index < node.length && complete; index += 1) visit(node[index], [...path, index]);
    } else if (isRecord(node)) {
      for (const [key, child] of Object.entries(node)) {
        if (!complete) break;
        visitor.onKey?.([...path, key]);
        visit(child, [...path, key]);
      }
    }
    ancestors.delete(node);
  };
  visit(value, []);
  return complete;
}

/** Every string in `value` with its path, in a stable order. `skip` prunes a subtree or a leaf. */
export function stringLeaves(value: unknown, skip?: (path: IssuePath) => boolean): Leaf[] {
  const found: Leaf[] = [];
  walk(value, { skip, onString: (text, path) => found.push({ value: text, path }) });
  return found;
}

/** True when `value` can be walked whole: within the depth and node caps, and without a cycle. */
export const isWalkable = (value: unknown): boolean => walk(value, {});

/** Every object key in `value` with its path (for field-name checks such as `eyebrow`). */
export function keyPaths(value: unknown): IssuePath[] {
  const found: IssuePath[] = [];
  walk(value, { onKey: (path) => found.push(path) });
  return found;
}

/** The value at `path`, or undefined. */
export function valueAt(value: unknown, path: IssuePath): unknown {
  let current = value;
  for (const key of path) {
    if (typeof key === "number" && Array.isArray(current)) current = current[key];
    else if (typeof key === "string" && isRecord(current)) current = current[key];
    else return undefined;
  }
  return current;
}

export const lastKey = (path: IssuePath): string | number | undefined => path[path.length - 1];

/** The workspace-only proof slots: always placeholders, judged by their own check, never as copy. */
export const isProofSlotPath = (path: IssuePath): boolean => path[0] === "proofSlots";

/**
 * Leaves that are not the business's own claims: the proof placeholders, the
 * brand voice's "don't say" example and its reason (deliberately bad copy),
 * and a build prompt's `Do not build:` line (it names what is left out).
 */
export function isCounterExamplePath(path: IssuePath): boolean {
  if (isProofSlotPath(path)) return true;
  if (path[0] === "voice" && (path[1] === "dontSay" || path[1] === "dontSayWhy")) return true;
  return lastKey(path) === "doNotBuild";
}

/** Keys whose values are codes, enums, colours or targets, not prose. */
const NON_PROSE_KEYS = new Set([
  "hex",
  "target",
  "slug",
  "ideaSlug",
  "icon",
  "layout",
  "kind",
  "weight",
  "source",
  "pair",
  "direction",
  "shape",
  "density",
  "mode",
  "trigger",
  "currency",
  "objective",
  "platforms",
  "platform",
  "format",
  "roleKey",
  "hiredBy",
  "rulesVersion",
]);

export const isNonProsePath = (path: IssuePath): boolean => {
  const key = lastKey(path);
  return typeof key === "string" && NON_PROSE_KEYS.has(key);
};

/** Copy leaves: prose the business may be judged on. */
export const isCopyPath = (path: IssuePath): boolean => !isCounterExamplePath(path) && !isNonProsePath(path);

/** Bracketed placeholders such as `[Quote from a beta user]` are slots, not claims. */
export const stripPlaceholders = (text: string): string => text.replace(/\[[^\]\n]*\]/gu, " ");

// ---------------------------------------------------------------------------
// Normalising text before matching
// ---------------------------------------------------------------------------

/** Cyrillic and Greek letters that look like Latin ones. */
const CONFUSABLES: Readonly<Record<string, string>> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", У: "Y", Х: "X",
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ј: "j", ѕ: "s", І: "I", Ј: "J", Ѕ: "S",
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
  ο: "o", ν: "v", ι: "i",
};
const CONFUSABLE_CHAR = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "u");
const CONFUSABLE_CHARS = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "gu");

/**
 * The text the patterns see: NFKC (fullwidth letters and digits become ASCII,
 * Roman numerals become letters), invisible format characters (zero-width
 * spaces, joiners, bidi controls) removed, Cyrillic and Greek lookalikes
 * mapped to Latin inside a word that also has Latin letters ("Тrusted"), and
 * a letter I, l or O written as a digit inside a number ("I0,000").
 * Only for matching; messages quote it, the artifact is never rewritten.
 */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/[\p{L}\p{M}]+/gu, (word) =>
      /[A-Za-z]/u.test(word) && CONFUSABLE_CHAR.test(word) ? word.replace(CONFUSABLE_CHARS, (ch) => CONFUSABLES[ch] ?? ch) : word,
    )
    .replace(/(?<![\p{L}\p{N}])[Il](?=\d)/gu, "1")
    .replace(/(?<=\d)[Oo](?![\p{L}])/gu, "0");
}

/** Placeholders removed, then normalised: the text a copy pattern matches against. */
export const matchableText = (text: string): string => stripPlaceholders(normalizeText(text));
