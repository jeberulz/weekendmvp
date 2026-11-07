import { EYEBROW } from "@/components/workspace/kit/styles";
import type { WizardCrewPreview } from "@/convex/workspace/wizard";

/**
 * WP90-S4 "Your crew": who the roster rules would hire for this idea's
 * profile and the answers so far (`crewPreviewFor`), with the reason for
 * every hire and every role left out. Display only: the business stores its
 * own roster plan when it is created.
 */
export function CrewPreview({ crew }: { crew: NonNullable<WizardCrewPreview> }) {
  return (
    <section
      aria-labelledby="crew-preview-heading"
      className="rounded-[10px] border border-home-rule bg-home-card p-[18px]"
    >
      <h2 id="crew-preview-heading" className="font-editorial text-xl font-normal text-home-ink">
        Your crew
      </h2>
      <p className="mb-3.5 mt-1.5 text-[13px] text-home-ink-3">
        Who I&rsquo;d hire for this idea from your answers so far. It changes as you answer.
      </p>
      <h3 className={EYEBROW}>Hiring · {crew.hired.length}</h3>
      <ul className="mb-4 mt-2 flex flex-col gap-2.5">
        {crew.hired.map((entry) => (
          <li key={entry.roleKey} className="text-sm text-home-ink">
            <span className="font-medium">{entry.employeeName}</span>
            <span className="text-home-ink-2"> · {entry.roleLabel}</span>
            <span className="block text-[13px] text-home-ink-2">{entry.reason}</span>
          </li>
        ))}
      </ul>
      {crew.skipped.length > 0 ? (
        <>
          <h3 className={EYEBROW}>Not hiring yet · {crew.skipped.length}</h3>
          <ul className="mt-2 flex flex-col gap-2.5">
            {crew.skipped.map((entry) => (
              <li key={entry.roleKey} className="text-sm text-home-ink-2">
                <span className="text-home-ink">{entry.roleLabel}</span>
                <span className="block text-[13px]">{entry.reason}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
