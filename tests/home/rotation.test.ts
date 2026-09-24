import { describe, expect, test } from "vitest";
import { pickWeekly, weekIndex, weekLabel, weekStartUtc } from "../../lib/home/rotation";

describe("weekly rotation", () => {
  test("weeks start Monday 00:00 UTC", () => {
    expect(weekStartUtc(new Date("2026-09-24T15:00:00Z")).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(weekStartUtc(new Date("2026-09-21T00:00:00Z")).toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(weekStartUtc(new Date("2026-09-27T23:59:59Z")).toISOString()).toBe("2026-09-21T00:00:00.000Z");
  });

  test("the week turns over exactly at Monday 00:00 UTC", () => {
    const sunday = weekIndex(new Date("2026-09-27T23:59:59Z"));
    const monday = weekIndex(new Date("2026-09-28T00:00:00Z"));
    expect(monday).toBe(sunday + 1);
  });

  test("labels the week, across a month boundary too", () => {
    expect(weekLabel(new Date("2026-09-24T12:00:00Z"))).toBe("Sep 21–27");
    expect(weekLabel(new Date("2026-10-01T12:00:00Z"))).toBe("Sep 28–Oct 4");
  });

  test("section 06 never repeats section 03", () => {
    const pool = ["a", "b", "c", "d", "e"];
    for (let d = 0; d < 60; d++) {
      const picks = pickWeekly(pool, new Date(Date.UTC(2026, 0, 5 + d * 7)))!;
      expect(picks.inside).not.toBe(picks.spotlight);
    }
  });

  test("walks the pool one step per week, before the epoch too", () => {
    const pool = ["a", "b", "c"];
    expect(pickWeekly(pool, new Date("2026-01-05T00:00:00Z"))!.spotlight).toBe("a");
    expect(pickWeekly(pool, new Date("2026-01-12T00:00:00Z"))!.spotlight).toBe("b");
    expect(pickWeekly(pool, new Date("2025-12-29T00:00:00Z"))!.spotlight).toBe("c");
  });

  test("an empty pool has no picks", () => {
    expect(pickWeekly([], new Date())).toBeNull();
  });
});
