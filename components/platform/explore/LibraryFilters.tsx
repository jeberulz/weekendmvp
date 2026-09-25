"use client";

import { Check, ChevronDown, LayoutGrid, List, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { categoryName, normalizeCategorySlug, toolName } from "@/components/ideas/idea-meta";
import { GOAL_LABEL } from "@/lib/home/labels";
import { cn } from "@/lib/utils";
import { HOURS_BUCKETS, type HoursBucket } from "@/convex/platform/libraryFilters";
import { HOURS_LABEL, SORT_LABEL, type LibraryParams } from "./library-params";
import type { LibraryLayout } from "./layout-pref";

type Facet = { value: string; count: number };
export type LibraryFacets = { category: Facet[]; tools: Facet[]; hours: Facet[]; goal: Facet[] };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const CONTROL = cn(
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-home-rule bg-home-card pl-3 pr-8 text-sm text-home-ink transition-colors hover:border-home-ink-3",
  FOCUS,
);
const ITEM =
  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-home-ink outline-none data-[highlighted]:bg-home-sunk data-[highlighted]:shadow-[inset_0_0_0_2px_var(--color-home-orange-ink)]";

/** Keeps the picked value listed even when the other filters leave it at zero. */
function withSelected(facets: Facet[], selected: string | undefined): Facet[] {
  if (!selected || facets.some((facet) => facet.value === selected)) return facets;
  return [...facets, { value: selected, count: 0 }];
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, "appearance-none")}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-home-ink-3" />
    </label>
  );
}

