"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { PlanPrompt } from "@/lib/dashboard/weekend-prompts";
import { cn } from "@/lib/utils";
import { CopyPrompt } from "./CopyPrompt";
import type { PromptsState } from "./usePlanPrompts";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";
const NOTE = "rounded-[10px] border border-dashed border-home-rule px-4 py-3 text-sm leading-[1.5] text-home-ink-2";

/** One prompt: its title and Copy up front, the full text one click away. */
function PromptItem({ prompt }: { prompt: PlanPrompt }) {
  return (
    <li className="rounded-[10px] border border-home-rule bg-home-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="min-w-0 text-[15px] font-medium text-home-ink">{prompt.title}</p>
        <CopyPrompt prompt={prompt} surface="plan" />
      </div>
      <details className="group border-t border-home-rule">
        <summary
          className={cn(
            "flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-4 text-sm text-home-ink-2 hover:text-home-ink [&::-webkit-details-marker]:hidden",
            FOCUS,
          )}
        >
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          />
          Show the prompt<span className="sr-only"> for {prompt.title}</span>
        </summary>
        <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words px-4 pb-4 font-mono text-[12.5px] leading-[1.6] text-home-ink">
          {prompt.lines.join("\n")}
        </pre>
      </details>
    </li>
  );
}

/**
 * A stage's prompts (FR-17). `empty` is the stage's own fallback when the
 * idea has no prompt of that kind.
 */
export function PromptList({
  state,
  pick,
  empty,
  ideaSlug,
}: {
  state: PromptsState;
  pick: (prompts: PlanPrompt[]) => PlanPrompt[];
  empty: string;
  ideaSlug: string;
}) {
  if (state.status === "loading") {
    return (
      <div role="status" className="h-[68px] animate-pulse rounded-[10px] bg-home-sunk motion-reduce:animate-none">
        <span className="sr-only">Loading prompts</span>
      </div>
    );
  }
  if (state.status === "failed") {
    return (
      <p className={NOTE}>
        We can’t load the prompts right now. They are also on the{" "}
        <Link
          href={`/ideas/${ideaSlug}`}
          className={cn("font-medium text-home-orange-ink underline underline-offset-4 hover:text-home-ink", FOCUS)}
        >
          idea page
        </Link>
        .
      </p>
    );
  }
  const prompts = pick(state.prompts);
  if (prompts.length === 0) return <p className={NOTE}>{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {prompts.map((prompt, index) => (
        <PromptItem key={`${index}-${prompt.title}`} prompt={prompt} />
      ))}
    </ul>
  );
}
