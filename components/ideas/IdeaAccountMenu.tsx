"use client";

import { ChevronsUpDown, CreditCard, LogOut, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useSignOut } from "@/app/dashboard/SignOutButton";
import { AuthConvexClientProvider } from "@/app/AuthConvexClientProvider";
import { BILLING_NAV, SETTINGS_NAV } from "@/components/platform/shell/workspace-current";

const itemClass =
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-neutral-800 outline-none data-[disabled]:cursor-wait data-[disabled]:opacity-60 data-[highlighted]:bg-neutral-100";

/**
 * Compact account menu for the idea-page member chrome. Reuses the dashboard
 * destinations and sign-out hook; mounts a client Convex auth provider so
 * the public idea page stays static (no AuthPlatformProvider in the layout).
 */
function IdeaAccountMenuInner() {
  const signOut = useSignOut();

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 transition-colors hover:border-neutral-500 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          <UserRound className="size-4" aria-hidden />
          <span className="hidden sm:inline">Account</span>
          <ChevronsUpDown className="size-3.5 text-neutral-400" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50 min-w-52 rounded-xl border border-neutral-200 bg-white p-1.5 font-sans text-neutral-900 shadow-[0_16px_40px_-16px_rgba(26,24,20,0.35)]"
        >
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href={BILLING_NAV.href}>
              <CreditCard className="size-4 text-neutral-500" aria-hidden />
              {BILLING_NAV.label}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href={SETTINGS_NAV.href}>
              <Settings2 className="size-4 text-neutral-500" aria-hidden />
              {SETTINGS_NAV.label}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
          <DropdownMenu.Item
            className={itemClass}
            disabled={signOut.pending}
            onSelect={(event) => {
              event.preventDefault();
              void signOut.run();
            }}
          >
            <LogOut className="size-4 text-neutral-500" aria-hidden />
            {signOut.pending ? "Signing out…" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function IdeaAccountMenu() {
  return (
    <AuthConvexClientProvider>
      <IdeaAccountMenuInner />
    </AuthConvexClientProvider>
  );
}
