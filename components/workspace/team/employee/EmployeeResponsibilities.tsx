import { Ban, Check, FileInput } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { CARD } from "@/components/workspace/kit/styles";
import { SectionHeading } from "@/components/workspace/team/SectionHeading";
import { cn } from "@/lib/utils";
import { ROLE_CATALOGUE } from "@/convex/crew/roles";
import { worksFrom, type EmployeeProfile } from "@/lib/workspace/employeePage";

/**
 * WP67 "The job, in full", server-rendered from code: what the employee owns
 * (grounded in the artifact they draft), what their launch steps read and
 * what they will not do. Names come from the role catalogue, which fixes one
 * name per role. Who starts after them depends on this business's roster, so
 * the live "Now and next" section says that.
 */

const CATALOGUE_ROSTER = ROLE_CATALOGUE.map((entry) => ({ role: entry.key, name: entry.employeeName }));

function Block({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(CARD, "flex flex-col gap-2 p-4")}>
      <h3 id={id} className="flex items-center gap-2 text-[15px] font-semibold text-home-ink">
        <Icon aria-hidden className="size-4 text-home-ink-3" />
        {title}
      </h3>
      {children}
    </section>
  );
}

const LIST = "flex list-disc flex-col gap-1.5 pl-5 text-sm text-home-ink marker:text-home-ink-3";

export function EmployeeResponsibilities({ profile, lead }: { profile: EmployeeProfile; lead: string }) {
  const inputs = worksFrom(profile.role, CATALOGUE_ROSTER, lead);
  return (
    <section aria-labelledby="job-h" className="flex flex-col gap-3">
      <SectionHeading id="job-h" eyebrow={`What ${profile.name} is responsible for`} lead="The job," tail="in full." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
        <Block id="job-owns-h" title={`What ${profile.name} owns`} icon={Check}>
          <ul className={LIST}>
            {profile.responsibilities.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Block>
        {inputs.length === 0 ? null : (
          <Block id="job-inputs-h" title={`What ${profile.name} works from`} icon={FileInput}>
            <ul className={LIST}>
              {inputs.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Block>
        )}
        <Block id="job-wont-h" title={`What ${profile.name} won't do`} icon={Ban}>
          <ul className={LIST}>
            {profile.wontDo.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Block>
      </div>
    </section>
  );
}
