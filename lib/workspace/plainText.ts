/**
 * Character classes for text that came from a model, a founder or a document
 * and is shown or stored as plain text (WP77-S4 card subject lines, WP77-S5
 * Wren memory). Pure: no Convex, no I/O.
 */

/** Control characters (C0, DEL and C1): read as a space. */
export function isControlChar(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

/**
 * Zero-width format characters: the soft hyphen, zero-width spaces and
 * joiners, the word joiner and invisible operators, bidi controls, the BOM
 * and Unicode tag characters. Dropped without leaving a space.
 */
export function isInvisibleChar(code: number): boolean {
  return code === 0xad || (code >= 0x200b && code <= 0x200f) || (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) || (code >= 0x2066 && code <= 0x2069) || code === 0xfeff ||
    (code >= 0xe0000 && code <= 0xe007f);
}

/** A UTF-16 surrogate unit with no partner (left by a cut through a pair, or sent broken). */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * The text with every lone surrogate dropped, so it is well-formed Unicode.
 * Convex refuses a string that is not, which would throw the write.
 */
export function dropLoneSurrogates(text: string): string {
  return text.replace(LONE_SURROGATE, "");
}

/** At most `max` UTF-16 units, never ending in half of a surrogate pair. */
export function sliceWellFormed(text: string, max: number): string {
  return dropLoneSurrogates(text.length > max ? text.slice(0, max) : text);
}
