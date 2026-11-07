import { EYEBROW } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { isHexColour, PALETTE_ROLES, readableOn } from "@/lib/workspace/reviewPages";
import { TYPE_PAIRS } from "@/lib/workspace/contracts/artifacts";
import { ROLE_FILL, ROLE_VAR, type Kit } from "./brandTypes";

/**
 * The 3 x 3 brand board, drawn in the kit's own colours and heading font through the `--t-*` variables of the
 * enclosing scope (see BrandKitPanel). No inline styles. Text sits only on pairs that pass AA: ground/ink,
 * surface/ink, button pair, dark/dark-text, and black or white on a palette tile, chosen by contrast. Nothing
 * here is text on the secondary or accent fill: those tiles carry a ground chip. The accent is never text, so the
 * tagline emphasis is italic, not coloured.
 */

const HEADING = "font-(family-name:--t-font-heading) [font-weight:var(--t-hw)]";
const TILE = "relative overflow-hidden rounded-[4px] sm:aspect-square";

function PaletteTile({ kit, vars }: { kit: Kit; vars: Readonly<Record<string, string>> }) {
  return (
    <li className={cn(TILE, "grid grid-rows-[2fr_1fr_1fr_1fr_1fr]")}>
      {PALETTE_ROLES.map(([role, label]) => {
        const entry = kit.palette[role];
        const resolved = vars[ROLE_VAR[role]];
        const shown = isHexColour(entry.hex) && entry.hex.toLowerCase() === resolved;
        const read = shown ? readableOn(resolved) : null;
        return (
          <div
            key={role}
            className={cn(
              ROLE_FILL[role],
              "flex min-h-8 items-center justify-between gap-2 px-3 text-xs",
              read === null ? "text-transparent" : read.text === "black" ? "text-black" : "text-white",
            )}
          >
            {read !== null && read.ok ? (
              <>
                <b className="font-semibold">{entry.name}</b>
                <span className="font-mono">{entry.hex}</span>
              </>
            ) : (
              <span className="rounded-full bg-(--t-ground) px-2 py-0.5 text-(--t-ink)">
                {label}
                {shown ? <span className="font-mono"> {entry.hex}</span> : null}
              </span>
            )}
          </div>
        );
      })}
    </li>
  );
}

export function BrandBoard({ kit, vars }: { kit: Kit; vars: Readonly<Record<string, string>> }) {
  const pair = TYPE_PAIRS[kit.type.pair];
  const { tagline } = kit;
  const emphasised = tagline.emphasis !== undefined && tagline.text.endsWith(tagline.emphasis);
  const lead = emphasised ? tagline.text.slice(0, tagline.text.length - (tagline.emphasis?.length ?? 0)) : tagline.text;
  return (
    <section aria-labelledby="brand-board-h" className="flex flex-col gap-3">
      <h2 id="brand-board-h" className={EYEBROW}>
        Brand board
      </h2>
      <ul className="grid grid-cols-1 gap-2 rounded-[10px] bg-(--t-dark) p-2 min-[560px]:grid-cols-2 min-[900px]:grid-cols-3">
        <li className={cn(TILE, "flex min-h-40 flex-col items-center justify-center gap-3 bg-(--t-btn-bg) p-3 text-center text-(--t-btn-text)")}>
          <span className={cn(HEADING, "break-words text-[clamp(22px,3vw,34px)] leading-none tracking-[-0.01em]")}>{kit.name}</span>
          <span className="text-[11px] tracking-[0.2em]">WORDMARK</span>
        </li>
        <li className={cn(TILE, "grid min-h-40 grid-rows-3")}>
          <div className={cn(HEADING, "flex items-center justify-center border-b border-(--t-hairline) bg-(--t-ground) px-2 text-center text-xl text-(--t-ink)")}>
            <span className="break-words">{kit.name}</span>
          </div>
          <div className={cn(HEADING, "flex items-center justify-center border-b border-(--t-hairline) bg-(--t-surface) px-2 text-center text-xl text-(--t-ink)")}>
            <span className="break-words">{kit.name}</span>
          </div>
          <div className={cn(HEADING, "flex items-center justify-center bg-(--t-dark) px-2 text-center text-xl text-(--t-dark-text)")}>
            <span className="break-words">{kit.name}</span>
          </div>
        </li>
        <PaletteTile kit={kit} vars={vars} />
        <li className={cn(TILE, "flex min-h-40 flex-col justify-between gap-3 bg-(--t-ground) p-[18px] text-(--t-ink)")}>
          <span aria-hidden="true" className={cn(HEADING, "text-[clamp(64px,9vw,112px)] leading-[0.9] tracking-[-0.03em]")}>
            Aa
          </span>
          <span className="flex flex-col text-[13px]">
            <b className={cn(HEADING, "text-base")}>{pair.heading.family}</b>
            <span className="font-(family-name:--t-font-body)">{pair.body.family} for body and UI</span>
          </span>
        </li>
        <li className={cn(TILE, "min-h-40 bg-(--t-secondary)")}>
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-(--t-ground) px-2 py-0.5 text-[11px] text-(--t-ink)">
            Hero art · described below
          </span>
        </li>
        <li className={cn(TILE, "flex min-h-40 flex-col justify-between gap-3 bg-(--t-dark) p-[22px] text-(--t-dark-text)")}>
          <span className="text-[11px] tracking-[0.2em]">TAGLINE</span>
          <span className={cn(HEADING, "break-words text-[clamp(24px,3vw,40px)] leading-none tracking-[-0.02em]")}>
            {lead}
            {emphasised ? <em className="italic">{tagline.emphasis}</em> : null}
          </span>
        </li>
        {kit.productMoment === undefined ? null : (
          <li className={cn(TILE, "flex min-h-40 items-center justify-center bg-(--t-btn-bg) p-[18px]")}>
            <div className="flex w-full flex-col gap-0.5 rounded-[14px] bg-(--t-ground) p-3.5 text-[13px] leading-[1.35] text-(--t-ink) shadow-[0_14px_30px_-14px_rgb(0_0_0/0.6)]">
              <b className="font-semibold">{kit.productMoment.title}</b>
              <span>{kit.productMoment.body}</span>
            </div>
          </li>
        )}
        {kit.pattern === undefined ? null : (
          <li className={cn(TILE, "flex min-h-40 items-end bg-(--t-secondary) p-3")}>
            <span className="line-clamp-4 rounded-lg bg-(--t-ground) px-2.5 py-1.5 text-xs text-(--t-ink)">Pattern · {kit.pattern}</span>
          </li>
        )}
        <li className={cn(TILE, "flex min-h-40 flex-wrap content-center justify-center gap-1.5 bg-(--t-surface) p-4 text-(--t-ink)")}>
          {kit.voice.traits.map((trait, index) => (
            <span key={index} className="rounded-full border border-(--t-hairline) px-3 py-1 text-[13px]">
              {trait}
            </span>
          ))}
        </li>
      </ul>
    </section>
  );
}
