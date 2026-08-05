"use client";

import { ArrowUpRight, Bookmark, Clock3, Hammer, Sparkles } from "lucide-react";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type ExploreIdeaCard = {
  ideaId: Id<"ideas">;
  slug: string;
  title: string;
  description: string;
  category: string;
  buildTime: string;
  revenueGoal: string;
  publishedAt: number;
  score: number | null;
  saved: boolean;
  interested: boolean;
  building: boolean;
};

function humanize(value: string) {
  return value.replaceAll("-", " ");
}

export function ExploreCard({ idea }: { idea: ExploreIdeaCard }) {
  const setIntent = useMutation(api.platform.ideas.setIntent);
  const [confirmed, setConfirmed] = useState({
    saved: idea.saved,
    interested: idea.interested,
  });
  const [pendingFlag, setPendingFlag] = useState<"saved" | "interested" | null>(null);
  const [announcement, setAnnouncement] = useState("");

  async function updateIntent(flag: "saved" | "interested") {
    const value = !confirmed[flag];
    setPendingFlag(flag);
    setAnnouncement("");
    try {
      const result = await setIntent({ ideaId: idea.ideaId, flag, value });
      setConfirmed({ saved: result.saved, interested: result.interested });
      setAnnouncement(
        `${idea.title} ${value ? "marked" : "removed"} ${flag === "saved" ? "Saved" : "Interested"}.`,
      );
    } catch {
      setAnnouncement(`Could not update ${flag === "saved" ? "Saved" : "Interested"}. Try again.`);
    } finally {
      setPendingFlag(null);
    }
  }

  return (
    <article className="group border-b border-white/10 py-6 first:pt-2">
      <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-white/10 px-2 py-1 capitalize text-zinc-400">
              {humanize(idea.category)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" aria-hidden />
              {idea.buildTime} hours to first build
            </span>
            {idea.score !== null && <span>Canonical score {idea.score}/10</span>}
          </div>
          <h2 className="mt-3 break-words text-xl font-semibold tracking-[-0.02em] text-zinc-100 sm:text-2xl">
            <Link
              href={`/ideas/${idea.slug}`}
              className="rounded-sm transition-colors duration-200 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              {idea.title}
            </Link>
          </h2>
          <p className="mt-2 max-w-[70ch] text-sm leading-6 text-zinc-400">
            {idea.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              aria-pressed={confirmed.saved}
              disabled={pendingFlag !== null}
              onClick={() => updateIntent("saved")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 text-zinc-300 transition-colors duration-200 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-wait disabled:opacity-60 aria-pressed:border-white/20 aria-pressed:bg-white/8 aria-pressed:text-zinc-100"
            >
              <Bookmark className="size-3.5" aria-hidden />
              {pendingFlag === "saved" ? "Saving…" : confirmed.saved ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              aria-pressed={confirmed.interested}
              disabled={pendingFlag !== null}
              onClick={() => updateIntent("interested")}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 px-3 text-zinc-300 transition-colors duration-200 hover:border-orange-300/40 hover:text-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-wait disabled:opacity-60 aria-pressed:border-orange-300/40 aria-pressed:text-orange-200"
            >
              <Sparkles className="size-3.5" aria-hidden />
              {pendingFlag === "interested"
                ? "Updating…"
                : confirmed.interested
                  ? "Interested"
                  : "Mark Interested"}
            </button>
            {idea.building && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1.5 text-emerald-200">
                <Hammer className="size-3.5" aria-hidden /> Building
              </span>
            )}
            <span className="text-zinc-400">Target {humanize(idea.revenueGoal)}</span>
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              {announcement}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:w-44 md:flex-col">
          <Link
            href={`/build/${idea.slug}`}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-orange-800 px-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
          >
            Preview this idea
          </Link>
          <Link
            href={`/ideas/${idea.slug}`}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 transition-colors duration-200 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            Read research
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
