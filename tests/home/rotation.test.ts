import { describe, expect, test } from "vitest";
import { pickHero, pickWeekly, weekIndex, weekLabel, weekStartUtc } from "../../lib/home/rotation";

const pool = Array.from({ length: 40 }, (_, i) => ({
  slug: `idea-${String(i).padStart(2, "0")}`,
  publishedAt: `2026-0${1 + (i % 8)}-${String(1 + (i % 27)).padStart(2, "0")}`,
}));
const slugs = (p: { spotlight: { slug: string }; inside: { slug: string } } | null) => [p!.spotlight.slug, p!.inside.slug];

describe("weekly rotation", () => {
  test("weeks start Monday 00:00 UTC", () => {
    expect(weekStartUtc(new Date("2026-09-24T15:00:00Z")).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(weekStartUtc(new Date("2026-09-21T00:00:00Z")).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(weekStartUtc(new Date("2026-09-27T23:59:59Z")).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(weekIndex(new Date("2026-09-28T00:00:00Z"))).toBe(weekIndex(new Date("2026-09-27T23:59:59Z")) + 1);
  });

  test("labels the week, across a month boundary too", () => {
    expect(weekLabel(new Date("2026-09-24T12:00:00Z"))).toBe("Sep 21–27");
    expect(weekLabel(new Date("2026-10-01T12:00:00Z"))).toBe("Sep 28–Oct 4");
  });

  test("the picks hold for the whole week and change on Monday", () => {
    const monday = slugs(pickWeekly(pool, new Date("2026-09-21T00:00:00Z")));
    expect(slugs(pickWeekly(pool, new Date("2026-09-24T13:00:00Z")))).toEqual(monday);
    expect(slugs(pickWeekly(pool, new Date("2026-09-27T23:59:59Z")))).toEqual(monday);
    expect(slugs(pickWeekly(pool, new Date("2026-09-28T00:00:00Z")))).not.toEqual(monday);
  });

  test("midweek pool changes keep the picks unless they touch a winner", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    const before = slugs(pickWeekly(pool, now));
    // A publish during the week never enters the running week.
    expect(slugs(pickWeekly([...pool, { slug: "fresh", publishedAt: "2026-09-23" }], now))).toEqual(before);
    // Retiring (or un-readying) any idea that is not a winner changes nothing.
    for (const gone of pool.filter((c) => !before.includes(c.slug))) {
      expect(slugs(pickWeekly(pool.filter((c) => c !== gone), now))).toEqual(before);
    }
    // An older idea that newly qualifies either wins outright or changes nothing.
    for (let i = 0; i < 20; i++) {
      const extra = { slug: `late-art-${i}`, publishedAt: "2026-02-01" };
      const after = slugs(pickWeekly([...pool, extra], now));
      if (!after.includes(extra.slug)) expect(after).toEqual(before);
    }
  });

  test("section 06 never repeats section 03, and no idea repeats in back-to-back weeks", () => {
    let previous: string[] = [];
    for (let d = 0; d < 80; d++) {
      const picks = slugs(pickWeekly(pool, new Date(Date.UTC(2026, 3, 6 + d * 7))));
      expect(picks[0]).not.toBe(picks[1]);
      expect(picks.filter((s) => previous.includes(s))).toEqual([]);
      previous = picks;
    }
  });

  test("tiny and empty pools", () => {
    expect(pickWeekly([], new Date())).toBeNull();
    const one = pickWeekly([{ slug: "only", publishedAt: "2026-01-01" }], new Date());
    expect(slugs(one)).toEqual(["only", "only"]);
  });
});

describe("weekly hero", () => {
  // The hero pool overlaps the section 03 and 06 pool on purpose, so the skip rule is exercised.
  const heroPool = pool;
  const heroOf = (now: Date, h = heroPool, p = pool) => pickHero(h, p, now)!.slug;

  test("the hero holds for the whole week and changes on Monday", () => {
    const monday = heroOf(new Date("2026-09-21T00:00:00Z"));
    expect(heroOf(new Date("2026-09-24T13:00:00Z"))).toBe(monday);
    expect(heroOf(new Date("2026-09-27T23:59:59Z"))).toBe(monday);
    expect(heroOf(new Date("2026-09-28T00:00:00Z"))).not.toBe(monday);
  });

  test("the hero never doubles as section 03 or 06 and never repeats back to back", () => {
    let previous = "";
    for (let d = 0; d < 80; d++) {
      const now = new Date(Date.UTC(2026, 3, 6 + d * 7));
      const hero = heroOf(now);
      expect(slugs(pickWeekly(pool, now))).not.toContain(hero);
      expect(hero).not.toBe(previous);
      previous = hero;
    }
  });

  test("a midweek publish or retirement keeps the hero unless it touches the winner", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    const before = heroOf(now);
    expect(heroOf(now, [...heroPool, { slug: "fresh", publishedAt: "2026-09-23" }])).toBe(before);
    for (const gone of heroPool.filter((c) => c.slug !== before)) {
      expect(heroOf(now, heroPool.filter((c) => c !== gone))).toBe(before);
    }
    for (let i = 0; i < 20; i++) {
      const extra = { slug: `late-hero-${i}`, publishedAt: "2026-02-01" };
      const after = heroOf(now, [...heroPool, extra]);
      if (after !== extra.slug) expect(after).toBe(before);
    }
  });

  test("adding the hero draw left the section 03 and 06 picks where they were", () => {
    // Recorded from the pre-WP58 rotation code. A change here reshuffles every future week.
    const golden = [
      ["2026-09-07", "idea-22", "idea-23"],
      ["2026-09-14", "idea-36", "idea-37"],
      ["2026-09-21", "idea-06", "idea-07"],
      ["2026-09-28", "idea-00", "idea-03"],
      ["2026-10-05", "idea-08", "idea-09"],
      ["2026-10-12", "idea-30", "idea-33"],
    ];
    expect(golden.map(([d]) => [d, ...slugs(pickWeekly(pool, new Date(`${d}T12:00:00Z`)))])).toEqual(golden);
  });

  test("the hero pool is independent of the section 03 and 06 pool", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    const only = [{ slug: "no-art-idea", publishedAt: "2026-01-01" }, { slug: "also-no-art", publishedAt: "2026-01-02" }];
    expect(only.map((c) => c.slug)).toContain(heroOf(now, only, []));
    expect(only.map((c) => c.slug)).toContain(heroOf(now, only, pool));
  });

  test("empty and tiny hero pools", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(pickHero([], pool, now)).toBeNull();
    expect(pickHero([], [], now)).toBeNull();
    // Every candidate taken: the hero repeats a winner rather than hiding.
    const one = [{ slug: "only", publishedAt: "2026-01-01" }];
    expect(heroOf(now, one, one)).toBe("only");
  });
});
