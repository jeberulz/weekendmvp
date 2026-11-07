"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { CARD, EYEBROW } from "@/components/workspace/kit/styles";
import { cn } from "@/lib/utils";
import { LiveArtifactReview } from "@/components/workspace/review/LiveArtifactReview";
import {
  BRAND_ARTIFACT,
  BRAND_IMAGES_COPY,
  BRAND_NONE_COPY,
  BRAND_UNAVAILABLE_COPY,
  DENSITY_LABELS,
  directionLabel,
  directionSummary,
  isHexColour,
  SHAPE_LABELS,
  THEME_LABELS,
  typePairLabel,
} from "@/lib/workspace/reviewPages";

type BrandKitView = FunctionReturnType<typeof api.growth.drafts.brandKit.brandKitDraft>;
type ReadyView = Extract<BrandKitView, { state: "ready" }>;
type Kit = ReadyView["kit"];

/**
 * L1-C1: the Brand kit page. The kit is read-only text, then the review card.
 *
 * Accessibility and rules:
 * - the route is the h1; each part of the kit is an h2 in the page order;
 * - every colour shows its name, hex and use as text. The swatch is an
 *   `aria-hidden` SVG next to that text, so colour is never the only signal;
 * - the swatch fill is an SVG presentation attribute, not a style attribute,
 *   and is drawn only from a checked `#RRGGBB` string (the model wrote it);
 * - everything from the server is a React text node, never HTML;
 * - image generation is not built, so logo and hero art are words only.
 */

const PALETTE_ROLES = [
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["accent", "Accent"],
  ["ground", "Ground"],
  ["ink", "Ink"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn(CARD, "flex flex-col gap-2 p-4")}>
      <h2 className="text-base font-medium text-home-ink">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={EYEBROW}>{term}</dt>
      <dd className="text-sm text-home-ink">{children}</dd>
    </div>
  );
}

function Swatch({ hex }: { hex: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 40 40" className="size-10 shrink-0 rounded-lg border border-home-rule">
      <rect width="40" height="40" fill={isHexColour(hex) ? hex : "none"} />
    </svg>
  );
}

function Palette({ palette }: { palette: Kit["palette"] }) {
  return (
    <Section title="Colours">
      <ul className="flex flex-col gap-3">
        {PALETTE_ROLES.map(([role, label]) => {
          const colour = palette[role];
          return (
            <li key={role} className="flex items-start gap-3">
              <Swatch hex={colour.hex} />
              <dl className="flex flex-col gap-0.5 text-sm">
                <dt className="sr-only">{label} colour</dt>
                <dd className="font-medium text-home-ink">
                  {label}: {colour.name}
                  <span className="font-mono font-normal text-home-ink-2"> {colour.hex}</span>
                </dd>
                <dt className="sr-only">Used for</dt>
                <dd className="text-home-ink-2">{colour.use}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function KitBody({ kit }: { kit: Kit }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="Name and tagline">
        <p className="font-editorial text-2xl text-home-ink">{kit.name}</p>
        {kit.nameAlternatives.length === 0 ? null : (
          <div className="flex flex-col gap-1">
            <h3 className={EYEBROW}>Other names your team considered</h3>
            <ul className="list-disc pl-5 text-sm text-home-ink-2">
              {kit.nameAlternatives.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm text-home-ink">
          <span className={EYEBROW}>Tagline </span>
          {kit.tagline.text}
        </p>
      </Section>
      <Palette palette={kit.palette} />
      <Section title="Look and type">
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
          <Fact term="Fonts">{typePairLabel(kit.type.pair)}</Fact>
          <Fact term="Type scale">{kit.type.scale}</Fact>
          <Fact term="Type notes">{kit.type.notes}</Fact>
        </dl>
      </Section>
      <Section title="Voice">
        <dl className="flex flex-col gap-3">
          <Fact term="Traits">{kit.voice.traits.join(", ")}</Fact>
          <Fact term="Say">{kit.voice.say}</Fact>
          <Fact term="Don't say">{kit.voice.dontSay}</Fact>
          <Fact term="Why not">{kit.voice.dontSayWhy}</Fact>
        </dl>
      </Section>
      <Section title="Logo and hero art">
        <p className="text-sm text-home-ink-2">{BRAND_IMAGES_COPY}</p>
        <dl className="flex flex-col gap-3">
          <Fact term="Logo idea">{kit.logo.markDescription}</Fact>
          <Fact term="Hero art idea">{kit.heroArt.description}</Fact>
        </dl>
      </Section>
      {kit.pattern === undefined && kit.productMoment === undefined ? null : (
        <Section title="Pattern and product moment">
          <dl className="flex flex-col gap-3">
            {kit.pattern === undefined ? null : <Fact term="Pattern">{kit.pattern}</Fact>}
            {kit.productMoment === undefined ? null : (
              <Fact term="Product moment">
                {kit.productMoment.title}. {kit.productMoment.body}
              </Fact>
            )}
          </dl>
        </Section>
      )}
    </div>
  );
}

function BrandKitView({ projectId, view }: { projectId: Id<"projects">; view: BrandKitView }) {
  if (view.state === "none") return <EmptyState>{BRAND_NONE_COPY}</EmptyState>;
  if (view.state === "unavailable") return <EmptyState>{BRAND_UNAVAILABLE_COPY}</EmptyState>;
  return (
    <div className="flex flex-col gap-4">
      <KitBody kit={view.kit} />
      {view.card === null ? null : <LiveArtifactReview projectId={projectId} card={view.card} artifact={BRAND_ARTIFACT} headingLevel={2} />}
    </div>
  );
}

function LiveBrandKit({ projectId }: { projectId: Id<"projects"> }) {
  const view = useQuery(api.growth.drafts.brandKit.brandKitDraft, { projectId });
  if (view === undefined) return <LoadingState label="Loading your brand kit…" />;
  return <BrandKitView projectId={projectId} view={view} />;
}

export function BrandKitPanel({ projectId }: { projectId: Id<"projects"> }) {
  const failed = <ErrorState message="Your brand kit couldn't load right now. Reload the page to try again." />;
  return (
    <WhenConvexReady fallback={<LoadingState label="Loading your brand kit…" />} unavailable={failed}>
      <QuietErrorBoundary fallback={failed}>
        <LiveBrandKit projectId={projectId} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
