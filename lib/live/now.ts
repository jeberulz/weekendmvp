/**
 * Request-time clock for live schedule phases.
 * Keep Date.now() out of React component render bodies (react-hooks/purity).
 */
export function readLiveClockMs(): number {
  return Date.now();
}
