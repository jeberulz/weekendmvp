/**
 * WP93. Tells a refused input apart from a failure.
 *
 * Convex refuses a malformed id with `ArgumentValidationError` and a
 * malformed pagination cursor with `InvalidCursor`. Those mean "no such
 * page". Everything else (an outage, an expired session) is a real failure
 * and must reach the error boundary unchanged.
 */
const REJECTED_INPUT = /\b(?:ArgumentValidationError|InvalidCursor)\b/;

export function isRejectedInput(error: unknown): boolean {
  return error instanceof Error && REJECTED_INPUT.test(error.message);
}
