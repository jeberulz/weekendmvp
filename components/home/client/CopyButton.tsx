"use client";

import { useEffect, useRef, useState } from "react";

import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";
import { Icon } from "../icons";

/** Copies a prompt and confirms in place ("Copied"), announced to screen readers. */
export function CopyButton({
  text,
  label,
  location,
  className,
  iconColor = "currentColor",
}: {
  text: string;
  /** Accessible name, e.g. "Copy prompt 1: Project setup". */
  label: string;
  location: string;
  className?: string;
  iconColor?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      trackEvent("prompt_copied", { button_location: location });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the prompt is still visible to select by hand.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-light",
        className,
      )}
    >
      <Icon name={copied ? "check" : "copy"} size={14} color={iconColor} accent={iconColor} />
      <span aria-hidden>{copied ? "Copied" : "Copy"}</span>
      <span role="status" className="sr-only">
        {copied ? "Prompt copied" : ""}
      </span>
    </button>
  );
}
