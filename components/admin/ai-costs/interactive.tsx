"use client";

import { Download } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { forecast, type ForecastUnits } from "@/lib/admin/ai-costs/forecast";
import { formatCount, formatPercent, formatUsd } from "@/lib/admin/ai-costs/money";
import { MODEL_LABELS, WHAT_IF_MODELS, type WhatIfPrompt } from "@/lib/admin/ai-costs/whatif";
import type { PromptModel } from "@/lib/workspace/contracts/prompts";
import { cn } from "@/lib/utils";

export const controlClass =
  "min-h-10 rounded-md border border-(--ed-input) bg-(--ed-surface) px-2 text-sm outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)";
export const buttonClass =
  "inline-flex min-h-10 items-center gap-1.5 rounded-md border border-(--ed-input) bg-(--ed-surface) px-3 text-sm font-medium hover:bg-(--ed-sunk) outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)";

/** Downloads a CSV the server already built. Nothing leaves the browser. */
export function CsvButton({ filename, csv, label }: { filename: string; csv: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
          setDone(true);
        }}
      >
        <Download aria-hidden="true" className="size-4" />
        {label}
      </button>
      <span role="status" className="text-xs text-(--ed-text-2)">{done ? `${filename} downloaded` : ""}</span>
    </span>
  );
}

