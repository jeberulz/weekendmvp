import Link from "next/link";

import type { SpotlightIdea } from "@/lib/home/types";
import { cn } from "@/lib/utils";
import { CopyButton } from "../client/CopyButton";
import { Icon } from "../icons";
import { TOOL_NAME, ToolLogo, type ToolKey } from "../tool-logos";
import { ButtonLink, Container, Em, Eyebrow } from "../ui";

type Tile = { key: ToolKey | "no-code"; href: string; name: string; count: number | null };

const TILES: { key: ToolKey | "no-code"; hub: string; countKey: string | null }[] = [
  { key: "cursor", hub: "cursor", countKey: "cursor" },
  { key: "claude", hub: "claude", countKey: "claude" },
  { key: "claudecode", hub: "claude-code", countKey: null },
  { key: "lovable", hub: "lovable", countKey: "lovable" },
  { key: "v0", hub: "v0", countKey: "v0" },
  { key: "replit", hub: "replit", countKey: "replit" },
  { key: "windsurf", hub: "windsurf", countKey: "windsurf" },
  { key: "no-code", hub: "no-code", countKey: "no-code" },
];

function ToolTile({ tile, hot }: { tile: Tile; hot: boolean }) {
  return (
    <Link
      href={tile.href}
      className={cn(
        "flex h-32 flex-col justify-between rounded-2xl border p-4 transition-colors lg:h-[200px] lg:rounded-[22px] lg:p-7",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-home-orange-ink",
        hot ? "border-home-ink bg-home-ink text-home-d1" : "border-home-rule bg-home-card text-home-ink hover:border-home-ink",
      )}
    >
      <span className="flex items-start justify-between">
        {tile.key === "no-code" ? (
          <Icon name="wand" size={34} strokeWidth={1.25} className="lg:size-16" />
        ) : (
          <span className="lg:hidden">
            <ToolLogo tool={tile.key} size={34} idSuffix={`wall-m-${tile.key}`} />
          </span>
        )}
        {tile.key !== "no-code" && (
          <span className="hidden lg:block">
            <ToolLogo tool={tile.key} size={64} idSuffix={`wall-${tile.key}`} />
          </span>
        )}
        <Icon name="arrow" size={18} strokeWidth={1.75} className={cn("lg:size-[22px]", hot ? "text-home-d2" : "text-home-ink-3")} />
      </span>
      <span className="flex flex-col gap-1 lg:gap-1.5">
        <span className="font-editorial text-[22px] leading-none lg:text-[34px]">{tile.name}</span>
        <span className={cn("font-mono text-[10.5px] tracking-[0.08em] lg:text-xs", hot ? "text-home-d2" : "text-home-ink-3")}>
          {tile.count === null ? "BUILD GUIDE" : `${tile.count} IDEAS`}
        </span>
      </span>
    </Link>
  );
}

function PeekCard({ tool, n, title, className }: { tool: ToolKey; n: number; title: string; className: string }) {
  return (
    <div className={cn("absolute flex items-start gap-2 rounded-[14px] border border-home-panel-rule bg-home-panel px-3.5 py-[11px] lg:rounded-2xl lg:px-4 lg:py-3", className)}>
      <ToolLogo tool={tool} size={15} idSuffix={`peek-${n}`} />
      <p className="truncate font-mono text-[10px] tracking-[0.08em] text-home-d2 lg:text-[11px]">
        PROMPT {n} · {title.toUpperCase()}
      </p>
    </div>
  );
}

