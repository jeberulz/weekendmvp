"use client";

import { ChevronsUpDown, CreditCard, LogOut, Settings2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useCallback, useState } from "react";
import { BILLING_NAV, SETTINGS_NAV } from "@/components/platform/shell/workspace-current";

const itemClass =
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-neutral-800 outline-none data-[disabled]:cursor-wait data-[disabled]:opacity-60 data-[highlighted]:bg-neutral-100";

/**
 * Cookie-backed Convex Auth sign-out for public idea pages.
 *
 * Do not mount `AuthConvexClientProvider` here. That wraps
 * `ConvexAuthNextjsProvider` → `ConvexProviderWithAuth({ useAuth })`, but
 * `useAuth` only has a value under `ConvexAuthNextjsServerProvider`'s
 * `AuthProvider`. Without it, `useAuth()` is `undefined` and production
 * throws `Cannot destructure property 'isLoading' of undefined`, taking
 * down the whole signed-in idea page. Mounting the server provider would
 * also force the static idea reader dynamic — same reason #85 avoided
 * `AuthPlatformProvider` in the layout.
 *
 * POST `/api/auth` is the Next.js cookie proxy the dashboard sign-out uses
 * under the hood; it clears httpOnly session cookies. Middleware then drops
 * the readable `wmvp_signed_in` hint.
 */
async function signOutViaAuthApi() {
  try {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "auth:signOut", args: {} }),
    });
  } catch {
    // Already signed out / network blip — still leave the page.
  }
}

/**
 * Compact account menu for the idea-page member chrome. Billing/Settings are
 * plain links; sign-out hits the auth cookie proxy (no Convex React provider).
 */
export function IdeaAccountMenu() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = useCallback(async () => {
    setPending(true);
    try {
      await signOutViaAuthApi();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

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
            disabled={pending}
            onSelect={(event) => {
              event.preventDefault();
              void run();
            }}
          >
            <LogOut className="size-4 text-neutral-500" aria-hidden />
            {pending ? "Signing out…" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
