import { describe, expect, test } from "vitest";
import { pickWeekly, weekIndex, weekLabel, weekStartUtc } from "../../lib/home/rotation";

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
