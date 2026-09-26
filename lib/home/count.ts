/**
 * Count-up helpers for the homepage motion (WP43). A counter animates the
 * number inside a short label ("226", "$15.81B", "12 hrs") and must land on
 * exactly the text the server rendered.
 */

export type CountParts = {
  prefix: string;
  value: number;
  decimals: number;
  /** The integer part was written with thousands commas ("2,300"). */
  grouped: boolean;
  suffix: string;
};

const NUMBER = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\D*)$/;

/** Splits a label into prefix, number and suffix. Null when there is no single number to count. */
export function parseCount(text: string): CountParts | null {
  const m = NUMBER.exec(text);
  if (!m) return null;
  const [, prefix, int, frac = "", suffix] = m;
  const value = Number(`${int.replace(/,/g, "")}${frac ? `.${frac}` : ""}`);
  if (!Number.isFinite(value)) return null;
  return { prefix, value, decimals: frac.length, grouped: int.includes(","), suffix };
}

/** The label with `value` in place of its number, in the label's own format. */
export function formatCount(parts: CountParts, value: number): string {
  const [int, frac] = value.toFixed(parts.decimals).split(".");
  const whole = parts.grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : int;
  return `${parts.prefix}${whole}${frac ? `.${frac}` : ""}${parts.suffix}`;
}
