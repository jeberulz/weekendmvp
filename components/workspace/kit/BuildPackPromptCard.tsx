"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { BTN_SECONDARY } from "./styles";

export type CopyState = "idle" | "copied" | "blocked";

type ClipboardLike = { writeText: (text: string) => Promise<void> };

/** Resolves to "copied" or "blocked"; never throws (clipboard can be unavailable). */
export async function copyText(text: string, clipboard?: ClipboardLike): Promise<Exclude<CopyState, "idle">> {
  const target =
    clipboard ?? (typeof navigator !== "undefined" ? navigator.clipboard : undefined);
  if (!target) return "blocked";
  try {
    await target.writeText(text);
    return "copied";
  } catch {
    return "blocked";
  }
}

export type BuildPackPromptCardProps = {
  index: number;
  duration: string;
  title: string;
  tool: string;
  body: string;
  doNotBuild: string;
  doneWhen: string;
  /** Heading level for the prompt title (default 3, under an h2 section). */
  headingLevel?: 3 | 4 | 5;
};

export function copyStatusMessage(state: CopyState, index: number, tool: string): string {
  if (state === "copied") return `Copied Prompt ${index} for ${tool}.`;
  if (state === "blocked")
    return "Copy is blocked in this preview. Select the prompt text and copy it by hand.";
  return "";
}

/** The accessible name always contains the visible text ("Copy prompt", "Copied", "Copy blocked"). */
export function copyButtonLabel(state: CopyState, index: number, title: string): string {
  if (state === "copied") return `Copied prompt ${index}: ${title}`;
  if (state === "blocked") return `Copy blocked for prompt ${index}: ${title}`;
  return `Copy prompt ${index}: ${title}`;
}

export function BuildPackPromptCard({
  index,
  duration,
  title,
  tool,
  body,
  doNotBuild,
  doneWhen,
  headingLevel = 3,
}: BuildPackPromptCardProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const Heading = `h${headingLevel}` as "h3" | "h4" | "h5";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleCopy() {
    if (timer.current) clearTimeout(timer.current);
    const result = await copyText(body);
    // A late clipboard promise after unmount must do nothing.
    if (!mounted.current) return;
    setState(result);
    // "Copied" fades; "Copy blocked" stays until the next action.
    if (result === "copied") {
      timer.current = setTimeout(() => {
        if (mounted.current) setState("idle");
      }, 2000);
    }
  }

  return (
    <article
      data-prompt={index}
      aria-label={`Prompt ${index}: ${title}`}
      className="flex flex-col gap-2 rounded-xl border border-home-rule bg-home-card p-4"
    >
      <header className="flex items-center gap-2">
        <p className="font-mono text-[11px] text-home-ink-3">
          PROMPT {index} · {duration}
        </p>
        <Heading className="text-sm font-semibold text-home-ink">{title}</Heading>
        <button
          type="button"
          aria-label={copyButtonLabel(state, index, title)}
          onClick={handleCopy}
          className={cn(BTN_SECONDARY, "ml-auto")}
        >
          {state === "copied" ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          {state === "copied" ? "Copied" : state === "blocked" ? "Copy blocked" : "Copy prompt"}
        </button>
      </header>
      <p className="text-xs text-home-ink-2">For {tool}</p>
      <pre
        role="region"
        aria-label={`Prompt ${index} text`}
        tabIndex={0}
        className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-home-sunk p-3 font-mono text-xs text-home-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink"
      >
        {body}
      </pre>
      <p className="rounded-md bg-home-clay px-2.5 py-1.5 text-[13px] text-home-clay-ink">
        <strong className="font-semibold">Do not build:</strong> {doNotBuild}
      </p>
      <p className="rounded-md bg-home-sage px-2.5 py-1.5 text-[13px] text-home-sage-ink">
        <strong className="font-semibold">Done when:</strong> {doneWhen}
      </p>
      <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-home-ink-2">
        {copyStatusMessage(state, index, tool)}
      </p>
    </article>
  );
}
