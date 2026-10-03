/**
 * Characters JSON.stringify leaves raw that are unsafe inside an inline
 * <script>: "<" (so "</script>" or "<!--" in a string could end the element
 * or open a comment), ">" and "&" for good measure, and the line separators
 * U+2028 and U+2029.
 */
const SCRIPT_UNSAFE = new RegExp(`[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");

/** A character as its JSON \u escape ("<" becomes "\u003c"), which JSON.parse reads back as the same character. */
function unicodeEscape(ch: string): string {
  return `${String.fromCharCode(92)}u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

/**
 * JSON for an inline <script>: JSON.stringify, then every "<", ">", "&",
 * U+2028 and U+2029 written as its \u escape. These characters can only
 * occur inside JSON strings, so the parsed value is identical and
 * structured-data consumers see the same data; page text that reaches a
 * schema (an idea's How-it-works steps, say) can no longer close the element.
 */
export function jsonForScript(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(SCRIPT_UNSAFE, unicodeEscape);
}

/** Server-rendered JSON-LD block. Pass a schema.org object or @graph. */
export function JsonLd({ schema }: { schema: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonForScript(schema) }}
    />
  );
}
