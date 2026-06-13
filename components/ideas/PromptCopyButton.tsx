"use client";

/**
 * Copy-to-clipboard for prompt code blocks — replaces the legacy
 * `window.copyPrompt` from ideas/gate.js. `CopyablePre` is wired into the
 * light MDX component map so every fenced block on an idea page gets a
 * copy button; the button reads the rendered text via a ref.
 */

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { IconButton } from "@/components/primitives/IconButton";
import { cn } from "@/lib/utils";

export function PromptCopyButton({
  targetRef,
  className,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    const text = targetRef.current?.innerText?.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the text manually.");
    }
  };

  return (
    <IconButton
      aria-label="Copy to clipboard"
      onClick={copy}
      className={cn(
        "absolute top-4 right-4 text-neutral-400 hover:text-black transition-colors focus:outline-none focus:ring-2 focus:ring-black/30 rounded",
        className,
      )}
    >
      {copied ? <Check size={18} /> : <Copy size={18} />}
    </IconButton>
  );
}

/**
 * Light-theme prompt box (legacy `.prompt-box`) with a copy button.
 * Used as the `pre` element in the idea MDX component map — children are
 * the server-rendered (rehype-pretty-code) code contents.
 */
export function CopyablePre(props: React.ComponentProps<"pre">) {
  const preRef = React.useRef<HTMLPreElement>(null);
  const { className: _ignored, children, ...rest } = props;

  return (
    <div className="relative group mb-6">
      <PromptCopyButton targetRef={preRef} />
      <pre
        ref={preRef}
        {...rest}
        className="bg-[#f5f2ed] border border-[#e5e0d8] rounded-3xl p-6 pr-12 text-xs font-mono text-neutral-600 leading-relaxed overflow-x-auto whitespace-pre-wrap"
      >
        {children}
      </pre>
    </div>
  );
}
