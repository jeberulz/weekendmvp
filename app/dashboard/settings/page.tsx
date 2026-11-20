import type { Metadata } from "next";
import Link from "next/link";
import { SettingsAccount } from "@/components/platform/settings/SettingsAccount";
import { SettingsAnswers } from "@/components/platform/settings/SettingsAnswers";
import { BILLING_NAV } from "@/components/platform/shell/workspace-current";
import { DeleteAccountSection } from "./DeleteAccountSection";

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

      <section
        aria-labelledby="settings-account"
        className="mb-6 flex max-w-3xl flex-col gap-4 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="settings-account"
            className="font-editorial text-[24px] font-normal leading-[1.15] text-home-ink"
          >
            Account
          </h2>
          <p className="text-[15px] text-home-ink-2">
            Your signed-in email, plan and billing, and sign out.
          </p>
        </div>
        <SettingsAccount />
      </section>

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

      <section
        aria-labelledby="settings-delete"
        className="mt-6 flex max-w-3xl flex-col gap-4 rounded-[14px] border border-home-clay-ink/40 bg-home-card p-5 sm:p-6"
      >
        <div className="flex flex-col gap-2">
          <h2 id="settings-delete" className="font-editorial text-[24px] font-normal leading-[1.15] text-home-ink">
            Delete account
          </h2>
          <p className="text-[15px] text-home-ink-2">
            This deletes your businesses and everything in them (documents, chat, approvals, memory, files and
            sites), your saved ideas, notes, collections and plans, and your sign-in. You are signed out right away.
          </p>
          <p className="text-[15px] text-home-ink-2">
            We keep a few records without your details: AI usage and cost totals, payment records we need for our
            accounts, and a log that an action happened. Anything sent to a service we use, such as email or
            payments, is not removed from that service by this button.
          </p>
        </div>
        <DeleteAccountSection />
      </section>
    </div>
  );
}
