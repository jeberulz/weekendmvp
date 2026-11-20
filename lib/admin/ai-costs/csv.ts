/**
 * WP93. CSV for the console's exports. RFC 4180 quoting, and a leading quote
 * on any cell a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab,
 * carriage return), so an exported email or prompt ref can never execute.
 */

export type CsvCell = string | number | boolean | null;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Dollars with six decimals, so a CSV total sums back to the exact micro-USD figure. */
export function csvUsd(microUsd: number | null): string {
  if (microUsd === null) return "";
  const sign = microUsd < 0 ? "-" : "";
  const abs = Math.abs(microUsd);
  return `${sign}${Math.floor(abs / 1_000_000)}.${String(abs % 1_000_000).padStart(6, "0")}`;
}
