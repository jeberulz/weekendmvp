/**
 * WP44-S2 workspace navigation. Builds joins in WP44-S9 and Settings in
 * WP44-S8, once their pages exist, so no nav item ever leads to a 404.
 * "New idea" and "Interested" left the nav by rulings R4 and R3.
 */
export type WorkspaceNavId = "home" | "ideas" | "saved" | "billing";

export type WorkspaceNavItem = {
  id: WorkspaceNavId;
  label: string;
  href: string;
};

export const PRIMARY_NAV: readonly WorkspaceNavItem[] = [
  { id: "home", label: "Home", href: "/dashboard" },
  { id: "ideas", label: "Ideas", href: "/dashboard/explore" },
  // The Explore saved view until WP44-S5 adds /dashboard/saved.
  { id: "saved", label: "Saved", href: "/dashboard/explore?view=saved" },
];

export const BILLING_NAV: WorkspaceNavItem = {
  id: "billing",
  label: "Plan and billing",
  href: "/dashboard/billing",
};

export const STARTER_KIT_HREF = "/starter-kit";

// Ruling R3: Saved and Interested read as one list on screen.
const SAVED_VIEWS = new Set(["saved", "interested"]);

function isAtOrUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isWorkspaceNavCurrent(
  id: WorkspaceNavId,
  pathname: string,
  view: string | null,
): boolean {
  const savedView = view !== null && SAVED_VIEWS.has(view);
  switch (id) {
    case "home":
      return pathname === "/dashboard";
    case "ideas":
      return isAtOrUnder(pathname, "/dashboard/explore") && !savedView;
    case "saved":
      return (
        (pathname === "/dashboard/explore" && savedView) ||
        isAtOrUnder(pathname, "/dashboard/saved")
      );
    case "billing":
      return isAtOrUnder(pathname, "/dashboard/billing");
  }
}

type ShortcutEvent = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  target: { tagName?: string; isContentEditable?: boolean } | null;
};

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** "/" focuses search unless the person is already typing somewhere. */
export function isSearchShortcut(event: ShortcutEvent) {
  if (event.key !== "/" || event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target;
  if (!target) return true;
  if (target.isContentEditable) return false;
  return !TYPING_TAGS.has((target.tagName ?? "").toUpperCase());
}
