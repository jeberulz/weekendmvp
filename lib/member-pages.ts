// Only these route templates can cross the analytics boundary.
export const memberPages = [
  "/startup-ideas", "/ideas/[slug]", "/ideas/requests", "/start/[slug]", "/start/own",
  "/dashboard", "/dashboard/projects", "/dashboard/projects/[id]", "/dashboard/billing",
  "/dashboard/builds", "/dashboard/builds/new", "/dashboard/builds/[id]", "/dashboard/compare",
  "/dashboard/explore", "/dashboard/live", "/dashboard/new", "/dashboard/saved", "/dashboard/settings",
  "/dashboard/b/[id]", ...["ads", "billing", "brand", "build-pack", "email", "files", "landing",
    "launch", "outbound", "settings", "social", "studio", "tasks", "team", "team/[employee]"]
    .map(section => `/dashboard/b/[id]/${section}`),
];

const templates = memberPages.filter(page => page.includes("[")).map(page => ({
  page, pattern: new RegExp("^" + page.replace(/\[\w+\]/g, "[a-zA-Z0-9_-]+") + "$"),
}));

export function memberPage(path: string) {
  if (memberPages.includes(path)) return path;
  return templates.find(template => template.pattern.test(path))?.page ?? null;
}
