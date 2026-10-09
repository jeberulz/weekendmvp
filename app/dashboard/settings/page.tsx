import type { Metadata } from "next";
import Link from "next/link";
import { SettingsAnswers } from "@/components/platform/settings/SettingsAnswers";
import { BILLING_NAV } from "@/components/platform/shell/workspace-current";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <header className="mb-8 flex flex-col gap-1.5">
        <h1 className="font-editorial text-[34px] font-normal leading-[1.05] tracking-[-0.025em] text-home-ink sm:text-[42px]">
          Settings
        </h1>
      </header>
      {/* Members look for cancel in Settings too, so the way there is named here. */}
      <section
        aria-labelledby="settings-plan"
        className="mb-6 flex max-w-3xl flex-col gap-3 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6"
      >
        <h2 id="settings-plan" className="font-editorial text-[24px] font-normal leading-[1.15] text-home-ink">
          {BILLING_NAV.label}
        </h2>
        <p className="text-[15px] text-home-ink-2">See your plan and invoices, switch between monthly and annual, or cancel.</p>
        <Link
          href={BILLING_NAV.href}
          className="inline-flex min-h-11 items-center justify-center self-start rounded-[9px] border border-home-ink bg-home-card px-4 text-sm font-medium text-home-ink transition-colors hover:bg-home-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
        >
          Go to {BILLING_NAV.label}
        </Link>
      </section>
      <section
        aria-labelledby="settings-setup"
        className="flex max-w-3xl flex-col gap-4 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 id="settings-setup" className="font-editorial text-[24px] font-normal leading-[1.15] text-home-ink">
            How you build
          </h2>
          <p className="text-[15px] text-home-ink-2">
            These answers shape Picked for you. Every one is optional.
          </p>
        </div>
        <SettingsAnswers />
      </section>
    </div>
  );
}