/** 05 · Works with the AI you already use, plus this week's prompts. */
export function BuildWithAI({ toolCounts, idea }: { toolCounts: Record<string, number>; idea: SpotlightIdea }) {
  const tiles: Tile[] = TILES.map((t) => ({
    key: t.key,
    href: `/build-with/${t.hub}`,
    name: t.key === "no-code" ? "No-code tools" : TOOL_NAME[t.key],
    count: t.countKey ? (toolCounts[t.countKey] ?? 0) : null,
  }));
  const [first, second, third] = idea.prompts;
  return (
    <section aria-labelledby="home-ai-title" className="bg-home-paper py-14 lg:py-24">
      <Container className="flex flex-col gap-7 lg:gap-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Eyebrow className="lg:hidden">Build with AI</Eyebrow>
          <h2 id="home-ai-title" className="max-w-[900px] font-editorial text-[48px] font-normal leading-[0.95] tracking-[-0.035em] text-home-ink lg:order-1 lg:text-[120px] lg:leading-[0.92] lg:tracking-[-0.04em]">
            Works with the AI <Em>you already use.</Em>
          </h2>
          <div className="flex flex-col gap-4 lg:order-2 lg:w-[300px] lg:gap-[18px] lg:pb-2.5">
            <Eyebrow className="max-lg:hidden">Build with AI</Eyebrow>
            <p className="text-base leading-[1.55] text-home-ink-2 lg:text-[17px]">
              Every idea ships with three or more copy-paste prompts. Pick your tool to see the ideas that fit it best.
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-5">
          {tiles.map((tile, i) => (
            <li key={tile.key}>
              <ToolTile tile={tile} hot={i === 0} />
            </li>
          ))}
        </ul>

        {first && (
          <div className="mt-2 flex flex-col gap-5 rounded-3xl bg-home-ink px-5 pb-6 pt-8 lg:relative lg:mt-4 lg:block lg:h-[620px] lg:overflow-hidden lg:rounded-[32px] lg:p-0">
            <div className="flex flex-col gap-5 lg:absolute lg:left-16 lg:top-[72px] lg:w-[400px] lg:gap-6">
              <Eyebrow dark>This week&rsquo;s prompts</Eyebrow>
              <h3 className="font-editorial text-[60px] font-normal leading-[0.92] tracking-[-0.04em] text-home-d1 lg:text-[92px]">
                Paste.
                <br />
                Run.
                <br />
                <Em dark>Ship.</Em>
              </h3>
              <p className="text-base leading-[1.55] text-home-d2 lg:max-w-[380px] lg:text-[17px]">
                The three prompts that build this week&rsquo;s idea, {idea.shortTitle}. Copy one into your tool and start.
              </p>
              <ButtonLink href={`/ideas/${idea.slug}`} tone="dark" className="hidden w-fit lg:inline-flex">
                See every prompt
              </ButtonLink>
            </div>

            <div className="relative -mx-1.5 h-[340px] lg:absolute lg:inset-y-0 lg:left-[520px] lg:right-0 lg:mx-0 lg:h-auto">
              {third && <PeekCard tool="claude" n={3} title={third.title} className="inset-x-3.5 top-0 h-20 rotate-[3deg] lg:inset-x-auto lg:left-[130px] lg:top-[52px] lg:h-24 lg:w-[540px] lg:rotate-[5deg]" />}
              {second && <PeekCard tool="claudecode" n={2} title={second.title} className="inset-x-3.5 top-[34px] h-20 rotate-[1.5deg] lg:inset-x-auto lg:left-[76px] lg:top-[112px] lg:h-24 lg:w-[540px] lg:rotate-[2.5deg]" />}
              <div className="absolute inset-x-0 top-[70px] -rotate-1 overflow-hidden rounded-[14px] border border-home-panel-rule bg-home-panel shadow-[0_30px_50px_-24px_rgba(0,0,0,0.8)] lg:left-5 lg:right-auto lg:top-[180px] lg:w-[540px] lg:-rotate-[1.5deg] lg:rounded-2xl">
                <div className="flex items-center gap-2 border-b border-home-panel-rule px-3.5 py-2.5 lg:px-4 lg:py-3">
                  <ToolLogo tool="cursor" size={15} color="var(--color-home-d1)" />
                  <p className="min-w-0 truncate font-mono text-[10px] tracking-[0.08em] text-home-d2 lg:text-[11px]">PROMPT 1 · {first.title.toUpperCase()}</p>
                  <CopyButton
                    text={first.lines.join("\n")}
                    label={`Copy prompt 1: ${first.title}`}
                    location="home-build-with-ai"
                    className="ml-auto shrink-0 px-1 text-home-d2 hover:text-home-d1"
                  />
                </div>
                <div className="relative h-[210px] overflow-hidden px-3.5 pt-3 font-mono text-xs leading-[1.65] text-[#ede6da] lg:h-[300px] lg:px-[18px] lg:pt-4 lg:text-[13px] lg:leading-[1.7]">
                  {first.lines.slice(0, 14).map((line, i) => (
                    <div key={i} className="flex gap-2.5 lg:gap-3">
                      <span aria-hidden className="w-3.5 shrink-0 text-right text-home-d3 lg:w-4">
                        {i + 1}
                      </span>
                      <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{line}</span>
                    </div>
                  ))}
                  <div aria-hidden className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-home-panel" />
                </div>
              </div>
            </div>
            <ButtonLink href={`/ideas/${idea.slug}`} tone="dark" className="w-full lg:hidden">
              See every prompt
            </ButtonLink>
          </div>
        )}
      </Container>
    </section>
  );
}
