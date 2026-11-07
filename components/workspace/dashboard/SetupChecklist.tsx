import Link from "next/link";
import { StatusPill } from "@/components/workspace/kit/StatusPill";
import { CARD, EYEBROW, FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import type { ChecklistRow } from "@/lib/workspace/dashboard";

/**
 * "Background build / What's ready": the board's site-setup list, built from
 * real launch state. Anything not built reads "Coming soon", never done or
 * queued, and every row says its status in words.
 */
export function SetupChecklist({ rows }: { rows: readonly ChecklistRow[] }) {
  return (
    <section aria-labelledby="prog-h" className="flex min-w-0 flex-col gap-2.5">
      <p className={EYEBROW}>Background build</p>
      <h2 id="prog-h" className="font-editorial text-2xl font-normal text-home-ink">
        What&apos;s ready
      </h2>
      <ul className={cn(CARD, "overflow-hidden")}>
        {rows.map((row) => (
          <li
            key={row.id}
            data-row={row.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-home-sunk px-3.5 py-3 last:border-b-0"
          >
            <span className="flex min-w-0 flex-[1_1_10rem] flex-col">
              <span className="text-sm font-medium text-home-ink">{row.title}</span>
              <span className="text-[13px] text-home-ink-2">{row.detail}</span>
              {row.href !== undefined && row.linkLabel !== undefined ? (
                <Link
                  href={row.href}
                  className={cn("mt-0.5 inline-flex min-h-6 w-fit items-center text-[13px] text-home-orange-ink underline underline-offset-2 hover:text-home-ink", FOCUS)}
                >
                  {row.linkLabel}
                </Link>
              ) : null}
            </span>
            {row.status.set === "output" ? (
              <StatusPill set="output" status={row.status.status} />
            ) : (
              <StatusPill set="step" status={row.status.status} label={row.status.label} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
