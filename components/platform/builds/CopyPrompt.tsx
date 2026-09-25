"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlanPrompt } from "@/lib/dashboard/weekend-prompts";
import { trackDashboardEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink";

/**
 * Copies one prompt and says so: the label turns to "Copied" for 2 seconds
 * and a polite status reads "Prompt copied" (FR-17). Mirrors the Starter
 * Kit's copy button, with a visible label.
 */
export function CopyPrompt({
  prompt,
  surface,
  variant = "button",
  className,
}: {
  prompt: PlanPrompt;
  surface: "plan" | "home";
  variant?: "button" | "primary";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt.lines.join("\n"));
      setCopied(true);
      setMessage("Prompt copied");
      trackDashboardEvent({ name: "prompt_copied", props: { surface } });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        setMessage("");
      }, 2000);
    } catch {
      setMessage("Could not copy. Open the prompt and select the text instead.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-2 rounded-[9px] px-4 text-sm font-medium transition-colors",
          variant === "primary"
            ? "bg-home-ink text-home-card hover:bg-home-panel"
            : "border border-home-rule bg-home-card text-home-ink hover:border-home-ink-3",
          FOCUS,
          className,
        )}
      >
        {copied ? (
          <Check aria-hidden className="size-4 shrink-0" strokeWidth={2} />
        ) : (
          <Copy aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />
        )}
        {copied ? "Copied" : "Copy prompt"}
        <span className="sr-only"> for {prompt.title}</span>
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
