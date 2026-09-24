"use client";

import Link from "next/link";
import { useState, type FocusEvent, type MouseEvent } from "react";

import { GOAL_LABEL } from "@/lib/home/labels";
import type { IndexRow } from "@/lib/home/types";
import { cn } from "@/lib/utils";
import { Icon } from "../icons";
import { IdeaArt } from "../IdeaArt";
import { WeekendMeter } from "../ui";

const COLS = "lg:grid-cols-[96px_minmax(0,1fr)_168px_236px_96px_32px]";
/** Row colours flip to ink on the orange hover/focus fill, wide screens only. */
const INK_ON_HOT = "lg:group-hover:text-home-ink lg:group-focus-visible:text-home-ink";

/**
 * The newest ideas as an index. On wide screens a hovered or focused row
 * turns orange and that idea's art floats beside it (decorative only).
 */
export function IndexList({ rows, mobileCount = 6 }: { rows: IndexRow[]; mobileCount?: number }) {
  const [preview, setPreview] = useState<{ art: string; top: number } | null>(null);

  function show(row: IndexRow) {
    return (e: MouseEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement>) => {
      const el = e.currentTarget;
      setPreview(row.art ? { art: row.art, top: el.offsetTop + el.offsetHeight / 2 - 84 } : null);
    };
  }

  return (
    <div className="relative" onMouseLeave={() => setPreview(null)}>
      <div aria-hidden className={cn("hidden px-5 pb-3 font-mono text-[11px] tracking-[0.08em] text-home-d3 lg:grid", COLS)}>
        <span>NO.</span>
        <span>IDEA</span>
        <span>CATEGORY</span>
        <span>BUILD TIME</span>
        <span>GOAL</span>
        <span />
      </div>
      <ol className="border-b border-home-dr lg:border-b-0">
        {rows.map((row, i) => (
          <li key={row.slug} className={cn(i >= mobileCount && "max-lg:hidden")}>
            <Link
              href={`/ideas/${row.slug}`}
              aria-label={`${row.title}. ${row.categoryName}, ${row.buildTime} hours, ${GOAL_LABEL[row.revenueGoal] ?? ""} goal`}
              onMouseEnter={show(row)}
              onFocus={show(row)}
              onBlur={() => setPreview(null)}
              className={cn(
                "group flex flex-col gap-2.5 border-t border-home-dr py-[18px] transition-colors lg:grid lg:min-h-[78px] lg:items-center lg:gap-0 lg:rounded-xl lg:px-5 lg:py-3",
                "lg:hover:border-transparent lg:hover:bg-home-orange-light lg:focus-visible:border-transparent lg:focus-visible:bg-home-orange-light",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light",
                COLS,
              )}
            >
              <span className={cn("flex justify-between font-mono text-[11px] tracking-[0.06em] text-home-d3 lg:text-[13px] lg:tracking-normal", INK_ON_HOT)}>
                <span>
                  N°{String(row.libraryNo).padStart(3, "0")}
                  <span className="lg:hidden"> · {row.categoryName.toUpperCase()}</span>
                </span>
                <span className="text-home-d2 lg:hidden">
                  {row.buildTime} HRS · {GOAL_LABEL[row.revenueGoal] ?? ""}
                </span>
              </span>
              <span className="flex items-start justify-between gap-4 lg:block">
                <span className={cn("font-editorial text-[23px] leading-[1.12] tracking-[-0.01em] text-home-d1 lg:line-clamp-2 lg:pr-6 lg:text-[26px]", INK_ON_HOT)}>
                  {row.title}
                </span>
                <span className="pt-1 text-home-d1 lg:hidden">
                  <Icon name="arrow" size={20} strokeWidth={1.75} />
                </span>
              </span>
              <span className={cn("hidden font-mono text-xs uppercase tracking-[0.08em] text-home-d2 lg:block", INK_ON_HOT)}>
                {row.categoryName}
              </span>
              <span className="flex items-center gap-3">
                <WeekendMeter hours={row.buildTime} cell={8} showNote={false} dark hoverInk />
                <span className={cn("hidden font-mono text-[13px] font-medium text-home-d1 lg:inline", INK_ON_HOT)}>{row.buildTime} HRS</span>
              </span>
              <span className={cn("hidden font-mono text-[13px] text-home-d2 lg:block", INK_ON_HOT)}>{GOAL_LABEL[row.revenueGoal] ?? ""}</span>
              <span className={cn("hidden text-home-d1 lg:block", INK_ON_HOT)}>
                <Icon name="arrow" size={20} strokeWidth={1.75} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {preview && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-[250px] z-10 hidden w-[260px] -rotate-[4deg] overflow-hidden rounded-[14px] border-4 border-home-d1 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] lg:block"
          style={{ top: preview.top }}
        >
          <IdeaArt src={preview.art} sizes="720px" className="h-[160px] w-full" />
        </div>
      )}
    </div>
  );
}
