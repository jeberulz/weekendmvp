import { cn } from "@/lib/utils";
import { WEEKEND_TEST } from "../content";
import { Icon } from "../icons";
import { Container, Em, Eyebrow, Stamp } from "../ui";

const ROTATE = ["-rotate-[3deg]", "rotate-[2deg]", "-rotate-[1.5deg]", "rotate-[2.5deg]", "-rotate-[2deg]", "rotate-[1.5deg]"];
const NUDGE = ["", "lg:translate-y-7", "", "", "lg:translate-y-5", ""];

/** 04 · What makes an idea weekend-sized, as a wall of sticky notes. */
export function WeekendTest({ averageHours }: { averageHours: number }) {
  return (
    <section aria-labelledby="home-test-title" className="relative overflow-hidden bg-home-paper">
      <div aria-hidden className="home-dots absolute inset-0" />
      <Container className="relative flex flex-col gap-8 py-14 lg:gap-14 lg:py-24">
        <div className="flex flex-col gap-3.5 lg:gap-4">
          <Eyebrow>The weekend test</Eyebrow>
          <h2 id="home-test-title" className="font-editorial text-[38px] font-normal leading-[1.02] tracking-[-0.025em] text-home-ink lg:text-[64px] lg:leading-[1.06] lg:tracking-[-0.02em]">
            What makes an idea <Em>weekend-sized.</Em>
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-center">
          <ul className="grid grid-cols-2 gap-x-3.5 gap-y-[18px] lg:grid-cols-3 lg:gap-x-10 lg:gap-y-12">
            {WEEKEND_TEST.map((note, i) => (
              <li
                key={note.title}
                className={cn(
                  "relative flex min-h-[190px] flex-col gap-2.5 px-4 pb-[18px] pt-[26px] shadow-[0_14px_22px_-14px_rgba(26,24,20,0.45)] lg:min-h-[290px] lg:gap-3.5 lg:px-7 lg:pb-[26px] lg:pt-[34px]",
                  i === 2 ? "bg-home-note-peach" : "bg-home-note",
                  ROTATE[i],
                  NUDGE[i],
                )}
              >
                <span aria-hidden className="absolute left-1/2 top-[9px] size-[11px] -translate-x-1/2 rounded-full bg-home-orange shadow-[0_2px_3px_rgba(0,0,0,0.3)] lg:top-3 lg:size-3.5" />
                <div className="flex items-center justify-between">
                  <span aria-hidden className="font-mono text-[11px] text-home-ink-2 lg:text-xs">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon name={note.icon} size={22} className="lg:size-7" />
                </div>
                <h3 className="font-editorial text-[21px] font-normal leading-[1.05] tracking-[-0.01em] text-home-ink lg:text-[34px] lg:leading-[1.02] lg:tracking-[-0.015em]">
                  {note.title.replace("{hours}", String(averageHours))}
                </h3>
                <p className="text-[13px] leading-[1.45] text-home-ink-2 lg:text-[15px]">{note.body(averageHours)}</p>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-[18px] lg:flex-col lg:gap-[22px] lg:text-center">
            <Stamp id="home-test-stamp" text="PASSES THE WEEKEND TEST · " icon="target" rotate={-8} className="size-[104px] lg:size-[150px]" />
            <p className="text-[15px] leading-[1.45] text-home-ink-2 lg:text-sm">
              Every idea is scoped for one person, a few AI tools, and about {averageHours} hours.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
