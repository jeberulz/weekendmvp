"use client";

import { ArrowLeft } from "lucide-react";
import type { Ref } from "react";
import { BTN_SECONDARY, CARD, EYEBROW } from "@/components/workspace/kit/styles";
import { partnerNameFromWizard, type WizardAnswersProgress } from "@/lib/workspace/contracts/wizard";
import { PARTNER_PERSONALITY_OPTIONS } from "@/lib/workspace/wizard/labels";
import { cn } from "@/lib/utils";

export type MeetCofounderProps = {
  readonly answers: WizardAnswersProgress;
  readonly pending: boolean;
  /** A failed Back (or other call) from this screen, announced as an alert. */
  readonly error?: string | null;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  readonly onBack: () => void;
};

/**
 * The wizard's end screen. A placeholder until WP75 brings the roster and
 * WP74-S4 creates the business: nothing is created here.
 */
export function MeetCofounder({ answers, pending, error = null, headingRef, onBack }: MeetCofounderProps) {
  const name = partnerNameFromWizard(answers);
  const personality = answers.partnerPersonality ? PARTNER_PERSONALITY_OPTIONS[answers.partnerPersonality] : null;
  return (
    <section aria-labelledby="meet-cofounder-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className={EYEBROW}>Meet your co-founder</p>
        <h2
          id="meet-cofounder-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-editorial text-[28px] leading-tight tracking-[-0.015em] text-home-ink focus:outline-none sm:text-[32px]"
        >
          Meet {name}, your co-founder
        </h2>
      </div>
      <div className={cn(CARD, "flex flex-col gap-2 p-5 text-sm text-home-ink-2")}>
        {personality ? (
          <p>
            <span className="font-medium text-home-ink">{personality.label}.</span> {personality.hint}
          </p>
        ) : null}
        {answers.name ? (
          <p>
            Building <span className="font-medium text-home-ink">{answers.name.chosen}</span> with you.
          </p>
        ) : null}
        <p>Your answers are saved. {name} puts your team together in the next step.</p>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg border border-home-clay-ink/30 bg-home-clay px-4 py-3 text-sm text-home-clay-ink">
          {error}
        </p>
      ) : null}
      <div className="border-t border-home-rule pt-4">
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
