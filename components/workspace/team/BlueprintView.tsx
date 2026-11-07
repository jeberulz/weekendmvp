"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { QuietErrorBoundary } from "@/components/platform/client-gates";
import { EmptyState, ErrorState, LoadingState } from "@/components/workspace/kit/states";
import { CARD, EYEBROW } from "@/components/workspace/kit/styles";
import { LiveArtifactReview } from "@/components/workspace/review/LiveArtifactReview";
import { NOT_VALIDATED_LABEL, NOT_VALIDATED_MEANING } from "@/lib/workspace/wizard/light-blueprint";
import {
  BLUEPRINT_ARTIFACT,
  BLUEPRINT_LABELS,
  BLUEPRINT_NONE_COPY,
  BLUEPRINT_SECTION_ID,
  BLUEPRINT_UNAVAILABLE_COPY,
} from "@/lib/workspace/reviewPages";

type BlueprintView = FunctionReturnType<typeof api.growth.drafts.blueprint.blueprintDraft>;
type ReadyView = Extract<BlueprintView, { state: "ready" }>;

/**
 * L1-C6: the read-only "Your blueprint" section on Team HQ, then its review
 * card. An own idea is not researched (`blueprintIsValidated` is true only for a
 * library idea), so it carries the "Not yet validated" label in words.
 * Server text is always a React text node.
 */

function Block({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={EYEBROW}>{term}</dt>
      <dd className="text-sm text-home-ink">{children}</dd>
    </div>
  );
}

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function Ready({ projectId, view }: { projectId: Id<"projects">; view: ReadyView }) {
  const { blueprint } = view;
  return (
    <div className="flex flex-col gap-4">
      <div className={`${CARD} flex flex-col gap-3 p-4`}>
        {blueprint.validated ? null : (
          <div className="flex flex-col gap-1.5">
            <p className="inline-flex w-fit items-center rounded-full border border-home-ochre-ink/40 bg-home-ochre px-2.5 py-0.5 text-[12px] font-medium text-home-ochre-ink">
              {NOT_VALIDATED_LABEL}
            </p>
            <p className="text-sm text-home-ink-2">{NOT_VALIDATED_MEANING}</p>
          </div>
        )}
        <p className="font-editorial text-xl text-home-ink">{blueprint.pitch}</p>
        <dl className="flex flex-col gap-3">
          <Block term={BLUEPRINT_LABELS.oneUser}>{blueprint.oneUser}</Block>
          <Block term={BLUEPRINT_LABELS.oneLoop}>{blueprint.oneLoop}</Block>
          <Block term={BLUEPRINT_LABELS.features}>
            <List items={blueprint.features} />
          </Block>
          <Block term={BLUEPRINT_LABELS.scopeCuts}>
            <List items={blueprint.scopeCuts} />
          </Block>
          {blueprint.market === undefined ? null : (
            <>
              <Block term={BLUEPRINT_LABELS.market}>{blueprint.market.summary}</Block>
              {blueprint.market.competitors.length === 0 ? null : (
                <Block term={BLUEPRINT_LABELS.competitors}>
                  <ul className="list-disc pl-5">
                    {blueprint.market.competitors.map((competitor, index) => (
                      <li key={index}>
                        {competitor.name}: {competitor.note}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}
            </>
          )}
        </dl>
      </div>
      {view.card === null ? null : <LiveArtifactReview projectId={projectId} card={view.card} artifact={BLUEPRINT_ARTIFACT} />}
    </div>
  );
}

function Body({ projectId, view }: { projectId: Id<"projects">; view: BlueprintView }) {
  if (view.state === "none") return <EmptyState>{BLUEPRINT_NONE_COPY}</EmptyState>;
  if (view.state === "unavailable") return <EmptyState>{BLUEPRINT_UNAVAILABLE_COPY}</EmptyState>;
  return <Ready projectId={projectId} view={view} />;
}

function Live({ projectId }: { projectId: Id<"projects"> }) {
  const view = useQuery(api.growth.drafts.blueprint.blueprintDraft, { projectId });
  if (view === undefined) return <LoadingState label="Loading your blueprint…" />;
  return <Body projectId={projectId} view={view} />;
}

export function BlueprintView({ projectId }: { projectId: Id<"projects"> }) {
  return (
    <section
      id={BLUEPRINT_SECTION_ID}
      aria-labelledby="your-blueprint"
      tabIndex={-1}
      className="flex scroll-mt-6 flex-col gap-3 focus:outline-2 focus:outline-offset-2 focus:outline-home-orange-ink"
    >
      <h2 id="your-blueprint" className="text-lg font-medium text-home-ink">Your blueprint</h2>
      <QuietErrorBoundary
        fallback={<ErrorState message="Your blueprint couldn't load right now. Reload the page to try again." />}
      >
        <Live projectId={projectId} />
      </QuietErrorBoundary>
    </section>
  );
}
