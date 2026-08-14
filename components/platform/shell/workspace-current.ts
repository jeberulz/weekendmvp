export type WorkspaceCurrentTarget = {
  href: string;
  match?: "exact" | "prefix";
  queryView?: "saved" | "interested";
};

export function isWorkspaceLinkCurrent(
  pathname: string,
  activeView: string | null,
  item: WorkspaceCurrentTarget,
) {
  if (item.queryView) {
    return pathname === "/dashboard/explore" && activeView === item.queryView;
  }
  if (
    item.href === "/dashboard/explore" &&
    (activeView === "saved" || activeView === "interested")
  ) {
    return false;
  }
  if (item.match === "exact") return pathname === item.href;
  if (item.match === "prefix") return pathname.startsWith(item.href);
  return false;
}
