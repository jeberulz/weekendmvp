import type { TenantFontPair } from "./fonts";
import { THEME_MODES } from "@/lib/workspace/contracts/artifacts";
import type { TenantTheme } from "./theme";

/**
 * The per-kit stylesheet. A kit's colours are data that arrive at render time, so they are applied as CSS custom
 * properties in one generated rule scoped to a class derived from the values (no `style=` attribute anywhere).
 * Why a `<style>` and not `style={{ "--x": v }}` on the root: `::selection`, the scrollbar and `color-scheme` of the
 * document itself cannot be themed from a custom property on an element, and the rule is "no inline styles".
 * It is safe because every value is checked against `SAFE_VALUE` (a lowercase `#rrggbb`, a system colour keyword,
 * an integer, or one of our own font stacks) and the whole sheet against `SAFE_SHEET`, so no kit text can close a
 * declaration, a rule or the element. A failed check throws; nothing is repaired.
 */
const SAFE_VALUE =
  /^(#[0-9a-f]{6}|Highlight|HighlightText|[1-9]00|light|dark|var\(--tsr-[a-z-]+\), (serif|sans-serif|monospace)|ui-monospace, SFMono-Regular, Menlo, monospace)$/;
const SAFE_NAME = /^--t-[a-z-]+$/;
const SAFE_SHEET = /^[#a-zA-Z0-9{}:;(),.\-\s]*$/;
/** Even inside the character set, nothing that fetches, imports, escapes or overrides. */
const DENIED = /url|@|!|\\|import|expression/i;

export type TenantStyle = { scope: string; css: string };

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function tenantStyle(theme: TenantTheme, fonts: TenantFontPair, headingWeight: number, themeDocument: boolean): TenantStyle {
  const entries: [string, string][] = [
    ...Object.entries(theme.vars),
    ["--t-font-heading", fonts.heading],
    ["--t-font-body", fonts.body],
    ["--t-font-mono", fonts.mono],
    ["--t-hw", String(headingWeight)],
  ];
  for (const [name, value] of entries) {
    if (!SAFE_NAME.test(name) || !SAFE_VALUE.test(value)) throw new RangeError(`Unsafe tenant style value for ${name}`);
  }
  if (!THEME_MODES.some((mode) => mode === theme.mode)) throw new RangeError("Unsafe tenant theme mode");
  if (!Number.isInteger(headingWeight) || headingWeight < 100 || headingWeight > 900) throw new RangeError("Unsafe heading weight");
  const declarations = [...entries.map(([name, value]) => `${name}:${value}`), `color-scheme:${theme.mode}`].join(";");
  const scope = `tsr-${fnv1a(declarations)}`;
  let css = `.${scope}{${declarations}}`;
  if (themeDocument) {
    const ground = theme.vars["--t-ground"];
    css += `html:has(.${scope}){scrollbar-color:${theme.vars["--t-control"]} ${ground};color-scheme:${theme.mode};background:${ground}}`;
  }
  if (!SAFE_SHEET.test(css) || DENIED.test(css)) throw new RangeError("Unsafe tenant stylesheet");
  return { scope, css };
}
