import { SkippedRoleCard } from "@/components/workspace/kit/EmployeeCard";
import { SectionHeading } from "@/components/workspace/team/SectionHeading";
import type { TeamSkipped } from "@/lib/workspace/teamHq";

/**
 * "Skipped for {business}, on purpose." The roles the lead left out, each with
 * its reason. There is no hire action in L1, so the note says so; the cards
 * carry no Hire button. Nothing renders when no role was skipped.
 */
export function SkippedRoles({
  businessName,
  lead,
  skipped,
}: {
  businessName: string;
  lead: string;
  skipped: readonly TeamSkipped[];
}) {
  if (skipped.length === 0) return null;
  return (
    <section aria-labelledby="skip-h" className="flex flex-col gap-3">
      <SectionHeading id="skip-h" eyebrow="Not on the team" lead={`Skipped for ${businessName},`} tail="on purpose." />
      <p className="text-sm text-home-ink-2">{lead} left these out for now. Each one says why.</p>
      <ul aria-label="Skipped roles" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-2.5">
        {skipped.map((entry) => (
          <SkippedRoleCard key={entry.role} role={entry.role} reason={entry.reason} />
        ))}
      </ul>
      <p className="text-[13px] text-home-ink-3">Hiring a skipped role is coming soon.</p>
    </section>
  );
}
