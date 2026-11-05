import "server-only";

export type WorkspaceBusiness = {
  readonly id: string;
  readonly name: string;
};

/**
 * WP72-S2 business-switcher seam. Until a WP lists the owner's businesses
 * this derives the list from the current business only, which the layout has
 * already authorised through `requireWorkspaceAccess`. It never invents or
 * fetches another business, so it cannot show someone else's.
 */
export function listBusinesses(current: WorkspaceBusiness): readonly WorkspaceBusiness[] {
  return [current];
}
