"use client";

import { LogOut } from "lucide-react";
import { useSignOut } from "@/app/dashboard/SignOutButton";
import { FOCUS } from "@/components/workspace/kit/styles";
import { businessInitial } from "@/components/workspace/shell/nav-utils";

/**
 * The footer user row (Nav board): initials only, never a photo, "Founder"
 * because the access gate is owner-only, and the workspace's way to sign out.
 * Sign out stays focusable while it runs (`aria-disabled`).
 */
export function SidebarUserRow({ name }: { name: string }) {
  const { pending, run } = useSignOut();
  return (
    <div className="flex items-center gap-2.5 border-t border-home-rule px-1.5 pt-2.5">
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-home-sky text-xs font-semibold text-home-sky-ink"
      >
        {businessInitial(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm text-home-ink">{name}</span>
        <span className="text-xs text-home-ink-3">Founder</span>
      </span>
      <button
        type="button"
        aria-label={pending ? "Signing out" : "Sign out"}
        aria-disabled={pending || undefined}
        onClick={() => {
          if (!pending) void run();
        }}
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md text-home-ink-2 hover:bg-home-sunk hover:text-home-ink aria-disabled:cursor-wait aria-disabled:opacity-60 ${FOCUS}`}
      >
        <LogOut aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
