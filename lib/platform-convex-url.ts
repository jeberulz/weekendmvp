/**
 * Mirrors convex@1.43.0's internal `validateDeploymentUrl` checks from
 * `convex/src/common/index.ts`. That helper is not in the package export map,
 * so keep this guard narrow and ahead of every ConvexReactClient construction.
 */
export function isValidPlatformConvexUrl(
  value: string | undefined,
): value is string {
  if (!value || value.trim() !== value) return false;
  if (!(value.startsWith("http:") || value.startsWith("https:"))) {
    return false;
  }

  try {
    new URL(value);
  } catch {
    return false;
  }

  return !value.endsWith(".convex.site");
}
