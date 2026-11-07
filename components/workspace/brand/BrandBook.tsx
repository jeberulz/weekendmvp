import type { ReactNode } from "react";
import { CARD, EYEBROW } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import {
  BRAND_IMAGES_COPY,
  DENSITY_LABELS,
  directionLabel,
  directionSummary,
  isHexColour,
  PALETTE_ROLES,
  SHAPE_LABELS,
  THEME_LABELS,
  typePairLabel,
} from "@/lib/workspace/reviewPages";
import { ROLE_FILL, type Kit } from "./brandTypes";

/** The Brand Book: colour cards, the type specimen, voice chips, and the look and logo notes. Uses the enclosing kit scope. */

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={EYEBROW}>{term}</dt>
      <dd className="text-sm text-home-ink">{children}</dd>
    </div>
  );
}

function ColourCards({ palette }: { palette: Kit["palette"] }) {
  return (
    <ul aria-label="Colours" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
      {PALETTE_ROLES.map(([role, label]) => {
        const colour = palette[role];
        return (
          <li key={role} className="overflow-hidden rounded-lg border border-home-rule bg-home-card">
            <div
              aria-hidden="true"
              className={cn("h-[88px] border-b border-home-rule", isHexColour(colour.hex) ? ROLE_FILL[role] : "border-dashed bg-home-card")}
            />
            <div className="flex flex-col gap-0.5 p-3">
              <span className={EYEBROW}>{label}</span>
              <span className="break-words font-semibold text-home-ink">{colour.name}</span>
              <span className="break-all font-mono text-[13px] text-home-ink">{colour.hex}</span>
              <span className="text-[13px] text-home-ink-2">{colour.use}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function BrandBook({ kit }: { kit: Kit }) {
  const card = cn(CARD, "flex min-w-0 flex-col rounded-lg p-5");
  return (
    <section aria-labelledby="brand-book-h" className="flex flex-col gap-6 border-t border-home-rule pt-7">
      <div>
        <p className={EYEBROW}>Brand Book</p>
        <h2 id="brand-book-h" className="mt-1.5 font-editorial text-[28px] font-normal leading-[1.15] text-home-ink sm:text-[32px]">
          The rules your team follows <em className="italic">for every draft.</em>
        </h2>
      </div>
      <ColourCards palette={kit.palette} />
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
        <section className={cn(card, "gap-2.5")}>
          <h3 className={EYEBROW}>Type pairing</h3>
          <p className="break-words font-(family-name:--t-font-heading) text-[34px] leading-none text-home-ink [font-weight:var(--t-hw)]">
            {kit.tagline.text}
          </p>
          <p className="text-sm text-home-ink">{typePairLabel(kit.type.pair)}</p>
          <p className="text-sm text-home-ink-2">{kit.type.notes}</p>
          <p className="font-mono text-[13px] text-home-ink-2">{kit.type.scale}</p>
        </section>
        <section className={cn(card, "gap-3")}>
          <h3 className={EYEBROW}>Voice</h3>
          <ul aria-label="Voice traits" className="flex flex-wrap gap-1.5">
            {kit.voice.traits.map((trait, index) => (
              <li key={index} className="rounded-full bg-home-sky px-3 py-1 text-[13px] text-home-sky-ink">
                {trait}
              </li>
            ))}
          </ul>
          <p className="text-sm text-home-ink">
            <b className="font-semibold">Say:</b> “{kit.voice.say}”
          </p>
          <p className="text-sm text-home-ink">
            <b className="font-semibold">Don&apos;t say:</b> “{kit.voice.dontSay}”
            <span className="block text-home-ink-2">{kit.voice.dontSayWhy}</span>
          </p>
        </section>
      </div>
      <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
        <section className={cn(card, "gap-3")}>
          <h3 className={EYEBROW}>Look</h3>
          <dl className="flex flex-col gap-3">
            <Fact term="Direction">
              {directionLabel(kit.visualSystem.direction)}. {directionSummary(kit.visualSystem.direction)}
            </Fact>
            <Fact term="Shape and spacing">
              {SHAPE_LABELS[kit.visualSystem.shape]}, {DENSITY_LABELS[kit.visualSystem.density].toLowerCase()}
            </Fact>
            <Fact term="Theme">
              {THEME_LABELS[kit.visualSystem.theme.mode]}. {kit.visualSystem.theme.reason}
            </Fact>
          </dl>
        </section>
        <section className={cn(card, "gap-3")}>
          <h3 className={EYEBROW}>Logo and hero art</h3>
          <p className="text-sm text-home-ink-2">{BRAND_IMAGES_COPY}</p>
          <dl className="flex flex-col gap-3">
            <Fact term="Logo idea">{kit.logo.markDescription}</Fact>
            <Fact term="Hero art idea">{kit.heroArt.description}</Fact>
            {kit.pattern === undefined ? null : <Fact term="Pattern">{kit.pattern}</Fact>}
            {kit.productMoment === undefined ? null : (
              <Fact term="Product moment">
                {kit.productMoment.title}. {kit.productMoment.body}
              </Fact>
            )}
          </dl>
        </section>
      </div>
      {kit.nameAlternatives.length === 0 ? null : (
        <p className="text-[13px] text-home-ink-2">Other names your team considered: {kit.nameAlternatives.join(", ")}.</p>
      )}
    </section>
  );
}
