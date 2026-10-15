"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { SignOutButton } from "@/app/dashboard/SignOutButton";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { BILLING_NAV } from "@/components/platform/shell/workspace-current";
import { api } from "@/convex/_generated/api";

function AccountBody() {
  const user = useQuery(api.currentUser.requireCurrent, {});
  if (user === undefined) {
    return <ModuleSkeleton label="Loading account" className="h-28" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
          Email
        </p>
        <p className="break-all text-[15px] text-home-ink">
          {user.email ?? "No email on this account"}
        </p>
        <p className="text-sm text-home-ink-3">Read-only for now.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={BILLING_NAV.href}
          className="inline-flex min-h-11 items-center justify-center rounded-[9px] border border-home-ink bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:bg-home-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          {BILLING_NAV.label}
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}

/** Account email (read-only), plan link, and sign out. */
export function SettingsAccount() {
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading account" className="h-28" />}>
      <AccountBody />
    </PersonalModule>
  );
}
