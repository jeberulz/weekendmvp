/**
 * WP75-S4a: shared types for the deterministic quality checks.
 *
 * Every check is pure (no Convex, no I/O, no model call) and returns
 * structured findings. `{ hard, soft }` is the shape S4b feeds into the one
 * repair call and WP76 reuses for its own generators.
 *
 * - hard: the artifact must not be stored or shown as is (a faked proof, a
 *   market number in an own idea, a failing contrast pair, a layout the
 *   direction forbids, a build prompt that breaks standard v1). Triggers the
 *   one repair call.
 * - soft: worth fixing and cheap to fix while a repair is happening anyway
 *   (weak slop phrases, triads, display-length targets). Never triggers a
 *   repair on its own.
 *
 * Relative imports only: the Convex bundler loads these files.
 */

export type IssuePath = readonly (string | number)[];
export type IssueSeverity = "hard" | "soft";

export type CheckIssue = {
  /** Stable machine code, lower_snake_case. */
  readonly code: string;
  /** Where in the artifact (keys and array indexes), as the JSON walk saw it. */
  readonly path: IssuePath;
  /** One sentence the repair call can act on. Quotes at most a short snippet. */
  readonly message: string;
  readonly severity: IssueSeverity;
};

export type CheckResult = {
  readonly hard: readonly CheckIssue[];
  readonly soft: readonly CheckIssue[];
};

export const EMPTY_RESULT: CheckResult = Object.freeze({ hard: [], soft: [] });

export function issue(severity: IssueSeverity, code: string, path: IssuePath, message: string): CheckIssue {
  return { code, path: [...path], message, severity };
}

/**
 * Splits a flat list into `{ hard, soft }`, keeping the first issue for each
 * code and path (three star ratings in one string are one issue).
 */
export function toResult(issues: readonly CheckIssue[]): CheckResult {
  const seen = new Set<string>();
  const hard: CheckIssue[] = [];
  const soft: CheckIssue[] = [];
  for (const found of issues) {
    const key = `${found.code}|${JSON.stringify(found.path)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (found.severity === "hard" ? hard : soft).push(found);
  }
  return { hard, soft };
}

export function mergeResults(...results: readonly CheckResult[]): CheckResult {
  return toResult(results.flatMap((result) => [...result.hard, ...result.soft]));
}

export const hasHardIssues = (result: CheckResult): boolean => result.hard.length > 0;
export const isClean = (result: CheckResult): boolean => result.hard.length === 0 && result.soft.length === 0;

const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/**
 * A path as text that is safe to show to a model as data: array indexes as
 * `[n]`, plain identifier keys as `.key`, anything else (a key the model
 * chose, with spaces, quotes or instructions in it) as `.*`.
 */
export function formatIssuePath(path: IssuePath): string {
  let text = "";
  for (const segment of path) {
    if (typeof segment === "number") text += `[${Number.isInteger(segment) && segment >= 0 ? segment : "*"}]`;
    else text += SAFE_KEY.test(segment) ? `${text === "" ? "" : "."}${segment}` : `${text === "" ? "" : "."}*`;
  }
  return text === "" ? "(root)" : text;
}

export type RepairIssue = {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: IssueSeverity;
};

/**
 * The issues as the repair call's data block: hard issues first, paths
 * redacted by `formatIssuePath`, at most `max` entries.
 */
export function toRepairIssues(result: CheckResult, max = 40): RepairIssue[] {
  return [...result.hard, ...result.soft].slice(0, max).map((found) => ({
    code: found.code,
    path: formatIssuePath(found.path),
    message: found.message,
    severity: found.severity,
  }));
}

/**
 * A short, single-line excerpt of matched text for a message, safe to show a
 * model as data: no control or invisible format characters (bidi overrides,
 * zero-width), no quotes or backticks, and no `<`, `>`, `{` or `}` (so it
 * cannot close or open a tag or a JSON object in the repair prompt).
 */
export function snippet(text: string, max = 48): string {
  const clean = text
    .replace(/\p{Cf}/gu, "")
    .replace(/[\u0000-\u001F\u007F-\u009F"`<>{}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
