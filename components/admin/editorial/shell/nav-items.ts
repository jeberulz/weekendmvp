import { Activity, Archive, FileStack, Inbox, Rocket, Settings } from "lucide-react";

export const EDITORIAL_BASE = "/admin/editorial";

export const EDITORIAL_NAV = [
  { href: EDITORIAL_BASE, label: "Review queue", icon: Inbox, countKey: "queue" },
  { href: `${EDITORIAL_BASE}/library`, label: "Library", icon: FileStack, countKey: null },
  { href: `${EDITORIAL_BASE}/releases`, label: "Releases", icon: Rocket, countKey: "releases" },
  { href: `${EDITORIAL_BASE}/trash`, label: "Trash", icon: Archive, countKey: null },
  { href: `${EDITORIAL_BASE}/activity`, label: "Activity", icon: Activity, countKey: null },
  { href: `${EDITORIAL_BASE}/settings`, label: "Settings", icon: Settings, countKey: null },
] as const;

export type NavCounts = { queue: number; releases: number } | null;

/** The queue owns the base path and idea workspaces; others match by prefix. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === EDITORIAL_BASE) return pathname === EDITORIAL_BASE || pathname.startsWith(`${EDITORIAL_BASE}/ideas`);
  return pathname === href || pathname.startsWith(`${href}/`);
}
