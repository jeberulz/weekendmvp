"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useId, type Ref } from "react";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, FOCUS } from "@/components/workspace/kit/styles";
import { partnerNameFromWizard, type WizardAnswersProgress } from "@/lib/workspace/contracts/wizard";
import { PARTNER_PERSONALITY_OPTIONS } from "@/lib/workspace/wizard/labels";
import { cn } from "@/lib/utils";
import { ScreenHead } from "./wizard-ui";

export type CreateBusinessProps = {
  readonly answers: WizardAnswersProgress;
  readonly pending: boolean;
  /** A refusal or failure from "Create my business" (or Back), announced as an alert. */
  readonly error?: string | null;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** After `BUSINESS_LIMIT_REACHED`: the founder's own live business, when one was found. */
  readonly existingBusinessHref?: string | null;
  /** After `NAME_RESERVED` or `SLUG_UNAVAILABLE`: reopen the name step. */
  readonly onChooseName?: (() => void) | null;
  readonly onCreate: () => void;
  readonly onBack: () => void;
};

/**
 * WP74-S4: the finished wizard's handoff. Every step is answered; one click
 * creates the business, then the founder meets their co-founder.
 */
export function CreateBusiness({
  answers,
  pending,
  error = null,
  headingRef,
  existingBusinessHref = null,
  onChooseName = null,
  onCreate,
  onBack,
}: CreateBusinessProps) {
  const base = useId();
  const errorId = `${base}-error`;
  const partner = partnerNameFromWizard(answers);
  const businessName = answers.name?.chosen ?? "your business";
  const personality = answers.partnerPersonality ? PARTNER_PERSONALITY_OPTIONS[answers.partnerPersonality] : null;
  return (
    <section aria-labelledby={`${base}-heading`} aria-busy={pending || undefined} className="flex w-full max-w-[672px] flex-col gap-6">
      <ScreenHead
        headingId={`${base}-heading`}
        headingRef={headingRef}
        lead="Create "
        italic={businessName}
        tail="."
        sub={`Your answers are saved. Create the business to meet ${partner}, your co-founder.`}
      />
      {personality ? (
        <div className={cn(CARD, "p-5 text-sm text-home-ink-2")}>
          <p>
            <span className="font-medium text-home-ink">{personality.label}.</span> {personality.hint}
          </p>
        </div>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {pending ? "Creating your business…" : ""}
      </p>
      {error ? (
        <div className="flex flex-col gap-3">
          <p id={errorId} role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-4 py-3 text-sm text-home-clay-ink">
            {error}
          </p>
          {existingBusinessHref ? (
            <p className="text-sm">
              <Link href={existingBusinessHref} className={cn("font-medium text-home-ink underline underline-offset-2", FOCUS)}>
                Open your business
              </Link>
            </p>
          ) : null}
          {onChooseName ? (
            <div>
              <button
                type="button"
                className={BTN_SECONDARY}
                aria-disabled={pending || undefined}
                onClick={() => {
                  if (!pending) onChooseName();
                }}
              >
                Choose a different name
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-home-rule pt-4">
        <button
          type="button"
          className={cn(BTN_PRIMARY, "min-h-[52px] flex-1 text-[15px] sm:flex-none sm:px-8")}
          aria-disabled={pending || undefined}
          aria-describedby={error ? errorId : undefined}
          onClick={() => {
            if (!pending) onCreate();
          }}
        >
          {pending ? "Creating your business…" : "Create my business"}
        </button>
        <button
          type="button"
          className={BTN_SECONDARY}
          aria-disabled={pending || undefined}
          onClick={() => {
            if (!pending) onBack();
          }}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back
        </button>
      </div>
    </section>
  );
}
