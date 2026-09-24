"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import type { HeroIdea } from "@/lib/home/types";
import { cn } from "@/lib/utils";
import { TOOL_NAME, ToolLogo, type ToolKey } from "../tool-logos";
import { CategoryTag, WeekendMeter } from "../ui";
import { CopyButton } from "./CopyButton";

const TOOLS: ToolKey[] = ["cursor", "claudecode", "claude", "lovable", "v0", "replit", "windsurf"];

/**
 * The hero's "prompt to product" window: pick a tool, see the idea brief and
 * its first prompt, copy it. The prompt is the same for every tool; the tabs
 * show that it pastes into any of them.
 */
export function HeroBuildWindow({ idea, total }: { idea: HeroIdea; total: number }) {
  const [active, setActive] = useState<ToolKey>("cursor");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = TOOLS.indexOf(active);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TOOLS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const n = (next + TOOLS.length) % TOOLS.length;
    setActive(TOOLS[n]);
    tabs.current[n]?.focus();
  }

  const prompt = idea.firstPrompt.join("\n");

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-home-rule bg-home-card shadow-[0_1px_0_rgba(26,24,20,0.04),0_40px_80px_-40px_rgba(26,24,20,0.35)] lg:rounded-[22px]">
      <div className="flex items-center gap-1.5 border-b border-home-rule bg-home-paper p-2 lg:px-3.5 lg:py-3">
        <div aria-hidden className="hidden gap-1.5 pl-1 pr-3 lg:flex">
          {[0, 1, 2].map((d) => (
            <span key={d} className="size-2.5 rounded-full bg-home-rule" />
          ))}
        </div>
        <div
          role="tablist"
          aria-label="AI tool"
          onKeyDown={onKeyDown}
          className="no-scrollbar flex gap-1 overflow-x-auto [mask-image:linear-gradient(90deg,#000_82%,transparent)] lg:[mask-image:none]"
        >
          {TOOLS.map((tool, i) => {
            const selected = tool === active;
            return (
              <button
                key={tool}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`hero-tab-${tool}`}
                aria-selected={selected}
                aria-controls="hero-tabpanel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tool)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] border px-2.5 text-[13px] font-medium transition-colors lg:h-9 lg:px-3.5 lg:text-sm",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-home-orange-ink",
                  selected
                    ? "border-home-rule bg-home-card text-home-ink shadow-[0_1px_2px_rgba(26,24,20,0.08)]"
                    : "border-transparent text-home-ink-2 hover:text-home-ink",
                )}
              >
                <ToolLogo tool={tool} size={15} idSuffix={`hero-${tool}`} />
                {TOOL_NAME[tool]}
              </button>
            );
          })}
        </div>
      </div>

      <div id="hero-tabpanel" role="tabpanel" aria-labelledby={`hero-tab-${active}`} className="flex flex-col lg:h-[404px] lg:flex-row">
        <div className="flex flex-col gap-3 p-4 lg:w-[360px] lg:shrink-0 lg:gap-4 lg:border-r lg:border-home-rule lg:p-6">
          <div className="flex items-center justify-between">
            <CategoryTag slug={idea.category} name={idea.categoryName} />
            <span className="font-mono text-[10px] text-home-ink-3 lg:text-[11px]">
              N°{String(idea.libraryNo).padStart(3, "0")} OF {total}
            </span>
          </div>
          <p className="font-editorial text-[22px] leading-[1.12] tracking-[-0.01em] lg:text-[26px]">{idea.title}</p>
          <WeekendMeter hours={idea.buildTime} cell={10} />
          <div className="hidden flex-col gap-2 border-t border-home-rule pt-3.5 lg:flex">
            <p className="font-mono text-[11px] tracking-[0.08em] text-home-ink-3">PROMPTS IN THIS IDEA</p>
            <ol className="flex flex-col gap-2">
              {idea.promptTitles.map((title, j) => (
                <li
                  key={title}
                  className={cn("flex items-center justify-between rounded-[10px] px-3 py-[9px] text-sm", j === 0 ? "bg-home-sunk" : "bg-home-paper")}
                >
                  <span className="flex gap-2.5">
                    <span aria-hidden className="font-editorial italic text-home-orange-ink">
                      {j + 1}
                    </span>
                    {title}
                  </span>
                  {j === 0 && <span className="font-mono text-[11px] text-home-ink-3">SHOWN</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-home-ink">
          <div className="flex items-center justify-between gap-3 border-b border-home-dr px-3.5 py-2.5 lg:px-5 lg:py-3.5">
            <p className="flex min-w-0 items-center gap-2 font-mono text-[10.5px] tracking-[0.06em] text-home-d2 lg:text-xs">
              <ToolLogo tool={active} size={14} color="var(--color-home-d2)" idSuffix={`hero-head-${active}`} />
              <span className="truncate">
                PASTE INTO {TOOL_NAME[active].toUpperCase()} · PROMPT 1
              </span>
            </p>
            <CopyButton
              text={prompt}
              label={`Copy prompt 1: ${idea.promptTitles[0] ?? "Project setup"}`}
              location="home-hero"
              className="h-[30px] shrink-0 bg-home-orange-light px-3 text-home-ink hover:bg-[#f5a266] lg:h-[34px] lg:px-3.5 lg:text-[13px]"
            />
          </div>
          <div className="relative h-[170px] overflow-hidden px-3.5 py-3.5 font-mono text-xs leading-[1.7] text-[#ede6da] lg:h-auto lg:flex-1 lg:px-5 lg:py-5 lg:text-sm lg:leading-[1.8]">
            {idea.firstPrompt.slice(0, 13).map((line, i) => (
              <div key={i} className="flex gap-3 lg:gap-[18px]">
                <span aria-hidden className="w-3.5 shrink-0 text-right text-home-d3 lg:w-5">
                  {i + 1}
                </span>
                <span className="whitespace-pre-wrap break-words">{line}</span>
              </div>
            ))}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-home-ink" />
          </div>
        </div>
      </div>
    </div>
  );
}
