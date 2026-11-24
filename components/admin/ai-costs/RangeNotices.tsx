import { formatCount } from "@/lib/admin/ai-costs/money";
import type { RangeView } from "@/lib/admin/ai-costs/view";
import { Notice } from "./primitives";

/** Says on screen whenever a bounded read stopped early, so a total is never silently partial. */
export function RangeNotices({ view }: { view: RangeView }) {
  return (
    <>
      {view.truncated ? (
        <Notice tone="warning">
          This range is cut off: the console reads at most {formatCount(view.rowCap)} calls per range and stopped
          {view.readUntilMs !== null ? ` at ${new Date(view.readUntilMs).toISOString().replace("T", " ").slice(0, 16)} UTC` : " early"}.
          Totals after that point are missing. Pick a shorter range; a daily rollup table (a Codex need) removes the limit.
        </Notice>
      ) : null}
      {view.ownersTruncated ? <Notice tone="warning">More founders were active than the console summarises; the founders table lists the biggest spenders first and some rows lack plan and budget details.</Notice> : null}
      {view.launchesTruncated ? <Notice tone="warning">More businesses were active than the console reads in full; launch statistics cover the first 200.</Notice> : null}
    </>
  );
}
