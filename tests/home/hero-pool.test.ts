import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { isEngineDraftSlug } from "../../lib/engine-drafts";
import { ideaHomeExtract } from "../../lib/home/highlights";
import { HERO_MIN_LINES, hasOgArt, isFeatureReady, isHeroReady } from "../../lib/home/library";
import { pickHero, pickWeekly } from "../../lib/home/rotation";
import type { ManifestIdea } from "../../lib/home/types";

/**
 * The shipped library against the weekly hero rule (WP58). A hero pool that
 * shrinks to a handful would repeat the same few ideas, so it fails here
 * before the homepage quietly does.
 */
const ROOT = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(ROOT, "ideas/manifest.json"), "utf8")) as { ideas: ManifestIdea[] };
const ideas = manifest.ideas.filter((i) => !i._retiredAt && !isEngineDraftSlug(i.slug));

const loaded = ideas.map((idea) => {
  const file = path.join(ROOT, "content/ideas", `${idea.slug}.mdx`);
  const extract = ideaHomeExtract(idea, existsSync(file) ? readFileSync(file, "utf8") : "");
  return { idea, extract };
});
const candidate = ({ idea }: { idea: ManifestIdea }) => ({ slug: idea.slug, publishedAt: idea.publishedAt });
const pool = loaded.filter((l) => isFeatureReady(l.idea, l.extract, hasOgArt(l.idea))).map(candidate);
const heroPool = loaded.filter((l) => isHeroReady(l.idea, l.extract)).map(candidate);

describe("shipped hero pool", () => {
  test("holds at least half a year of distinct weeks", () => {
    expect(heroPool.length).toBeGreaterThanOrEqual(26);
  });

  test("a year of weeks never shows the hero as section 03 or 06, or twice in a row", () => {
    let previous = "";
    for (let week = 0; week < 52; week++) {
      const now = new Date(Date.UTC(2026, 9, 5 + week * 7, 12));
      const hero = pickHero(heroPool, pool, now)!.slug;
      const weekly = pickWeekly(pool, now)!;
      expect([weekly.spotlight.slug, weekly.inside.slug]).not.toContain(hero);
      expect(hero).not.toBe(previous);
      previous = hero;
    }
  });

  test("every possible hero pastes in at least the minimum number of lines", () => {
    const bySlug = new Map(loaded.map((l) => [l.idea.slug, l.extract]));
    for (const { slug } of heroPool) {
      expect(bySlug.get(slug)!.prompts[0].lines.length, slug).toBeGreaterThanOrEqual(HERO_MIN_LINES);
    }
  });
});