export function WhatIfPanel({ prompts }: { prompts: readonly WhatIfPrompt[] }) {
  const promptId = useId();
  const modelId = useId();
  const [ref, setRef] = useState(prompts[0]?.promptRef ?? "");
  const current = prompts.find((prompt) => prompt.promptRef === ref) ?? prompts[0];
  const defaultTarget = useMemo<PromptModel>(() => {
    const on = current?.currentModels[0];
    return WHAT_IF_MODELS.find((model) => model !== on) ?? WHAT_IF_MODELS[0];
  }, [current]);
  const [target, setTarget] = useState<PromptModel | null>(null);
  const chosen = target ?? defaultTarget;
  if (!current) {
    return <p className="text-sm text-(--ed-text-2)">No settled Claude calls in this range to re-price.</p>;
  }
  const estimate = current.byModel[chosen];
  const delta = estimate - current.baselineMicroUsd;
  return (
    <div className="rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={promptId} className="text-sm font-medium">Prompt</label>
          <select id={promptId} className={cn(controlClass, "font-mono")} value={current.promptRef} onChange={(event) => { setRef(event.target.value); setTarget(null); }}>
            {prompts.map((prompt) => <option key={prompt.promptRef} value={prompt.promptRef}>{prompt.promptRef}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={modelId} className="text-sm font-medium">Run it on</label>
          <select id={modelId} className={controlClass} value={chosen} onChange={(event) => setTarget(event.target.value as PromptModel)}>
            {WHAT_IF_MODELS.map((model) => <option key={model} value={model}>{MODEL_LABELS[model]}</option>)}
          </select>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
        <div>
          <dt className="text-sm text-(--ed-text-2)">Now ({current.currentModels.map((model) => MODEL_LABELS[model as PromptModel] ?? model).join(", ")})</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatUsd(current.baselineMicroUsd)}</dd>
          <dd className="text-xs text-(--ed-text-2)">{formatCount(current.calls)} calls · charged {formatUsd(current.chargedMicroUsd)}</dd>
        </div>
        <div>
          <dt className="text-sm text-(--ed-text-2)">On {MODEL_LABELS[chosen]} (estimate)</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatUsd(estimate)}</dd>
          <dd className="text-xs text-(--ed-text-2)">{current.batchCalls > 0 ? "Batch discount kept on batch calls" : "Real-time rates"}</dd>
        </div>
        <div>
          <dt className="text-sm text-(--ed-text-2)">Difference</dt>
          <dd className="text-xl font-semibold tabular-nums">{delta === 0 ? "No change" : `${delta > 0 ? "+" : "−"}${formatUsd(Math.abs(delta))}`}</dd>
          <dd className="text-xs text-(--ed-text-2)">
            {current.baselineMicroUsd > 0 ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatPercent(Math.abs(delta) / current.baselineMicroUsd)} vs now` : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-(--ed-text-2)">
        An estimate: the same input, cache and output tokens priced at the other model&apos;s dated rates from
        <code className="mx-1">convex/ai/pricing.ts</code>. Another model would write a different number of tokens, and quality is not measured here. No call is made.
      </p>
    </div>
  );
}

const DEFAULTS = { foundersPerDay: "20", launchesPerFounder: "1", messagesPerFounder: "40", paidSharePercent: "5" };

function parse(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function ForecastPanel({ units }: { units: ForecastUnits }) {
  const ids = { founders: useId(), launches: useId(), messages: useId(), paid: useId() };
  const [inputs, setInputs] = useState(DEFAULTS);
  const result = forecast(units, {
    foundersPerDay: parse(inputs.foundersPerDay),
    launchesPerFounder: parse(inputs.launchesPerFounder),
    messagesPerFounder: parse(inputs.messagesPerFounder),
    paidShare: parse(inputs.paidSharePercent) / 100,
  });
  const field = (key: keyof typeof DEFAULTS, id: string, label: string, hint: string, step: number) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id}
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        aria-describedby={`${id}-hint`}
        className={cn(controlClass, "w-40 tabular-nums")}
        value={inputs[key]}
        onChange={(event) => {
          const value = event.target.value;
          setInputs((prior) => ({ ...prior, [key]: value }));
        }}
      />
      <span id={`${id}-hint`} className="text-xs text-(--ed-text-2)">{hint}</span>
    </div>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <form className="flex flex-col gap-4 rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4" onSubmit={(event) => event.preventDefault()} aria-label="Forecast assumptions">
        {field("foundersPerDay", ids.founders, "New founders a day", "Founders who start a business each day.", 1)}
        {field("launchesPerFounder", ids.launches, "Launches per founder", "Businesses each one launches.", 0.1)}
        {field("messagesPerFounder", ids.messages, "Wren messages per founder", "Over their first month.", 1)}
        {field("paidSharePercent", ids.paid, "Founders who pay (%)", "Share on Builder's Hub ($29 a month).", 1)}
      </form>
      <div aria-live="polite">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
            <dt className="text-sm text-(--ed-text-2)">AI cost a month (estimate)</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{formatUsd(result.monthlyCostMicroUsd)}</dd>
            <dd className="mt-1 text-xs text-(--ed-text-2)">{formatUsd(result.dailyCostMicroUsd)} a day · {formatCount(Math.round(result.foundersPerMonth))} founders a month</dd>
          </div>
          <div className="rounded-lg border border-(--ed-border) bg-(--ed-surface) p-4">
            <dt className="text-sm text-(--ed-text-2)">Builder&apos;s Hub revenue a month</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{formatUsd(result.monthlyRevenueMicroUsd)}</dd>
            <dd className="mt-1 text-xs text-(--ed-text-2)">
              {formatCount(Math.round(result.payingFounders))} paying · AI cost is {formatPercent(result.costShareOfRevenue)} of it
            </dd>
          </div>
        </dl>
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">How the monthly estimate adds up</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-(--ed-border) py-1.5 text-left text-xs font-semibold text-(--ed-text-2)">Line</th>
              <th scope="col" className="border-b border-(--ed-border) py-1.5 text-left text-xs font-semibold text-(--ed-text-2)">Unit cost (measured)</th>
              <th scope="col" className="border-b border-(--ed-border) py-1.5 text-right text-xs font-semibold text-(--ed-text-2)">A month</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="border-b border-(--ed-border) py-1.5 text-left font-normal">Launches</th>
              <td className="border-b border-(--ed-border) py-1.5 tabular-nums">{formatUsd(units.launchMicroUsd)} mean per launch</td>
              <td className="border-b border-(--ed-border) py-1.5 text-right tabular-nums">{formatUsd(result.launchMicroUsd)}</td>
            </tr>
            <tr>
              <th scope="row" className="border-b border-(--ed-border) py-1.5 text-left font-normal">Wren messages</th>
              <td className="border-b border-(--ed-border) py-1.5 tabular-nums">{formatUsd(units.wrenMessageMicroUsd)} per message</td>
              <td className="border-b border-(--ed-border) py-1.5 text-right tabular-nums">{formatUsd(result.wrenMicroUsd)}</td>
            </tr>
            <tr>
              <th scope="row" className="border-b border-(--ed-border) py-1.5 text-left font-normal">Platform (seeds, evals)</th>
              <td className="border-b border-(--ed-border) py-1.5 tabular-nums">{formatUsd(units.platformPerDayMicroUsd)} a day</td>
              <td className="border-b border-(--ed-border) py-1.5 text-right tabular-nums">{formatUsd(result.platformMicroUsd)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 text-left font-semibold">Total</th>
              <td className="py-1.5 tabular-nums">{formatUsd(result.perFounderMicroUsd)} per founder</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{formatUsd(result.monthlyCostMicroUsd)}</td>
            </tr>
          </tbody>
        </table>
        {result.missing.length > 0 ? (
          <p className="mt-3 text-sm text-(--ed-warning)">
            No {result.missing.join(" or ")} cost was measured in this range, so it counts as $0. Pick a longer range.
          </p>
        ) : null}
        <p className="mt-3 text-xs text-(--ed-text-2)">
          Revenue counts one month of Builder&apos;s Hub at $29 for this month&apos;s paying founders only. Workspace Growth has no price in code yet, so it is left out.
        </p>
      </div>
    </div>
  );
}
