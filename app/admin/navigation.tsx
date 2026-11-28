"use client";

import { usePathname } from "next/navigation";

const areas = [
  ["/admin", "Overview"], ["/admin/editorial", "Editorial"], ["/admin/pages", "Pages"],
  ["/admin/ai", "AI costs"], ["/admin/feedback", "Feedback"],
] as const;

export function AdminNavigation() {
  const path = usePathname();
  return <nav aria-label="Admin areas" className="relative z-20 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-stone-700 bg-stone-900 px-5 py-2 text-sm text-stone-200">
    <span className="mr-2 font-semibold text-white">Weekend MVP Admin</span>
    {areas.map(([href, label]) => {
      const current = path === href || (href !== "/admin" && path.startsWith(href + "/"));
      return <a key={href} href={href} aria-current={current ? "location" : undefined}
        className={`py-1 hover:underline ${current ? "font-semibold text-white underline underline-offset-4" : ""}`}>{label}</a>;
    })}
  </nav>;
}
