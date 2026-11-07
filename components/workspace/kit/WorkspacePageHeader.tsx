import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EYEBROW, EYEBROW_EMBER } from "./styles";

/** Default id of the page h1. A page has one h1, so one default is enough; pass `id` to override. */
export const WORKSPACE_HEADING_ID = "page-heading";

export type WorkspacePageHeaderProps = {
  /** The route name, e.g. "Email". Rendered uppercase. */
  eyebrow: string;
  /** Eyebrow colour: ink (default, most page boards) or ember (the Team HQ board). */
  eyebrowTone?: "ink" | "ember";
  /** Optional suffix after the eyebrow, e.g. the business name: "Team HQ · HydroTrail". */
  eyebrowSuffix?: string;
  /** The h1 sentence. Keep the page's existing words first. */
  lead: string;
  /** Optional italic tail appended to the sentence, e.g. "that sell your waitlist." */
  tail?: string;
  /** Optional line under the h1. */
  summary?: ReactNode;
  /** Optional right-side actions (buttons, a status pill). */
  actions?: ReactNode;
  /** Id of the h1, for `aria-labelledby` on the page's main region. */
  id?: string;
  className?: string;
};

/**
 * The one header for every workspace page: a route-name eyebrow (ink, or ember on Team HQ), a serif
 * sentence with an optional italic tail as the page's single h1, an optional
 * summary and an optional actions slot (Team HQ, Email and Brand kit boards).
 */
export function WorkspacePageHeader({
  eyebrow,
  eyebrowTone = "ink",
  eyebrowSuffix,
  lead,
  tail,
  summary,
  actions,
  id = WORKSPACE_HEADING_ID,
  className,
}: WorkspacePageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 flex-1 basis-[22rem]">
        <p className={cn(eyebrowTone === "ember" ? EYEBROW_EMBER : EYEBROW, "mb-2")}>
          {eyebrow}
          {eyebrowSuffix ? ` · ${eyebrowSuffix}` : ""}
        </p>
        <h1
          id={id}
          className="font-editorial text-[34px] font-normal leading-[1.1] tracking-[-0.02em] text-home-ink sm:text-[40px]"
        >
          {lead}
          {tail ? (
            <>
              {" "}
              <em className="italic">{tail}</em>
            </>
          ) : null}
        </h1>
        {summary ? <div className="mt-2 max-w-[620px] text-[15px] text-home-ink-2">{summary}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
