"use client";

import * as React from "react";

import { PromptCopyButton } from "@/components/ideas/PromptCopyButton";

/**
 * Dark-theme starter-prompt box with a copy button — ports the legacy
 * `.prompt-box` + `copyPrompt()` from the build-with pages.
 */
export function HubPromptCard({
  label,
  prompt,
}: {
  label: string;
  prompt: string;
}) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  return (
    <div className="relative group p-6 bg-white/5 border border-white/10 rounded-2xl">
      <PromptCopyButton
        targetRef={ref}
        className="text-neutral-400 hover:text-white focus:ring-white/40"
      />
      <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 text-neutral-500">
        {label}
      </h4>
      <p
        ref={ref}
        className="text-sm text-neutral-300 font-mono leading-relaxed pr-8"
      >
        {prompt}
      </p>
    </div>
  );
}