function ToolsMenu({ params, facets, onChange }: { params: LibraryParams; facets: Facet[]; onChange: (tools: string[]) => void }) {
  const picked = params.tools;
  const options = picked.reduce((list, tool) => withSelected(list, tool), facets);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={cn(CONTROL, "relative")}>
          Tools
          {picked.length > 0 && (
            <>
              <span aria-hidden>·</span>
              {picked.length}
              <span className="sr-only"> selected</span>
            </>
          )}
          <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-home-ink-3" />
        </button>
      </DropdownMenu.Trigger>
      {/* No portal: the menu stays inside `main`, so its content sits in a landmark. */}
      <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] min-w-60 overflow-y-auto rounded-xl border border-home-rule bg-home-card p-1.5 font-sans text-home-ink shadow-[0_16px_40px_-16px_rgba(26,24,20,0.35)]"
        >
          <DropdownMenu.Label className="px-3 pb-1 pt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-home-ink-3">
            Built with any of
          </DropdownMenu.Label>
          {options.map(({ value, count }) => {
            const checked = picked.includes(value);
            return (
              <DropdownMenu.CheckboxItem
                key={value}
                checked={checked}
                // Keep the menu open so several tools can be picked in a row.
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(next) =>
                  onChange(next ? [...picked, value] : picked.filter((tool) => tool !== value))
                }
                className={ITEM}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    checked ? "border-home-ink bg-home-ink text-home-card" : "border-home-ink-3",
                  )}
                >
                  {checked && <Check className="size-3" strokeWidth={2.5} />}
                </span>
                {toolName(value)}
                <span className="ml-auto pl-4 font-mono text-xs text-home-ink-3">{count}</span>
              </DropdownMenu.CheckboxItem>
            );
          })}
          {picked.length > 0 && (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-home-rule" />
              <DropdownMenu.Item className={ITEM} onSelect={() => onChange([])}>
                Clear tools
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function LayoutToggle({ layout, onChange }: { layout: LibraryLayout; onChange: (layout: LibraryLayout) => void }) {
  const option = (value: LibraryLayout, label: string, icon: ReactNode) => (
    <button
      type="button"
      aria-pressed={layout === value}
      onClick={() => onChange(value)}
      className={cn(
        "flex size-10 items-center justify-center rounded-md text-home-ink-2 transition-colors hover:text-home-ink",
        FOCUS,
        layout === value && "bg-home-card text-home-ink shadow-[0_0_0_1px_var(--color-home-rule)]",
      )}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
  return (
    <div role="group" aria-label="Layout" className="flex rounded-lg bg-home-sunk p-0.5">
      {option("grid", "Grid", <LayoutGrid aria-hidden className="size-4" />)}
      {option("list", "List", <List aria-hidden className="size-4" />)}
    </div>
  );
}

/** Filters, sort and layout. Every change goes to the URL (PRD FR-8). */
export function LibraryFilters({
  params,
  facets,
  onChange,
  layout,
  onLayout,
}: {
  params: LibraryParams;
  facets: LibraryFacets;
  onChange: (patch: Partial<LibraryParams>) => void;
  layout: LibraryLayout;
  onLayout: (layout: LibraryLayout) => void;
}) {
  const hoursCount = new Map(facets.hours.map((facet) => [facet.value, facet.count]));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        label="Category"
        value={params.category ?? ""}
        onChange={(value) => onChange({ category: value || undefined })}
      >
        <option value="">All categories</option>
        {withSelected(facets.category, params.category).map(({ value, count }) => (
          <option key={value} value={value}>
            {categoryName(normalizeCategorySlug(value))} ({count})
          </option>
        ))}
      </Select>
      <ToolsMenu params={params} facets={facets.tools} onChange={(tools) => onChange({ tools })} />
      <Select
        label="Build time"
        value={params.hours ?? ""}
        onChange={(value) => onChange({ hours: (value || undefined) as HoursBucket | undefined })}
      >
        <option value="">Any build time</option>
        {HOURS_BUCKETS.map((bucket) => {
          const count = hoursCount.get(bucket) ?? 0;
          return (
            <option key={bucket} value={bucket} disabled={count === 0 && params.hours !== bucket}>
              {HOURS_LABEL[bucket]} ({count})
            </option>
          );
        })}
      </Select>
      <Select
        label="Revenue goal"
        value={params.goal ?? ""}
        onChange={(value) => onChange({ goal: value || undefined })}
      >
        <option value="">Any revenue goal</option>
        {withSelected(facets.goal, params.goal).map(({ value, count }) => (
          <option key={value} value={value}>
            {GOAL_LABEL[value] ?? value} goal ({count})
          </option>
        ))}
      </Select>
      <div className="ml-auto flex items-center gap-2">
        {params.view === "all" && (
          <Select
            label="Sort"
            value={params.sort ?? (params.q ? "relevance" : "newest")}
            onChange={(value) => onChange({ sort: value as LibraryParams["sort"] })}
          >
            {params.q && <option value="relevance">{SORT_LABEL.relevance}</option>}
            <option value="newest">{SORT_LABEL.newest}</option>
            <option value="score">{SORT_LABEL.score}</option>
          </Select>
        )}
        <LayoutToggle layout={layout} onChange={onLayout} />
      </div>
    </div>
  );
}

/** Removable chips for the active search and filters. */
export function ActiveFilters({
  params,
  onChange,
}: {
  params: LibraryParams;
  onChange: (patch: Partial<LibraryParams>) => void;
}) {
  const chips: { key: string; label: string; remove: Partial<LibraryParams> }[] = [];
  if (params.q) chips.push({ key: "q", label: `“${params.q}”`, remove: { q: "", sort: undefined } });
  if (params.category) {
    chips.push({ key: "category", label: categoryName(normalizeCategorySlug(params.category)), remove: { category: undefined } });
  }
  for (const tool of params.tools) {
    chips.push({ key: `tool-${tool}`, label: toolName(tool), remove: { tools: params.tools.filter((t) => t !== tool) } });
  }
  if (params.hours) chips.push({ key: "hours", label: HOURS_LABEL[params.hours], remove: { hours: undefined } });
  if (params.goal) chips.push({ key: "goal", label: `${GOAL_LABEL[params.goal] ?? params.goal} goal`, remove: { goal: undefined } });
  if (chips.length === 0) return null;

  return (
    <ul aria-label="Active filters" className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onChange(chip.remove)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border border-home-ink bg-home-card pl-3 pr-2 text-[13px] text-home-ink transition-colors hover:bg-home-sunk",
              FOCUS,
            )}
          >
            {chip.label}
            <X aria-hidden className="size-3.5" />
            <span className="sr-only">, remove filter</span>
          </button>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <button
            type="button"
            onClick={() => onChange({ q: "", category: undefined, tools: [], hours: undefined, goal: undefined, sort: undefined })}
            className={cn("h-8 rounded px-2 text-[13px] font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink", FOCUS)}
          >
            Clear all
          </button>
        </li>
      )}
    </ul>
  );
}
