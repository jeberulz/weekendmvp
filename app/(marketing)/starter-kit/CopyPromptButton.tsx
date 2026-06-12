"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "@/components/primitives/IconButton";

/**
 * Copy-to-clipboard button for prompt boxes, ported from the inline
 * `.prompt-box button` handler in starter-kit.html (icon swaps to a check
 * for 2 seconds after a successful copy).
 */
export function CopyPromptButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — non-fatal, mirrors legacy silent failure.
    }
  }

  return (
    <IconButton
      aria-label="Copy prompt to clipboard"
      title="Copy Prompt"
      className={className}
      onClick={handleCopy}
    >
      {copied ? <Check size={18} /> : <Copy size={18} />}
    </IconButton>
  );
}
