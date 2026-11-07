import Link from "next/link";
import { FileText, Palette } from "lucide-react";
import { FOCUS } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { FILES_RAIL_LINKS } from "@/lib/workspace/reviewPages";
import { workspacePath } from "@/lib/workspace/routes";

const GROUP_HEADING = "mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-home-ink-3";
const ROW = "flex min-h-10 items-center gap-2 rounded-md px-2.5 text-sm text-home-ink";

/**
 * The Files rail: only real entries. "What Wren knows" is the reader beside it; the rest are links to the pages
 * that hold the team's work (each has its own empty state). No file names, counts or statuses are invented.
 */
export function FilesRail({ projectId, name }: { projectId: string; name: string }) {
  return (
    <nav aria-label="Files" className="flex w-full flex-col gap-4 min-[900px]:w-[220px] min-[900px]:shrink-0">
      <div className="flex flex-col gap-0.5">
        <h2 className={GROUP_HEADING}>Memory</h2>
        <a href="#wren-memory" aria-current="location" className={cn(ROW, "bg-home-sunk font-medium", FOCUS)}>
          <FileText aria-hidden="true" className="size-[15px] shrink-0" strokeWidth={1.7} />
          What {name} knows
        </a>
      </div>
      <div className="flex flex-col gap-0.5">
        <h2 className={GROUP_HEADING}>Your team&apos;s work</h2>
        {FILES_RAIL_LINKS.map((entry) => {
          const Icon = entry.slug === "brand" ? Palette : FileText;
          const href = `${workspacePath(projectId, entry.slug)}${"hash" in entry ? `#${entry.hash}` : ""}`;
          return (
            <Link key={entry.slug} href={href} className={cn(ROW, "hover:bg-home-sunk", FOCUS)}>
              <Icon aria-hidden="true" className="size-[15px] shrink-0" strokeWidth={1.7} />
              {entry.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
