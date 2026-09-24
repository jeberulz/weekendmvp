import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";

import { categoryName, normalizeCategorySlug } from "@/components/ideas/idea-meta";
import { readMdxFile } from "@/lib/mdx";
import { extractIdea } from "./extract";
import { applyHighlights, readHighlights } from "./highlights";
import {
  averageHours,
  categoryCounts,
  hasOgArt,
  isFeatureReady,
  liveIdeas,
  newestRows,
  ogArtPath,
  publishOrder,
  toolCounts,
} from "./library";
import { pickWeekly, weekLabel, weekStartUtc } from "./rotation";
import { shortTitle, stackChips } from "./text";
import type { HomeData, IdeaExtract, InsideIdea, ManifestIdea, SpotlightIdea } from "./types";

const IDEAS_DIR = "content/ideas";
/** The idea inside the hero's build window. Falls back to this week's pick if it is ever retired. */
const HERO_SLUG = "freelance-scope-creep-detector";

type Loaded = { idea: ManifestIdea; extract: IdeaExtract; art: boolean };

function toSpotlight({ idea, extract }: Loaded): SpotlightIdea {
  const category = normalizeCategorySlug(idea.category);
  const s = idea.scores ?? {};
  return {
    slug: idea.slug,
    title: idea.title,
    shortTitle: shortTitle(idea.title),
    description: idea.description ?? "",
    category,
    categoryName: category ? categoryName(category) : "",
    buildTime: Number(idea.buildTime) || 0,
    revenueGoal: idea.revenueGoal ?? "",
    how: extract.how,
    scores: { opportunity: s.opportunity ?? 0, pain: s.pain ?? 0, timing: s.timing ?? 0, builder_confidence: s.builder_confidence ?? 0 },
    sources: idea.provenance?.citations ?? 0,
    art: ogArtPath(idea.slug),
    prompts: extract.prompts.slice(0, 3),
  };
}

function toInside({ idea, extract }: Loaded): InsideIdea {
  return {
    slug: idea.slug,
    title: idea.title,
    shortTitle: shortTitle(idea.title),
    revenueGoal: idea.revenueGoal ?? "",
    problem: extract.problem,
    how: extract.how,
    market: extract.market,
    competitors: extract.competitors,
    tiers: extract.tiers,
    stack: stackChips(extract.stack),
    promptTitles: extract.prompts.map((p) => p.title).slice(0, 4),
    sources: idea.provenance?.citations ?? 0,
  };
}

/**
 * Everything the homepage shows, from `ideas/manifest.json` and the idea MDX.
 * Cached for an hour, so a new week's picks land within the hour of Monday
 * 00:00 UTC and a new publish shows up without a manual step.
 */
export async function getHomeData(): Promise<HomeData> {
  "use cache";
  cacheTag("ideas");
  cacheLife("hours");

  const now = new Date();
  const manifest = JSON.parse(await readFile(path.join(process.cwd(), "ideas/manifest.json"), "utf8")) as {
    ideas?: ManifestIdea[];
  };
  const ideas = liveIdeas(manifest.ideas ?? []);

  const loaded: Loaded[] = await Promise.all(
    ideas.map(async (idea) => {
      const file = await readMdxFile(IDEAS_DIR, idea.slug);
      const extract = applyHighlights(extractIdea(file?.content ?? ""), readHighlights(idea.highlights));
      return { idea, extract, art: hasOgArt(idea) };
    }),
  );
  const bySlug = new Map(loaded.map((l) => [l.idea.slug, l]));

  const pool = publishOrder(loaded.filter((l) => isFeatureReady(l.idea, l.extract, l.art)).map((l) => l.idea)).map(
    (idea) => bySlug.get(idea.slug)!,
  );
  const picks = pickWeekly(pool, now);
  if (!picks) throw new Error("Homepage: no idea is complete enough to feature this week");

  const heroSource = bySlug.get(HERO_SLUG) ?? picks.spotlight;
  const libraryNo = publishOrder(ideas).findIndex((idea) => idea.slug === heroSource.idea.slug) + 1;
  const heroCategory = normalizeCategorySlug(heroSource.idea.category);

  const strip = publishOrder(ideas)
    .reverse()
    .filter((idea) => bySlug.get(idea.slug)?.art)
    .slice(0, 6)
    .map((idea) => ({ slug: idea.slug, title: idea.title, art: ogArtPath(idea.slug) }));

  return {
    totals: {
      ideas: ideas.length,
      averageHours: averageHours(ideas),
      categories: categoryCounts(ideas),
      tools: toolCounts(ideas),
    },
    week: { label: weekLabel(now), start: weekStartUtc(now).toISOString() },
    newest: newestRows(ideas, (slug) => bySlug.get(slug)?.art ?? false),
    hero: {
      slug: heroSource.idea.slug,
      title: heroSource.idea.title,
      libraryNo,
      category: heroCategory,
      categoryName: heroCategory ? categoryName(heroCategory) : "",
      buildTime: Number(heroSource.idea.buildTime) || 0,
      promptTitles: heroSource.extract.prompts.map((p) => p.title).slice(0, 3),
      firstPrompt: heroSource.extract.prompts[0]?.lines ?? [],
    },
    spotlight: toSpotlight(picks.spotlight),
    inside: toInside(picks.inside),
    strip,
  };
}
