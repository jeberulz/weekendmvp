"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary, WhenConvexReady } from "@/components/platform/client-gates";
import type { TenantFontPair } from "@/components/tenant-site/fonts";
import { tenantStyle } from "@/components/tenant-site/styles";
import { deriveTheme } from "@/components/tenant-site/theme";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { LiveArtifactReview } from "@/components/workspace/review/LiveArtifactReview";
import { TYPE_PAIRS, type BrandKit, type TypePairId } from "@/lib/workspace/contracts/artifacts";
import { cn } from "@/lib/utils";
import { BRAND_ARTIFACT, BRAND_NONE_COPY, BRAND_UNAVAILABLE_COPY, changeRoundNote } from "@/lib/workspace/reviewPages";
import { BrandBook } from "./BrandBook";
import { BrandBoard } from "./BrandBoard";
import type { BrandKitView, Kit } from "./brandTypes";

/**
 * L1 Brand kit page body: the review first (the decision), then the brand board, then the Brand Book.
 *
 * Drawing the kit's colours and fonts follows the tenant site's checked pattern exactly (`TenantSite.tsx`):
 * `deriveTheme` AA-checks every pair, `tenantStyle` validates each value against a strict allow-list and emits one
 * `<style>` rule of `--t-*` custom properties under a hashed scope class, and the board reads them through
 * Tailwind variable utilities. There is no `style=` attribute anywhere. Everything else from the server is a
 * React text node. Headings: the page h1 (server), then h2 for the review, board and Brand Book, h3 for cards.
 *
 * The font map arrives as a prop from the server page. `components/tenant-site/fonts.ts` calls next/font loaders,
 * which may only run in server modules: importing it here broke the Turbopack dev bundle. The map is plain strings
 * (class names and font-family stacks), so it serialises across the boundary; only the type is imported here.
 */

export type TenantFontMap = Readonly<Record<TypePairId, TenantFontPair>>;

function KitScope({ kit, fonts, children }: { kit: Kit; fonts: TenantFontMap; children: (vars: Readonly<Record<string, string>>) => React.ReactNode }) {
  // The view has no `schemaVersion`; the schema's literal 1 is added so the theme derivation accepts it.
  const theme = deriveTheme({ schemaVersion: 1, ...kit } as BrandKit);
  const pairId = kit.type.pair;
  const style = tenantStyle(theme, fonts[pairId], TYPE_PAIRS[pairId].heading.defaultWeight, false);
  return (
    <div className={cn(fonts[pairId].classNames, style.scope, "flex min-w-0 flex-col gap-8")}>
      <style>{style.css}</style>
      {children(theme.vars)}
    </div>
  );
}

function BrandKitReady({ projectId, view, fonts }: { projectId: Id<"projects">; view: Extract<BrandKitView, { state: "ready" }>; fonts: TenantFontMap }) {
  const round = changeRoundNote(Number(view.card?.changeRound ?? 0));
  return (
    <div className="flex min-w-0 flex-col gap-8">
      {round === null ? null : <p className="text-[13px] text-home-ink-3">{round}</p>}
      {view.card === null ? null : (
        <div className="max-w-[560px]">
          <LiveArtifactReview projectId={projectId} card={view.card} artifact={BRAND_ARTIFACT} headingLevel={2} />
        </div>
      )}
      <KitScope kit={view.kit} fonts={fonts}>
        {(vars) => (
          <>
            <BrandBoard kit={view.kit} vars={vars} />
            <BrandBook kit={view.kit} />
          </>
        )}
      </KitScope>
    </div>
  );
}

function BrandKitBody({ projectId, view, fonts }: { projectId: Id<"projects">; view: BrandKitView; fonts: TenantFontMap }) {
  if (view.state === "none") return <EmptyState>{BRAND_NONE_COPY}</EmptyState>;
  if (view.state === "unavailable") return <EmptyState>{BRAND_UNAVAILABLE_COPY}</EmptyState>;
  return <BrandKitReady projectId={projectId} view={view} fonts={fonts} />;
}

function LiveBrandKit({ projectId, fonts }: { projectId: Id<"projects">; fonts: TenantFontMap }) {
  const view = useQuery(api.growth.drafts.brandKit.brandKitDraft, { projectId });
  if (view === undefined) return <LoadingState label="Loading your brand kit…" />;
  return <BrandKitBody projectId={projectId} view={view} fonts={fonts} />;
}

export function BrandKitPanel({ projectId, fonts }: { projectId: Id<"projects">; fonts: TenantFontMap }) {
  const failed = <ErrorState message="Your brand kit couldn't load right now. Reload the page to try again." />;
  return (
    <WhenConvexReady fallback={<LoadingState label="Loading your brand kit…" />} unavailable={failed}>
      <QuietErrorBoundary fallback={failed}>
        <LiveBrandKit projectId={projectId} fonts={fonts} />
      </QuietErrorBoundary>
    </WhenConvexReady>
  );
}
