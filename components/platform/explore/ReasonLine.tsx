import { reasonText, type PickReason } from "@/convex/platform/setupOptions";

/**
 * WP44-S8. Why an idea is in For you, in one short line. Renders nothing
 * without a reason: a card never shows an invented one (PRD 6.2).
 */
export function ReasonLine({ reason }: { reason?: PickReason }) {
  if (!reason) return null;
  return (
    <p className="flex items-center gap-1.5 text-[12px] leading-snug text-home-ink-2">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-home-orange" />
      {reasonText(reason)}
    </p>
  );
}
