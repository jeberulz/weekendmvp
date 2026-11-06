"use client";

import type { Ref } from "react";
import { CARD, EYEBROW } from "@/components/workspace/kit/styles";
import { partnerNameFromWizard, type WizardAnswersProgress } from "@/lib/workspace/contracts/wizard";
import { PARTNER_PERSONALITY_OPTIONS } from "@/lib/workspace/wizard/labels";
import { cn } from "@/lib/utils";

export type MeetCofounderProps = {
  readonly answers: WizardAnswersProgress;
  /** The business `createBusiness` made (WP74-S4). */
  readonly business: { readonly name: string; readonly slug: string };
  readonly headingRef?: Ref<HTMLHeadingElement>;
};

/**
 * The wizard's end screen, after the business exists. The roster comes with
 * WP75; until then this names the partner and the business.
 */
export function MeetCofounder({ answers, business, headingRef }: MeetCofounderProps) {
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
        <p>
          <span className="font-medium text-home-ink">{business.name}</span> is created. {name} is building it with you.
        </p>
        <p>
          Suggested web address: <span className="font-mono text-home-ink">{business.slug}.weekendmvp.app</span>. It is
          confirmed when you publish.
        </p>
        <p>{name} puts your team together in the next step.</p>
      </div>
    </section>
  );
}
