/**
 * WP75-S4a: the JSON walk the copy checks share. Pure.
 */
import type { IssuePath } from "./types";

export type Leaf = { readonly value: string; readonly path: IssuePath };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every string in `value` with its path, in a stable order. `skip` prunes a subtree or a leaf. */
export function stringLeaves(value: unknown, skip?: (path: IssuePath) => boolean): Leaf[] {
  const found: Leaf[] = [];
  const visit = (node: unknown, path: IssuePath): void => {
    if (skip?.(path) === true) return;
    if (typeof node === "string") found.push({ value: node, path });
    else if (Array.isArray(node)) node.forEach((child, index) => visit(child, [...path, index]));
    else if (isRecord(node)) for (const [key, child] of Object.entries(node)) visit(child, [...path, key]);
  };
  visit(value, []);
  return found;
}

/** Every object key in `value` with its path (for field-name checks such as `eyebrow`). */
export function keyPaths(value: unknown): IssuePath[] {
  const found: IssuePath[] = [];
  const visit = (node: unknown, path: IssuePath): void => {
    if (Array.isArray(node)) node.forEach((child, index) => visit(child, [...path, index]));
    else if (isRecord(node)) {
      for (const [key, child] of Object.entries(node)) {
        found.push([...path, key]);
        visit(child, [...path, key]);
      }
    }
  };
  visit(value, []);
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
