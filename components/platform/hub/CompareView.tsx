"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { Component, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { COMPARE_MIN } from "@/convex/platform/hubLimits";
import { PLANS } from "@/convex/platform/plans";
import { categoryName, toolName } from "@/components/ideas/idea-meta";
import { PlanLink } from "@/components/platform/builds/PlanLink";
import { WhenConvexReady } from "@/components/platform/client-gates";
import { SAVED_PATH } from "@/components/platform/explore/library-params";
import { ModuleError, ModuleSkeleton } from "@/components/platform/home/module-states";
import { BUILDERS_HUB_UI } from "@/components/platform/plan/flag";
import { GOAL_LABEL } from "@/lib/home/labels";
import type { Tier } from "@/lib/home/types";
import { cn } from "@/lib/utils";
import { isUpgradeRequired, useFeatureGate } from "./useFeatureGate";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const LINK = cn("font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink", FOCUS);
const CARD = "flex flex-col gap-3 rounded-[14px] border border-home-rule bg-home-card p-5 sm:p-6";

type Row = { label: string; cell: (idea: CompareIdea) => ReactNode };
type CompareIdea = NonNullable<ReturnType<typeof useCompare>>[number];

function useCompare(slugs: string[]) {
  return useQuery(api.platform.compare.ideas, { slugs });
}

function score(value: number | undefined) {
  return value === undefined ? "Not scored" : `${value}/10`;
}

function rowsFor(tiers: Record<string, Tier[]>): Row[] {
  return [
    { label: "Category", cell: (idea) => categoryName(idea.category) },
    { label: "Research score", cell: (idea) => (idea.score === null ? "Not scored" : `${idea.score}/10`) },
    { label: "Opportunity", cell: (idea) => score(idea.scores?.opportunity) },
    { label: "Pain", cell: (idea) => score(idea.scores?.pain) },
    { label: "Timing", cell: (idea) => score(idea.scores?.timing) },
    { label: "Builder confidence", cell: (idea) => score(idea.scores?.builder_confidence) },
    { label: "Build time", cell: (idea) => (idea.buildTime > 0 ? `${idea.buildTime} hours` : "Not listed") },
    {
      label: "Tools",
      cell: (idea) => (idea.tools.length > 0 ? idea.tools.map(toolName).join(", ") : "None listed"),
    },
    { label: "Revenue goal", cell: (idea) => GOAL_LABEL[idea.revenueGoal] ?? idea.revenueGoal },
    {
      label: "Pricing",
      cell: (idea) => {
        const list = tiers[idea.slug] ?? [];
        if (list.length === 0) return "Not listed";
        return (
          <ul className="flex flex-col gap-0.5">
            {list.map((tier) => (
              <li key={tier.name}>
                {tier.name}: {tier.price}
              </li>
            ))}
          </ul>
        );
      },
    },
  ];
}

function LiveCompare({ slugs, tiers }: { slugs: string[]; tiers: Record<string, Tier[]> }) {
  const ideas = useCompare(slugs);
  if (ideas === undefined) return <ModuleSkeleton label="Loading the comparison" className="h-[480px]" />;
  const rows = rowsFor(tiers);
  return (
    // Four columns do not fit a phone, so the table scrolls sideways in a
    // focusable, named region that keyboards can reach. `relative` keeps the
    // table's screen-reader text inside the scroll box, not widening the page.
    <div
      role="region"
      aria-label="Comparison table"
      tabIndex={0}
      className={cn("relative overflow-x-auto rounded-[14px] border border-home-rule bg-home-card", FOCUS)}
    >
      <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">
          {ideas.length} ideas side by side: scores, build time, tools, revenue goal and pricing
        </caption>
        <thead>
          <tr className="border-b border-home-ink">
            <td className="w-[150px] px-3 py-3" />
            {ideas.map((idea) => (
              <th key={idea.slug} scope="col" className="px-3 py-3 align-bottom font-normal">
                <Link
                  href={`/ideas/${idea.slug}`}
                  className={cn(
                    "font-editorial text-[18px] leading-tight text-home-ink underline-offset-4 hover:text-home-orange-ink hover:underline",
                    FOCUS,
                  )}
                >
                  {idea.title}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-home-rule align-top">
              <th scope="row" className="px-3 py-3 font-medium text-home-ink">
                {row.label}
              </th>
              {ideas.map((idea) => (
                <td key={idea.slug} className="px-3 py-3 text-home-ink-2">
                  {row.cell(idea)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="align-top">
            <th scope="row" className="px-3 py-3 font-medium text-home-ink">
              Next step
            </th>
            {ideas.map((idea) => (
              <td key={idea.slug} className="px-2 py-2">
                <PlanLink slug={idea.slug} title={idea.title} source="saved" variant="text" />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Locked() {
  const gate = useFeatureGate();
  return (
    <div className={CARD}>
      <h2 className="font-editorial text-[26px] font-normal text-home-ink">
        Compare is part of {PLANS.builders_hub.name}.
      </h2>
      <p className="text-[15px] text-home-ink-2">Every idea page stays free to read, one at a time.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(event) => gate.openSheet("compare", event.currentTarget)}
          className={cn(
            "inline-flex h-11 items-center rounded-[9px] bg-home-ink px-4 text-sm font-medium text-home-card hover:bg-home-panel",
            FOCUS,
          )}
        >
          See what {PLANS.builders_hub.name} adds
        </button>
        <Link href={SAVED_PATH} className={cn("inline-flex h-11 items-center px-3 text-sm", LINK)}>
          Back to Saved
        </Link>
      </div>
      {gate.sheet}
    </div>
  );
}

class CompareBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // The server refused: the Free way forward is the sheet, or Saved.
    if (isUpgradeRequired(error)) return <Locked />;
    const code = (error as { data?: { code?: string } }).data?.code;
    if (code === "COMPARE_SIZE") return <PickMore />;
    return <ModuleError onRetry={() => this.setState({ error: null })} />;
  }
}

function PickMore() {
  return (
    <div className={CARD}>
      <h2 className="font-editorial text-[26px] font-normal text-home-ink">Pick 2 to 4 ideas to compare.</h2>
      <p className="text-[15px] text-home-ink-2">
        Use Compare on your{" "}
        <Link href={SAVED_PATH} className={LINK}>
          Saved
        </Link>{" "}
        page, then tick the ideas you want side by side.
      </p>
    </div>
  );
}

/** Compare view (Builder's Hub, WP44-S11). Flag on only. */
export function CompareView({ slugs, tiers }: { slugs: string[]; tiers: Record<string, Tier[]> }) {
  if (!BUILDERS_HUB_UI) {
    return (
      <div className={CARD}>
        <p className="text-[15px] text-home-ink-2">Compare is not available yet.</p>
      </div>
    );
  }
  if (slugs.length < COMPARE_MIN) return <PickMore />;
  const skeleton = <ModuleSkeleton label="Loading the comparison" className="h-[480px]" />;
  return (
    <WhenConvexReady fallback={skeleton} unavailable={<ModuleError />}>
      <CompareBoundary>
        <LiveCompare slugs={slugs} tiers={tiers} />
      </CompareBoundary>
    </WhenConvexReady>
  );
}
