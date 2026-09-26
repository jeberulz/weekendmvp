"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { ModuleSkeleton, PersonalModule } from "@/components/platform/home/module-states";
import { CollectionView } from "@/components/platform/hub/CollectionView";
import { HubRow } from "@/components/platform/hub/HubRow";
import { compareHref } from "@/components/platform/hub/hub-links";
import { SavedToolbar } from "@/components/platform/hub/SavedToolbar";
import { useFeatureGate } from "@/components/platform/hub/useFeatureGate";
import { BUILDERS_HUB_UI } from "@/components/platform/plan/flag";
import { useUpsell } from "@/components/platform/plan/useUpsell";
import { cn } from "@/lib/utils";
import { IdeaRow } from "./IdeaCard";
import { IDEAS_PATH } from "./library-params";

type SavedItem = FunctionReturnType<typeof api.platform.dashboard.savedList>["items"][number];

const PAGE = 48;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function savedOn(ms: number) {
  const date = new Date(ms);
  return `Saved ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Rows removed on this page stay where they were, shown as unsaved, until the
 * member leaves. The row does not jump away under the pointer, its live
 * region can still announce the change, and Save on it undoes the removal.
 */
function useKeptRows(items: SavedItem[] | undefined) {
  const [state, setState] = useState<{ items: SavedItem[] | undefined; rows: SavedItem[] }>({
    items: undefined,
    rows: [],
  });
  if (items !== undefined && items !== state.items) {
    const live = new Set(items.map((item) => item.card.slug));
    const kept = state.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !live.has(row.card.slug));
    const rows = [...items];
    for (const { row, index } of kept) {
      rows.splice(Math.min(index, rows.length), 0, { ...row, card: { ...row.card, saved: false } });
    }
    setState({ items, rows });
  }
  return state.rows;
}

/** Compare mode (Builder's Hub): pick 2 to `max` rows, then open the side-by-side view. */
function CompareBar({ picked, max, onCancel }: { picked: string[]; max: number; onCancel: () => void }) {
  return (
    <div className="sticky bottom-24 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-home-ink bg-home-card px-4 py-3 shadow-[0_12px_32px_-16px_rgba(26,24,20,0.35)] lg:bottom-4">
      <p role="status" className="text-sm text-home-ink">
        {picked.length === 0 ? `Pick 2 to ${max} ideas to compare.` : `${picked.length} of ${max} picked.`}
      </p>
      <div className="flex gap-2">
        {picked.length >= 2 ? (
          <Link
            href={compareHref(picked)}
            className={cn(
              "inline-flex h-10 items-center rounded-[9px] bg-home-ink px-4 text-sm font-medium text-home-card hover:bg-home-panel",
              FOCUS,
            )}
          >
            Compare {picked.length} ideas
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className={cn("inline-flex h-10 items-center rounded-[9px] px-3 text-sm text-home-ink-2 hover:text-home-ink", FOCUS)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LiveSaved() {
  const [limit, setLimit] = useState(PAGE);
  const result = useQuery(api.platform.dashboard.savedList, { limit });
  const [shown, setShown] = useState(result);
  if (result !== undefined && result !== shown) setShown(result);
  const data = result ?? shown;
  const rows = useKeptRows(data?.items);
  // WP44-S11. Row tools only for Builder's Hub; the mutations check again.
  const { entitlements } = useUpsell();
  const hub = entitlements?.plan === "builders_hub";
  const gate = useFeatureGate();
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const compareMax = entitlements?.limits.compareMax ?? 0;

  if (data === undefined) return <ModuleSkeleton label="Loading your saved ideas" className="h-[320px]" />;
  const toolbar = BUILDERS_HUB_UI ? (
    <SavedToolbar
      currentCollection={null}
      compare={{
        active: comparing,
        onChange: (active) => {
          setComparing(active);
          if (!active) setPicked([]);
        },
      }}
    />
  ) : null;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <div className="rounded-[14px] border border-home-rule bg-home-card px-5 py-6">
          <p className="text-[15px] text-home-ink">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-home-ink-2">
            Tap Save on any idea and it lands here.{" "}
            <Link
              href={IDEAS_PATH}
              className={cn("font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink", FOCUS)}
            >
              Browse ideas
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const total = `${data.total}${data.capped ? "+" : ""}`;
  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      <p role="status" className="font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
        {total} saved {data.total === 1 && !data.capped ? "idea" : "ideas"}
      </p>
      <ul className="divide-y divide-home-rule border-y border-home-ink">
        {rows.map((item) => (
          <li key={item.card.ideaId}>
            {hub && item.card.saved ? (
              <HubRow
                item={item}
                source="saved"
                meta={savedOn(item.savedAt)}
                onUpgrade={(feature) => gate.openSheet(feature)}
                compare={
                  comparing
                    ? {
                        checked: picked.includes(item.card.slug),
                        disabled: !picked.includes(item.card.slug) && picked.length >= compareMax,
                        onChange: (checked) =>
                          setPicked((current) =>
                            checked ? [...current, item.card.slug] : current.filter((slug) => slug !== item.card.slug),
                          ),
                      }
                    : undefined
                }
              />
            ) : (
              <IdeaRow
                idea={item.card}
                source="saved"
                meta={item.card.saved ? savedOn(item.savedAt) : "Removed. Save it again to keep it."}
              />
            )}
          </li>
        ))}
      </ul>
      {comparing && (
        <CompareBar
          picked={picked}
          max={compareMax}
          onCancel={() => {
            setComparing(false);
            setPicked([]);
          }}
        />
      )}
      {gate.sheet}
      {data.items.length < data.total && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => setLimit(limit + PAGE)}
            disabled={result === undefined}
            className={cn(
              "inline-flex h-11 items-center rounded-[9px] border border-home-rule bg-home-card px-5 text-sm font-medium text-home-ink transition-colors hover:border-home-ink-3 disabled:cursor-wait disabled:opacity-60",
              FOCUS,
            )}
          >
            Show more saved ideas
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The Saved page list (WP44-S5): saved or interested ideas, newest first (R3).
 * With the Builder's Hub flag on, `collectionId` shows one collection (S11).
 */
export function SavedIdeas({ collectionId = null }: { collectionId?: string | null }) {
  if (BUILDERS_HUB_UI && collectionId) return <CollectionView collectionId={collectionId} />;
  return (
    <PersonalModule skeleton={<ModuleSkeleton label="Loading your saved ideas" className="h-[320px]" />}>
      <LiveSaved />
    </PersonalModule>
  );
}
