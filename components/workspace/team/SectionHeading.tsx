import type { ReactNode } from "react";
import { EYEBROW } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";

/**
 * The board's section pattern: an eyebrow, then a serif 26px h2 with an italic
 * tail. `tabIndex` makes the heading a focus target (after a button unmounts).
 */
export function SectionHeading({
  id,
  eyebrow,
  lead,
  tail,
  focusable = false,
  className,
}: {
  id: string;
  eyebrow: ReactNode;
  lead: string;
  tail: string;
  focusable?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <p className={EYEBROW}>{eyebrow}</p>
      <h2
        id={id}
        tabIndex={focusable ? -1 : undefined}
        className={cn(
          "font-editorial text-[26px] font-normal leading-tight text-home-ink",
          focusable && "focus:outline-2 focus:outline-offset-2 focus:outline-home-orange-ink",
        )}
      >
        {lead} <em className="italic">{tail}</em>
      </h2>
    </div>
  );
}
