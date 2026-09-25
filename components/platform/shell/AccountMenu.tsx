"use client";

import { ChevronsUpDown, CreditCard, LogOut, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useSignOut } from "@/app/dashboard/SignOutButton";
import { cn } from "@/lib/utils";
import { BILLING_NAV, SETTINGS_NAV } from "./workspace-current";

const itemClass =
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-home-ink outline-none data-[disabled]:cursor-wait data-[disabled]:opacity-60 data-[highlighted]:bg-home-sunk data-[highlighted]:shadow-[inset_0_0_0_2px_var(--color-home-orange-ink)]";

/** Desktop account menu in the sidebar footer. Mobile uses the Account sheet. */
export function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const signOut = useSignOut();

  return (
    // Non-modal: a modal menu aria-hides the page while its links stay
    // focusable (axe aria-hidden-focus). Escape and outside clicks still close it.
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={collapsed ? "Account" : undefined}
          title={collapsed ? "Account" : undefined}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-home-ink-2 transition-colors hover:bg-home-card/70 hover:text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink data-[state=open]:bg-home-card",
            collapsed && "justify-center px-0",
          )}
        >
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-home-ochre text-home-ochre-ink"
          >
            <UserRound className="size-4" />
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 font-medium text-home-ink">Account</span>
              <ChevronsUpDown className="size-4 shrink-0" aria-hidden />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 min-w-56 rounded-xl border border-home-rule bg-home-card p-1.5 font-sans text-home-ink shadow-[0_16px_40px_-16px_rgba(26,24,20,0.35)]"
        >
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href={BILLING_NAV.href}>
              <CreditCard className="size-4 text-home-ink-2" aria-hidden />
              {BILLING_NAV.label}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href={SETTINGS_NAV.href}>
              <Settings2 className="size-4 text-home-ink-2" aria-hidden />
              {SETTINGS_NAV.label}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-home-rule" />
          <DropdownMenu.Item
            className={itemClass}
            disabled={signOut.pending}
            onSelect={(event) => {
              event.preventDefault();
              void signOut.run();
            }}
          >
            <LogOut className="size-4 text-home-ink-2" aria-hidden />
            {signOut.pending ? "Signing out…" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
